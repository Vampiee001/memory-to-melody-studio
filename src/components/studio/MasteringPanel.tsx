import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/projects";
import { masterWithService } from "@/lib/songs.functions";
import { basicMaster, BASIC_ENGINE, BASIC_ENGINE_LABEL } from "@/lib/master";
import { currentUserId, signedUrl, uploadWithProgress } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useProjectUpdate, useRefreshProject } from "./useProjectUpdate";
import { useSignedUrl } from "./useSignedUrl";

export async function runBasicMaster(p: Project) {
  const src = await signedUrl("audio", p.audio_path);
  if (!src) throw new Error("There's no audio to process yet.");
  const wav = await basicMaster(src);
  const uid = await currentUserId();
  const path = `${uid}/${p.id}/mastered-basic-${Date.now()}.wav`;
  await uploadWithProgress("audio", path, wav);
  if (p.mastered_path) await supabase.storage.from("audio").remove([p.mastered_path]);
  const { error } = await supabase.from("projects").update({
    mastering_status: "ready", mastered_path: path, mastering_engine: BASIC_ENGINE, mastering_source: p.audio_path, mastering_error: null,
  }).eq("id", p.id);
  if (error) throw error;
}

export function MasteringPanel({ project: p, serviceConfigured }: { project: Project; serviceConfigured: boolean }) {
  const ext = useServerFn(masterWithService);
  const update = useProjectUpdate(p.id);
  const refresh = useRefreshProject(p.id);
  const [busy, setBusy] = useState(false);
  const masterUrl = useSignedUrl("audio", p.mastering_status === "ready" ? p.mastered_path : null);
  const origUrl = useSignedUrl("audio", p.audio_status === "ready" ? p.audio_path : null);
  const stale = p.mastering_status === "ready" && p.mastering_source !== p.audio_path;

  async function basic() {
    setBusy(true);
    try { await runBasicMaster(p); toast.success("Processed WAV ready"); }
    catch (e) {
      const msg = e instanceof Error ? e.message : "Processing failed. Your original audio is unchanged.";
      update.mutate({ mastering_status: "failed", mastering_error: msg });
      toast.error(msg);
    } finally { setBusy(false); refresh(); }
  }
  async function service() {
    setBusy(true);
    try { const r = await ext({ data: { projectId: p.id } }); if (!r.ok) toast.error(r.error); else toast.success("Mastered by your service"); }
    catch { toast.error("Mastering failed."); }
    finally { setBusy(false); refresh(); }
  }

  if (p.audio_status !== "ready") return (
    <div className="rounded-3xl border border-border p-5 text-sm text-muted-foreground"><h3 className="mb-1 text-lg font-semibold text-foreground">Mastering</h3>Generate or add song audio first.</div>
  );

  const engineLabel = p.mastering_engine === BASIC_ENGINE ? "Basic processing — not a professional master" : "External mastering service";

  return (
    <div className="space-y-4 rounded-3xl border border-border p-5">
      <h3 className="text-lg font-semibold">Mastering</h3>
      <p className="text-sm text-muted-foreground">Your original audio is always kept. Processing creates a separate WAV release file.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={basic} disabled={busy || p.mastering_status === "processing"}><SlidersHorizontal /> {busy ? "Processing…" : "Basic process to WAV"}</Button>
        <Button variant="outline" onClick={service} disabled={busy || !serviceConfigured} title={serviceConfigured ? undefined : "Connect a mastering service in Settings"}>
          Master with external service{serviceConfigured ? "" : " (not connected)"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Basic = {BASIC_ENGINE_LABEL}. It is not equivalent to a mastering engineer or a professional mastering service.</p>
      {p.mastering_status === "failed" && <p role="alert" className="text-sm text-destructive">{p.mastering_error}</p>}
      {p.mastering_status === "ready" && masterUrl && (
        <div className="space-y-2 rounded-2xl bg-muted p-4">
          <Badge variant="outline">{engineLabel}</Badge>
          {stale && <p className="text-xs text-warning">The song audio changed after this file was made — process again.</p>}
          <audio controls src={masterUrl} className="w-full" aria-label="Processed WAV preview" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild><a href={masterUrl} download={`${p.title}-release.wav`}><Download /> WAV (release)</a></Button>
            {origUrl && <Button size="sm" variant="ghost" asChild><a href={origUrl} download={`${p.title}-original`}><Download /> Original (preview)</a></Button>}
          </div>
        </div>
      )}
    </div>
  );
}
