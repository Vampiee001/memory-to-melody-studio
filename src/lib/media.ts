export const MAX_FILES = 20;
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export type MediaKind = "image" | "video";

export function validateMediaFile(
  file: { type: string; size: number; name: string },
  existingCount: number,
): { ok: true; kind: MediaKind } | { ok: false; error: string } {
  if (existingCount >= MAX_FILES) return { ok: false, error: `You can add up to ${MAX_FILES} files per song.` };
  if (IMAGE_TYPES.includes(file.type)) {
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: `${file.name} is larger than 15 MB.` };
    return { ok: true, kind: "image" };
  }
  if (VIDEO_TYPES.includes(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) return { ok: false, error: `${file.name} is larger than 100 MB.` };
    return { ok: true, kind: "video" };
  }
  return { ok: false, error: `${file.name}: use JPG, PNG, WEBP, HEIC, MP4, MOV or WEBM.` };
}

export function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const MOODS = ["nostalgic", "joyful", "romantic", "triumphant", "bittersweet"] as const;
export const GENRES = ["pop", "acoustic", "R&B", "hip-hop", "cinematic", "country", "OPM/Bisaya"] as const;
export const VOCALS = ["Female vocal", "Male vocal", "Duet", "Choir", "Instrumental"] as const;
export const LANGUAGES = ["English", "Filipino (Tagalog)", "Bisaya (Cebuano)", "Spanish", "Taglish"] as const;
export const LENGTHS = [
  { value: 30, label: "30-second clip" },
  { value: 120, label: "~2 minutes" },
  { value: 180, label: "~3 minutes" },
] as const;
