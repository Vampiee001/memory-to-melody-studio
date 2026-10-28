// Server-only provider adapters. Secrets are read from process.env inside calls only.
import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText, type ModelMessage } from "ai";
import { z } from "zod/v4";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TEXT_MODEL = "openai/gpt-6-astra";

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function friendly(status: number, fallback: string) {
  if (status === 402) return "AI credits are used up for this workspace. Add credits to keep generating.";
  if (status === 429) return "The AI service is busy right now. Please wait a minute and try again.";
  if (status === 401) return "The AI provider isn't configured correctly.";
  if (status === 403) return fallback || "The AI provider declined this request.";
  return fallback || "The AI provider returned an error.";
}

// ---------- Text / vision provider ----------
export interface SongWriterProvider {
  id: string;
  label: string;
  supportsImages: boolean;
  supportsVideo: boolean;
  isConfigured(): boolean;
  writeSong(input: SongBrief): Promise<SongDraft>;
}

export type SongBrief = {
  context: string;
  mood?: string | null;
  genre?: string | null;
  vocal?: string | null;
  language?: string | null;
  lengthSec: number;
  mediaSummary: string;
  images: { data: Uint8Array; mediaType: string }[];
  keep?: { title?: string; concept?: string; experience_summary?: string } | undefined;
  mode: "all" | "lyrics" | "title" | "prompt";
};

export const songSchema = z.object({
  experience_summary: z.string(),
  title: z.string(),
  concept: z.string(),
  lyrics: z.string(),
  music_prompt: z.string(),
});
export type SongDraft = z.infer<typeof songSchema>;

const lovableWriter: SongWriterProvider = {
  id: "lovable-ai",
  label: "Lovable AI (text + image understanding)",
  supportsImages: true,
  supportsVideo: false,
  isConfigured: () => !!process.env["LOVABLE_API_KEY"],
  async writeSong(b) {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new ProviderError(503, "No AI writing provider is configured.");
    const provider = createOpenAI({
      baseURL: GATEWAY,
      apiKey: key,
      headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });
    const instructions = `You are a warm, skilled songwriter. Write ORIGINAL lyrics only — never quote or imitate existing songs or real artists.
Base everything strictly on the user's own context and the photos provided. Do not invent claims about videos; you only receive their file names.
Return:
- experience_summary: 2-4 sentences describing the memories and their emotional core.
- title: a short evocative song title.
- concept: 2-3 sentences describing the song's story and arc.
- lyrics: full lyrics with section headers on their own lines in square brackets: [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Final Chorus]. Shorter for a 30-second clip (one verse + chorus).
- music_prompt: a production brief for a music generator: genre, tempo (BPM), key/feel, instrumentation, vocal style, mood arc. No artist names.`;
    const keepNote = b.keep
      ? `\nKeep these unchanged and return them exactly: ${JSON.stringify(b.keep)}. Only regenerate: ${b.mode}.`
      : "";
    const text = `Memory context from the user:\n${b.context || "(none given)"}\n\nUploaded media: ${b.mediaSummary}\nMood: ${b.mood ?? "any"}\nGenre: ${b.genre ?? "any"}\nVocals: ${b.vocal ?? "any"}\nLanguage of lyrics: ${b.language ?? "English"}\nTarget length: about ${b.lengthSec} seconds.${keepNote}`;
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text },
          ...b.images.map((img) => ({ type: "file" as const, data: img.data, mediaType: img.mediaType })),
        ],
      },
    ];
    try {
      const result = streamText({
        model: provider.responses(TEXT_MODEL),
        instructions,
        messages,
        output: Output.object({ schema: songSchema }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const out = await result.output;
      return songSchema.parse(out);
    } catch (e: unknown) {
      const status = (e as { statusCode?: number }).statusCode ?? 500;
      console.error("writeSong failed", e);
      throw new ProviderError(status, friendly(status, "Couldn't write the song this time. Please try again."));
    }
  },
};

export const writers = { "lovable-ai": lovableWriter } as const;

// ---------- Music provider ----------
export interface MusicProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  compose(input: { prompt: string; lyrics: string; lengthSec: number; vocal?: string | null }): Promise<ArrayBuffer>;
}

const lyria: MusicProvider = {
  id: "lovable-lyria",
  label: "Lovable AI music (Google Lyria)",
  isConfigured: () => !!process.env["LOVABLE_API_KEY"],
  async compose({ prompt, lyrics, lengthSec, vocal }) {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new ProviderError(503, "No music provider is configured.");
    const model = lengthSec <= 30 ? "google/lyria-3-clip-preview" : "google/lyria-3-pro-preview";
    const instrumental = vocal === "Instrumental";
    const text = `${prompt}\n${lengthSec > 30 ? `Duration: about ${lengthSec} seconds.\n` : ""}${
      instrumental ? "Instrumental only, no vocals." : `Sing these lyrics:\n${lyrics}`
    }`;
    const res = await fetch(`${GATEWAY}/music`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: [{ type: "user_input", content: [{ type: "text", text }] }] }),
    });
    if (!res.ok) {
      let msg = "";
      try {
        const j = (await res.json()) as { error?: { message?: string }; message?: string };
        msg = j.error?.message ?? j.message ?? "";
      } catch {}
      throw new ProviderError(res.status, friendly(res.status, msg));
    }
    return await res.arrayBuffer();
  },
};

