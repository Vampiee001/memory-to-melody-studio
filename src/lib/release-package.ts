import type { Project } from "./projects";
import { checklistForProject, releaseToCSV, type ReleaseMeta } from "./release";
import { supabase } from "@/integrations/supabase/client";
export function packageFilename(title: string) { return `${title.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0,80) || "memory-song"}-release.zip`; }
export async function buildReleasePackage(p: Project, r: ReleaseMeta) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const assets: { bucket: string; path: string; name: string }[] = [];
  const add = (bucket: string, path: string | null, label: string) => { if (path) assets.push({ bucket, path, name: `${label}.${path.split(".").pop()?.toLowerCase() || "bin"}` }); };
  add("audio", p.audio_path, "original-audio");
  add("audio", p.mastered_path, "release-audio");
  add("covers", p.cover_path, "cover");
  for (const asset of assets) {
    const { data, error } = await supabase.storage.from(asset.bucket).download(asset.path);
    if (error || !data) throw new Error(`Couldn't download ${asset.name}. Retry preparing the package.`);
    zip.file(asset.name, await data.arrayBuffer());
  }
  const checklist = checklistForProject(p, r);
  const missing = checklist.filter(i => !i.done).map(i => i.label);
  zip.file("release.json", JSON.stringify({ ...r, ai_generated: true, generated_with: "MemoryMelody", beat_source: p.beat_source, beat_rights: p.beat_rights, mastering: p.mastering_status === "ready" ? p.mastering_engine : "none", assets: assets.map(a => a.name), checklist, missing_items: missing, submitted: false }, null, 2));
  zip.file("release.csv", releaseToCSV(r));
  zip.file("lyrics.txt", p.lyrics ?? "");
  zip.file("music-prompt.txt", p.music_prompt ?? "");
  zip.file("README.txt", `MemoryMelody release package\nArtist: ${r.artist_name ?? "Not set"}\nDistributor: ${r.distributor_name ?? "Not chosen"}\n${missing.length ? `Incomplete checklist: ${missing.join(", ")}` : "Checklist complete"}\nExport is not submission. Upload these files to your chosen distributor and review rights, AI-content acceptance, audio and artwork specifications. Your distributor delivers to Spotify and other supported stores. No platform income is guaranteed.\nAI rights depend on provider terms; verify ownership and permissions.\n`);
  return zip.generateAsync({ type: "blob", compression: "STORE" });
}
export async function deliverReleasePackage(blob: Blob, name: string) {
  const file = new File([blob], name, { type: "application/zip" });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return true; }
    catch (e) { if ((e as DOMException).name === "AbortError") return false; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}