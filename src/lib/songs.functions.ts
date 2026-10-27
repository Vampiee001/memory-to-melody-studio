import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checklistForProject, isReleaseReady, type ReleaseMeta } from "@/lib/release";

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { writers, musicProviders, distributors, beatProviders, coverProviders, masteringProviders } = await import("@/lib/providers.server");
    const list = (r: Record<string, { id: string; label: string; isConfigured(): boolean }>) =>
      Object.values(r).map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() }));
    return {
      writers: Object.values(writers).map((w) => ({
        id: w.id, label: w.label, configured: w.isConfigured(), images: w.supportsImages, video: w.supportsVideo,
      })),
      music: list(musicProviders),
      distributors: list(distributors),
      beats: list(beatProviders),
      covers: list(coverProviders),
      mastering: list(masteringProviders),
      spotifyPlaylists: !!process.env["SPOTIFY_CLIENT_ID"] && !!process.env["SPOTIFY_CLIENT_SECRET"],
    };
  });

export const writeSong = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; mode: "all" | "lyrics" | "title" | "prompt" }) => d)
  .handler(async ({ data, context }) => {
    const { writers, ProviderError } = await import("@/lib/providers.server");
    const sb = context.supabase;
    const { data: p, error } = await sb.from("projects").select("*").eq("id", data.projectId).single();
    if (error || !p) throw new Error("Project not found");
    if (!p.consent) throw new Error("Please confirm media consent first.");
    const { data: media } = await sb.from("project_media").select("*").eq("project_id", p.id).order("position");
    const writer = writers["lovable-ai"];
    if (!writer.isConfigured()) return { ok: false as const, error: "No AI writing provider is configured. See Settings." };

    const images: { data: Uint8Array; mediaType: string }[] = [];
    for (const m of (media ?? []).filter((m) => m.kind === "image" && m.size_bytes < 4_000_000 && !m.mime_type.includes("hei")).slice(0, 4)) {
      const { data: blob } = await sb.storage.from("media").download(m.storage_path);
      if (blob) images.push({ data: new Uint8Array(await blob.arrayBuffer()), mediaType: m.mime_type });
    }
    const imgs = (media ?? []).filter((m) => m.kind === "image").length;
    const vids = (media ?? []).filter((m) => m.kind === "video");
    const mediaSummary = `${imgs} photo(s) (${images.length} analyzed visually), ${vids.length} video clip(s)${
      vids.length ? ` named: ${vids.map((v) => v.file_name).join(", ")} (video content NOT analyzed)` : ""
    }.`;
    const keep =
      data.mode === "all"
        ? undefined
        : data.mode === "lyrics"
          ? { title: p.title, concept: p.concept ?? "", experience_summary: p.experience_summary ?? "" }
          : data.mode === "title"
            ? { concept: p.concept ?? "", experience_summary: p.experience_summary ?? "" }
            : { title: p.title, concept: p.concept ?? "", experience_summary: p.experience_summary ?? "" };
    try {
      const draft = await writer.writeSong({
        context: p.context ?? "", mood: p.mood, genre: p.genre, vocal: p.vocal, language: p.language,
        lengthSec: p.length_sec ?? 30, mediaSummary, images, keep, mode: data.mode,
      });
      const patch: Record<string, string> = {};
      if (data.mode === "all") Object.assign(patch, draft);
      if (data.mode === "lyrics") Object.assign(patch, { lyrics: draft.lyrics, music_prompt: draft.music_prompt });
      if (data.mode === "title") patch["title"] = draft.title;
      if (data.mode === "prompt") patch["music_prompt"] = draft.music_prompt;
      const { error: upErr } = await sb.from("projects").update({ ...patch, stage: "song" }).eq("id", p.id);
      if (upErr) throw upErr;
      return { ok: true as const };
    } catch (e) {
      if (e instanceof ProviderError) return { ok: false as const, error: e.message };
      throw e;
    }
  });

