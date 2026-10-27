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
  coverPath?: string | null;
  rights: Record<string, boolean>;
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
    { key: "audio", label: "Mastered audio file", done: input.audioReady },
    { key: "cover", label: "Cover art (3000×3000 recommended)", done: !!input.coverPath },
    { key: "rights", label: "Rights & licensing checklist", done: rightsDone },
    { key: "ownership", label: "Ownership declaration", done: !!r.ownership_declared },
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
