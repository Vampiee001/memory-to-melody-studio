import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/projects";
import { generateBeat } from "@/lib/songs.functions";
import { BEAT_RIGHTS_OPTIONS, isBeatCleared, validateBeatFile, type BeatRights } from "@/lib/release";
import { currentUserId, uploadWithProgress } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useProjectUpdate, useRefreshProject } from "./useProjectUpdate";
import { useSignedUrl } from "./useSignedUrl";

export function BeatPanel({ project: p, beatConfigured }: { project: Project; beatConfigured: boolean }) {
  const gen = useServerFn(generateBeat);
  const update = useProjectUpdate(p.id);
  const refresh = useRefreshProject(p.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const mode = p.beat_source === "uploaded" ? "upload" : "generate";
  const [choice, setChoice] = useState<"generate" | "upload">(mode);
  const rights = (p.beat_rights ?? {}) as BeatRights;
  const url = useSignedUrl("audio", p.beat_status === "ready" ? p.beat_path : null);

  async function onFile(file?: File) {
    if (!file) return;
    const err = validateBeatFile(file);
    if (err) { toast.error(err); return; }
    try {
      const uid = await currentUserId();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp3";
      const path = `${uid}/${p.id}/beat-upload-${Date.now()}.${ext}`;
      setProgress(0);
      await uploadWithProgress("audio", path, file, setProgress);
      if (p.beat_path && p.beat_path !== p.audio_path) await supabase.storage.from("audio").remove([p.beat_path]);
      await update.mutateAsync({
        beat_source: "uploaded", beat_path: path, beat_file_name: file.name, beat_mime: file.type || `audio/${ext}`,
        beat_status: "ready", beat_error: null, beat_rights: {},
      });
      toast.success("Beat uploaded — please declare your rights below");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setProgress(null); }
  }

  async function onGenerate() {
    setBusy(true);
    try {
      const r = await gen({ data: { projectId: p.id } });
      if (!r.ok) toast.error(r.error); else toast.success("Beat generated");
    } catch { toast.error("Beat generation failed."); }
    finally { setBusy(false); refresh(); }
  }

  async function remove() {
    if (p.beat_path && p.beat_path !== p.audio_path) await supabase.storage.from("audio").remove([p.beat_path]);
    await update.mutateAsync({ beat_source: "none", beat_path: null, beat_file_name: null, beat_mime: null, beat_status: "none", beat_rights: {} });
  }

  const setRights = (next: BeatRights) => update.mutate({ beat_rights: next });

  return (
    <div className="space-y-4 rounded-3xl border border-border p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Beat</h3>
        {p.beat_status === "ready" && <Badge variant="outline">{p.beat_source === "uploaded" ? "Uploaded by you" : "AI-generated"}</Badge>}
      </div>
      <div role="radiogroup" aria-label="Beat source" className="grid grid-cols-2 gap-2">
        {(["generate", "upload"] as const).map((c) => (
          <button key={c} role="radio" aria-checked={choice === c} onClick={() => setChoice(c)}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${choice === c ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {c === "generate" ? "Generate a beat" : "Upload my beat"}
          </button>
        ))}
      </div>

      {choice === "generate" ? (
        beatConfigured ? (
          <Button variant="outline" onClick={onGenerate} disabled={busy || p.beat_status === "generating"}>
            <Sparkles /> {busy || p.beat_status === "generating" ? "Generating beat…" : p.beat_source === "generated" ? "Generate a new beat" : "Generate instrumental beat"}
          </Button>
        ) : <p className="text-sm text-muted-foreground">No beat-generation provider is connected. See Settings.</p>
      ) : (
        <div className="space-y-2">
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={progress !== null}><Upload /> {p.beat_source === "uploaded" ? "Replace beat" : "Choose audio file"}</Button>
          <p className="text-xs text-muted-foreground">WAV, MP3, M4A or AAC, up to 50 MB.</p>
          <input ref={fileRef} type="file" hidden accept=".wav,.mp3,.m4a,.aac,audio/*" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          {progress !== null && <Progress value={progress} aria-label="Upload progress" />}
        </div>
      )}

      {p.beat_status === "failed" && <p role="alert" className="text-sm text-destructive">{p.beat_error}</p>}
      {url && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{p.beat_file_name}</p>
          <audio controls src={url} className="w-full" aria-label="Beat preview" />
          <Button variant="ghost" size="sm" onClick={remove}><Trash2 /> Remove beat</Button>
        </div>
      )}

      {p.beat_source === "uploaded" && p.beat_status === "ready" && (
        <fieldset className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
          <legend className="font-semibold">Beat rights declaration</legend>
          {BEAT_RIGHTS_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-center gap-2">
              <input type="radio" name="beat-rights" checked={rights.kind === o.value} onChange={() => setRights({ ...rights, kind: o.value, confirmed: o.value === "unsure" ? false : rights.confirmed ?? false })} />
              {o.label}
            </label>
          ))}
          {rights.kind && rights.kind !== "unsure" && (
            <label className="flex items-start gap-2 pt-2">
              <Checkbox className="mt-0.5" checked={!!rights.confirmed} onCheckedChange={(v) => setRights({ ...rights, confirmed: !!v })} />
              <span>I confirm this beat is cleared for commercial release and I can show proof if asked.</span>
            </label>
          )}
          {!isBeatCleared(rights) && (
            <p className="flex gap-2 pt-2 text-warning"><AlertTriangle className="size-4 shrink-0" />Not cleared for release. Beats copied from others can get your song blocked, demonetised or removed by distributors.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