export const generateAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => d)
  .handler(async ({ data, context }) => {
    const { musicProviders, ProviderError } = await import("@/lib/providers.server");
    const sb = context.supabase;
    const provider = musicProviders["lovable-lyria"];
    if (!provider.isConfigured()) return { ok: false as const, error: "No music provider configured." };
    // Atomic claim so double clicks don't bill twice.
    const { data: claimed } = await sb
      .from("projects")
      .update({ audio_status: "composing", audio_error: null })
      .eq("id", data.projectId)
      .neq("audio_status", "composing")
      .select("*")
      .maybeSingle();
    if (!claimed) return { ok: false as const, error: "A song is already being composed for this project." };
    if (claimed.beat_source === "uploaded") {
      await sb.from("projects").update({ audio_status: claimed.audio_path ? "ready" : "none" }).eq("id", claimed.id);
      return { ok: false as const, error: "The music provider can't sing over an uploaded beat. Use your beat as the song audio, or switch to a generated beat." };
    }
    if (!claimed.music_prompt || !claimed.lyrics) {
      await sb.from("projects").update({ audio_status: "none" }).eq("id", claimed.id);
      return { ok: false as const, error: "Write the lyrics and music prompt first." };
    }
    try {
      const bytes = await provider.compose({
        prompt: claimed.music_prompt, lyrics: claimed.lyrics, lengthSec: claimed.length_sec ?? 30, vocal: claimed.vocal,
      });
      const path = `${context.userId}/${claimed.id}/${Date.now()}.mp3`;
      const { error: upErr } = await sb.storage.from("audio").upload(path, new Uint8Array(bytes), { contentType: "audio/mpeg" });
      if (upErr) throw new Error(upErr.message);
      if (claimed.audio_path && claimed.audio_path !== claimed.beat_path) await sb.storage.from("audio").remove([claimed.audio_path]);
      // New audio invalidates any previous master.
      await sb.from("projects").update({ audio_status: "ready", audio_path: path, stage: "audio", mastering_status: "none", mastered_path: null, mastering_engine: null }).eq("id", claimed.id);
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof ProviderError ? e.message : "Audio generation failed. Please try again.";
      console.error("generateAudio", e);
      await sb.from("projects").update({ audio_status: "failed", audio_error: msg }).eq("id", claimed.id);
      return { ok: false as const, error: msg };
    }
  });

export const submitToDistributor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; confirmed: boolean }) => d)
  .handler(async ({ data, context }) => {
    if (!data.confirmed) return { ok: false as const, error: "Final review confirmation is required." };
    const { distributors, ProviderError } = await import("@/lib/providers.server");
    const adapter = distributors["distributor-api"];
    if (!adapter.isConfigured())
      return { ok: false as const, error: "No distributor API is connected. Use the manual handoff instead." };
    const sb = context.supabase;
    const { data: p } = await sb.from("projects").select("*").eq("id", data.projectId).single();
    if (!p) return { ok: false as const, error: "Project not found" };
    const release = p.release as ReleaseMeta;
    const items = checklistForProject(p, release);
    if (p.distribution_status !== "ready" || !isReleaseReady(items))
      return { ok: false as const, error: "Release must be marked Ready to distribute first." };
    const audio = p.audio_path ? await sb.storage.from("audio").createSignedUrl(p.audio_path, 60 * 60 * 24) : null;
    const cover = p.cover_path ? await sb.storage.from("covers").createSignedUrl(p.cover_path, 60 * 60 * 24) : null;
    try {
      const { reference } = await adapter.submit({
        ...release, lyrics: p.lyrics, audio_url: audio?.data?.signedUrl, cover_url: cover?.data?.signedUrl,
      });
      await sb.from("projects").update({
        distribution_status: "submitted", release: { ...release, distributor_reference: reference },
      }).eq("id", p.id);
      return { ok: true as const, reference };
    } catch (e) {
      return { ok: false as const, error: e instanceof ProviderError ? e.message : "Submission failed." };
    }
  });

export const generateBeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => d)
  .handler(async ({ data, context }) => {
    const { beatProviders, ProviderError } = await import("@/lib/providers.server");
    const provider = beatProviders["lovable-lyria-beat"];
    if (!provider.isConfigured()) return { ok: false as const, error: "No beat-generation provider is configured. See Settings." };
    const sb = context.supabase;
    const { data: p } = await sb.from("projects").update({ beat_status: "generating", beat_error: null })
      .eq("id", data.projectId).neq("beat_status", "generating").select("*").maybeSingle();
    if (!p) return { ok: false as const, error: "A beat is already being generated." };
    const prompt = p.music_prompt || [p.genre, p.mood, "instrumental beat"].filter(Boolean).join(", ");
    try {
      const bytes = await provider.generate({ prompt, lengthSec: Math.min(p.length_sec ?? 30, 30) });
      const path = `${context.userId}/${p.id}/beat-gen-${Date.now()}.mp3`;
      const { error } = await sb.storage.from("audio").upload(path, new Uint8Array(bytes), { contentType: "audio/mpeg" });
      if (error) throw new Error(error.message);
      if (p.beat_path && p.beat_path !== p.audio_path) await sb.storage.from("audio").remove([p.beat_path]);
      await sb.from("projects").update({
        beat_status: "ready", beat_source: "generated", beat_path: path, beat_mime: "audio/mpeg",
        beat_file_name: "generated-beat.mp3", beat_rights: { kind: "generated", provider: provider.label },
      }).eq("id", p.id);
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof ProviderError ? e.message : "Beat generation failed. Please try again.";
      console.error("generateBeat", e);
      await sb.from("projects").update({ beat_status: "failed", beat_error: msg }).eq("id", p.id);
      return { ok: false as const, error: msg };
    }
  });