export const musicProviders = { "lovable-lyria": lyria } as const;

// ---------- Distributor adapter ----------
export interface DistributorAdapter {
  id: string;
  label: string;
  isConfigured(): boolean;
  submit(pkg: Record<string, unknown>): Promise<{ reference: string }>;
}

/** Generic REST adapter. Only works if the user has an approved distributor API account
 *  and saved DISTRIBUTOR_API_URL + DISTRIBUTOR_API_KEY in project secrets. */
const genericDistributor: DistributorAdapter = {
  id: "distributor-api",
  label: "Approved distributor API (bring your own account)",
  isConfigured: () => !!process.env["DISTRIBUTOR_API_URL"] && !!process.env["DISTRIBUTOR_API_KEY"],
  async submit(pkg) {
    const url = process.env["DISTRIBUTOR_API_URL"];
    const key = process.env["DISTRIBUTOR_API_KEY"];
    if (!url || !key) throw new ProviderError(503, "No distributor API is configured.");
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(pkg),
    });
    if (!res.ok) throw new ProviderError(res.status, `Distributor rejected the submission (${res.status}).`);
    const j = (await res.json().catch(() => ({}))) as { id?: string; reference?: string };
    return { reference: j.reference ?? j.id ?? "submitted" };
  },
};

export const distributors = { "distributor-api": genericDistributor } as const;

// ---------- Beat provider ----------
export interface BeatProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  generate(input: { prompt: string; lengthSec: number }): Promise<ArrayBuffer>;
}

const lyriaBeat: BeatProvider = {
  id: "lovable-lyria-beat",
  label: "Lovable AI music (Google Lyria, instrumental)",
  isConfigured: () => !!process.env["LOVABLE_API_KEY"],
  generate: ({ prompt, lengthSec }) =>
    lyria.compose({ prompt: `${prompt}\nBackground beat / instrumental bed for a vocalist.`, lyrics: "", lengthSec, vocal: "Instrumental" }),
};

export const beatProviders = { "lovable-lyria-beat": lyriaBeat } as const;

// ---------- Cover art provider ----------
export interface CoverProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  generate(input: { prompt: string; reference?: { data: Uint8Array; mediaType: string; name: string } | undefined }): Promise<Uint8Array>;
}

const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

const lovableCover: CoverProvider = {
  id: "lovable-image",
  label: "Lovable AI image generation",
  isConfigured: () => !!process.env["LOVABLE_API_KEY"],
  async generate({ prompt, reference }) {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new ProviderError(503, "No image provider is configured.");
    let res: Response;
    if (reference) {
      const form = new FormData();
      form.set("model", IMAGE_MODEL);
      form.set("prompt", prompt);
      form.set("size", "1024x1024");
      form.set("quality", "medium");
      form.append("image[]", new File([new Uint8Array(reference.data)], reference.name, { type: reference.mediaType }));
      res = await fetch(`${GATEWAY}/images/edits`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    } else {
      res = await fetch(`${GATEWAY}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", quality: "medium" }),
      });
    }
    if (!res.ok) {
      let msg = "";
      try {
        const j = (await res.json()) as { error?: { message?: string }; message?: string };
        msg = j.error?.message ?? j.message ?? "";
      } catch {}
      throw new ProviderError(res.status, friendly(res.status, msg || "Cover generation failed."));
    }
    const j = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = j.data?.[0]?.b64_json;
    if (!b64) throw new ProviderError(502, "The image service returned no picture. Please try again.");
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export const coverProviders = { "lovable-image": lovableCover } as const;

// ---------- Mastering provider ----------
export interface MasteringProvider {
  id: string;
  label: string;
  isConfigured(): boolean;
  /** Sends a signed URL of the source audio; returns mastered WAV bytes. */
  master(input: { audioUrl: string; fileName: string }): Promise<ArrayBuffer>;
}

/** Generic REST adapter for a mastering service the owner has an account with.
 *  Expects POST {audio_url, output_format:"wav"} -> audio/wav bytes. Adjust to the vendor's API. */
const externalMastering: MasteringProvider = {
  id: "mastering-api",
  label: "External mastering service (bring your own account)",
  isConfigured: () => !!process.env["MASTERING_API_URL"] && !!process.env["MASTERING_API_KEY"],
  async master({ audioUrl, fileName }) {
    const url = process.env["MASTERING_API_URL"];
    const key = process.env["MASTERING_API_KEY"];
    if (!url || !key) throw new ProviderError(503, "No mastering service is configured.");
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ audio_url: audioUrl, file_name: fileName, output_format: "wav" }),
    });
    if (!res.ok) throw new ProviderError(res.status, `Mastering service rejected the file (${res.status}).`);
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("audio")) throw new ProviderError(502, "Mastering service did not return audio.");
    return await res.arrayBuffer();
  },
};

export const masteringProviders = { "mastering-api": externalMastering } as const;
