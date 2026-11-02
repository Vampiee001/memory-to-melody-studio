import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/projects";
import type { ReleaseMeta } from "@/lib/release";
import { buildReleasePackage, deliverReleasePackage, packageFilename } from "@/lib/release-package";
export function ReleasePackageDownload({ project, release, ready, onExport }: { project: Project; release: ReleaseMeta; ready: boolean; onExport: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  const signature = JSON.stringify([release, project.audio_path, project.mastered_path, project.cover_path, project.lyrics, project.music_prompt, project.rights_checklist, project.beat_rights, project.mastering_status]);
  useEffect(() => {
    let active = true; setBlob(null); setError("");
    buildReleasePackage(project, release).then(b => { if (active) setBlob(b); }).catch(e => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, [signature, retry]);
  return <div className="space-y-2 border-t border-border pt-4"><Button variant="gold" className="h-auto min-h-12 w-full whitespace-normal py-3" disabled={!blob} onClick={() => { if (!blob) return; deliverReleasePackage(blob, packageFilename(release.track_title ?? project.title)).then(exported => { if (exported) onExport(); }).catch(() => toast.error("Couldn't save the package. Please retry.")); }}><Download />{blob ? ready ? "Download complete release package" : "Download available release files" : error ? "Package unavailable" : "Preparing release package…"}</Button><p className="text-xs text-muted-foreground">{ready ? "ZIP with audio, cover, lyrics and metadata. On supported phones, choose Save to Files." : "Incomplete release: available audio, cover and text only. Missing items are listed inside."}</p>{error && <><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => setRetry(n => n + 1)}><RefreshCw />Retry package</Button></>}</div>;
}