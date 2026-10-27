// Pure release/distribution rules shared by UI and server.

export type DistributionStatus = "draft" | "ready" | "submitted" | "live";

export const DISTRIBUTION_LABELS: Record<DistributionStatus, string> = {
  draft: "Draft",
  ready: "Ready to distribute",
  submitted: "Submitted",
  live: "Live",
};

export type ReleaseMeta = {
  artist_name?: string;
  track_title?: string;
  release_date?: string;
  language?: string;
  explicit?: boolean;
  songwriters?: string;
  producers?: string;
  ownership_declared?: boolean;
  spotify_url?: string;
  distributor_name?: string;
};

export const RIGHTS_ITEMS = [
  { key: "media_rights", label: "I own or have permission to use every photo and video I uploaded." },
  { key: "people_consent", label: "People recognisable in my media agreed to their likeness inspiring this song." },
  { key: "provider_terms", label: "I reviewed the AI music provider's terms on commercial use and ownership of generated audio." },
  { key: "no_imitation", label: "The song does not imitate a real artist's voice, name, or copyrighted lyrics/melodies." },
  { key: "distributor_terms", label: "I will confirm my distributor accepts AI-assisted music before submitting." },
] as const;

export type ChecklistItem = { key: string; label: string; done: boolean };

export function buildReleaseChecklist(input: {
  release: ReleaseMeta;
  lyrics?: string | null;
  audioReady: boolean;
  masteredReady?: boolean;
  coverPath?: string | null;
  rights: Record<string, boolean>;
  beatSource?: string | null;
  beatRights?: BeatRights | null;
}): ChecklistItem[] {
  const r = input.release;
  const rightsDone = RIGHTS_ITEMS.every((i) => input.rights[i.key]);
  return [
    { key: "artist", label: "Artist name", done: !!r.artist_name?.trim() },
    { key: "title", label: "Track title", done: !!r.track_title?.trim() },
    { key: "date", label: "Release date", done: !!r.release_date },
    { key: "language", label: "Language", done: !!r.language?.trim() },
    { key: "credits", label: "Songwriter credits", done: !!r.songwriters?.trim() },
    { key: "lyrics", label: "Final lyrics", done: !!input.lyrics?.trim() },
    { key: "audio", label: "Song audio", done: input.audioReady },
    { key: "master", label: "Mastered WAV file", done: input.audioReady && !!input.masteredReady },
    { key: "cover", label: "Cover art (3000×3000 recommended)", done: !!input.coverPath },
    { key: "rights", label: "Rights & licensing checklist", done: rightsDone },
    { key: "ownership", label: "Ownership declaration", done: !!r.ownership_declared },
    ...(input.beatSource === "uploaded"
      ? [{ key: "beat", label: "Uploaded beat rights declared", done: isBeatCleared(input.beatRights) }]
      : []),
  ];
}

export function isReleaseReady(items: ChecklistItem[]) {
  return items.length > 0 && items.every((i) => i.done);
}

/** Allowed manual transitions. Submission requires a ready release; live requires submitted. */
export function canTransition(from: DistributionStatus, to: DistributionStatus, ready: boolean): boolean {
  if (to === "draft") return true;
  if (to === "ready") return from === "draft" && ready;
  if (to === "submitted") return from === "ready" && ready;
  if (to === "live") return from === "submitted";
  return false;
}

function csvCell(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function releaseToCSV(release: ReleaseMeta, extra: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    artist_name: release.artist_name,
    track_title: release.track_title,
    release_date: release.release_date,
    language: release.language,
    explicit: release.explicit ? "yes" : "no",
    songwriters: release.songwriters,
    producers: release.producers,
    ownership_declared: release.ownership_declared ? "yes" : "no",
    ...extra,
  };
  const keys = Object.keys(row);
  return `${keys.join(",")}\n${keys.map((k) => csvCell(row[k])).join(",")}\n`;
}

export function downloadText(filename: string, content: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type BeatRights = { kind?: "own" | "license" | "permission" | "generated" | "unsure"; confirmed?: boolean; notes?: string; provider?: string };

export const BEAT_RIGHTS_OPTIONS = [
  { value: "own", label: "I made this beat / I own it outright" },
  { value: "license", label: "I have a license that allows commercial release" },
  { value: "permission", label: "I have written permission from the producer" },
  { value: "unsure", label: "I'm not sure / I found it online" },
] as const;

/** An uploaded beat is only cleared for release with an ownership/licence basis AND explicit confirmation. */
export function isBeatCleared(r?: BeatRights | null) {
  if (!r) return false;
  if (r.kind === "generated") return true;
  return (r.kind === "own" || r.kind === "license" || r.kind === "permission") && r.confirmed === true;
}

export const BEAT_ACCEPT = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave", "audio/mp4", "audio/x-m4a", "audio/m4a", "audio/aac"];
export const BEAT_MAX_BYTES = 50 * 1024 * 1024;

export function validateBeatFile(f: { name: string; type: string; size: number }): string | null {
  const ext = f.name.toLowerCase().split(".").pop() ?? "";
  const okType = BEAT_ACCEPT.includes(f.type) || ["mp3", "wav", "m4a", "aac"].includes(ext);
  if (!okType) return "Use a WAV, MP3, M4A or AAC file.";
  if (f.size > BEAT_MAX_BYTES) return "Audio files must be under 50 MB.";
  if (f.size === 0) return "That file is empty.";
  return null;
}

type ProjectLike = {
  release: unknown; lyrics: string | null; audio_status: string; mastering_status?: string | null;
  cover_path: string | null; rights_checklist: unknown; beat_source?: string | null; beat_rights?: unknown;
};
export function checklistForProject(p: ProjectLike, release?: ReleaseMeta) {
  return buildReleaseChecklist({
    release: release ?? (p.release as ReleaseMeta), lyrics: p.lyrics, audioReady: p.audio_status === "ready",
    masteredReady: p.mastering_status === "ready", coverPath: p.cover_path,
    rights: (p.rights_checklist ?? {}) as Record<string, boolean>,
    beatSource: p.beat_source ?? null, beatRights: (p.beat_rights ?? null) as BeatRights | null,
  });
}