export const generateCover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; referenceMediaId?: string | null; referenceConsent?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { coverProviders, ProviderError } = await import("@/lib/providers.server");
    const provider = coverProviders["lovable-image"];
    if (!provider.isConfigured()) return { ok: false as const, error: "No image-generation provider is configured." };
    const sb = context.supabase;
    const { data: p } = await sb.from("projects").select("*").eq("id", data.projectId).single();
    if (!p) return { ok: false as const, error: "Project not found" };
    let reference: { data: Uint8Array; mediaType: string; name: string } | undefined;
    if (data.referenceMediaId) {
      if (!data.referenceConsent) return { ok: false as const, error: "Confirm you have consent to use that photo first." };
      const { data: m } = await sb.from("project_media").select("*").eq("id", data.referenceMediaId).eq("project_id", p.id).single();
      if (!m || m.kind !== "image" || m.mime_type.includes("hei")) return { ok: false as const, error: "Choose a JPG, PNG or WebP photo as reference." };
      const { data: blob } = await sb.storage.from("media").download(m.storage_path);
      if (blob) reference = { data: new Uint8Array(await blob.arrayBuffer()), mediaType: m.mime_type, name: m.file_name };
    }
    await sb.from("projects").update({ cover_status: "generating", cover_error: null }).eq("id", p.id);
    const prompt = `Square album cover artwork for an original song titled "${p.title}". Mood: ${p.mood ?? "warm"}. Genre: ${p.genre ?? "any"}. ${
      p.concept ? `Story: ${p.concept}. ` : ""}Cinematic, painterly, emotionally warm. Leave clean negative space in the lower third for a title. Do NOT render any text, letters or logos.${
      reference ? " Use the reference photo only as loose inspiration for colours, setting and atmosphere; stylise it, do not reproduce faces photographically." : ""}`;
    try {
      const bytes = await provider.generate({ prompt, reference });
      const path = `${context.userId}/${p.id}/art-${Date.now()}.png`;
      const { error } = await sb.storage.from("covers").upload(path, bytes, { contentType: "image/png" });
      if (error) throw new Error(error.message);
      if (p.cover_art_path) await sb.storage.from("covers").remove([p.cover_art_path]);
      await sb.from("projects").update({ cover_status: "art_ready", cover_art_path: path, cover_source: "generated" }).eq("id", p.id);
      return { ok: true as const, path };
    } catch (e) {
      const msg = e instanceof ProviderError ? e.message : "Cover generation failed. Please try again.";
      console.error("generateCover", e);
      await sb.from("projects").update({ cover_status: "failed", cover_error: msg }).eq("id", p.id);
      return { ok: false as const, error: msg };
    }
  });

export const masterWithService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => d)
  .handler(async ({ data, context }) => {
    const { masteringProviders, ProviderError } = await import("@/lib/providers.server");
    const provider = masteringProviders["mastering-api"];
    if (!provider.isConfigured()) return { ok: false as const, error: "No external mastering service is connected." };
    const sb = context.supabase;
    const { data: p } = await sb.from("projects").select("*").eq("id", data.projectId).single();
    if (!p?.audio_path) return { ok: false as const, error: "There's no audio to master yet." };
    await sb.from("projects").update({ mastering_status: "processing", mastering_error: null }).eq("id", p.id);
    try {
      const signed = await sb.storage.from("audio").createSignedUrl(p.audio_path, 3600);
      if (!signed.data) throw new Error("Couldn't share the audio with the mastering service.");
      const bytes = await provider.master({ audioUrl: signed.data.signedUrl, fileName: `${p.title}.mp3` });
      const path = `${context.userId}/${p.id}/mastered-${Date.now()}.wav`;
      const { error } = await sb.storage.from("audio").upload(path, new Uint8Array(bytes), { contentType: "audio/wav" });
      if (error) throw new Error(error.message);
      if (p.mastered_path) await sb.storage.from("audio").remove([p.mastered_path]);
      await sb.from("projects").update({ mastering_status: "ready", mastered_path: path, mastering_engine: provider.id, mastering_source: p.audio_path }).eq("id", p.id);
      return { ok: true as const };
    } catch (e) {
      const msg = e instanceof ProviderError ? e.message : "Mastering failed. Your original audio is unchanged.";
      await sb.from("projects").update({ mastering_status: "failed", mastering_error: msg }).eq("id", p.id);
      return { ok: false as const, error: msg };
    }
  });
