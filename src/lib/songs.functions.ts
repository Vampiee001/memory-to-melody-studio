import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildReleaseChecklist, isReleaseReady, type ReleaseMeta } from "@/lib/release";

export const getIntegrationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { writers, musicProviders, distributors } = await import("@/lib/providers.server");
    const list = (r: Record<string, { id: string; label: string; isConfigured(): boolean }>) =>
      Object.values(r).map((p) => ({ id: p.id, label: p.label, configured: p.isConfigured() }));
    return {
      writers: Object.values(writers).map((w) => ({
        id: w.id, label: w.label, configured: w.isConfigured(), images: w.supportsImages, video: w.supportsVideo,
      })),
      music: list(musicProviders),
      distributors: list(distributors),
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
      if (claimed.audio_path) await sb.storage.from("audio").remove([claimed.audio_path]);
      await sb.from("projects").update({ audio_status: "ready", audio_path: path, stage: "audio" }).eq("id", claimed.id);
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
    const items = buildReleaseChecklist({
      release, lyrics: p.lyrics, audioReady: p.audio_status === "ready", coverPath: p.cover_path,
      rights: p.rights_checklist as Record<string, boolean>,
    });
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
