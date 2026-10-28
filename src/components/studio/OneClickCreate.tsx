import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Circle, Loader2, MinusCircle, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/projects";
import { generateAudio, generateBeat, generateCover, getIntegrationStatus, writeSong } from "@/lib/songs.functions";
import { isBeatCleared, type BeatRights, type ReleaseMeta } from "@/lib/release";
import { Button } from "@/components/ui/button";
import { runBasicMaster } from "./MasteringPanel";
import { finalizeCover } from "./CoverPanel";

type State = "pending" | "running" | "done" | "skipped" | "failed";
type StepKey = "song" | "beat" | "audio" | "cover" | "master" | "package";
const LABELS: Record<StepKey, string> = {
  song: "Experience summary, concept & lyrics",
  beat: "Beat",
  audio: "Song audio",
  cover: "Cover artwork",
  master: "Release WAV (basic processing)",
  package: "Release package",
};
const ORDER: StepKey[] = ["song", "beat", "audio", "cover", "master", "package"];

async function fresh(id: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Couldn't reload the project.");
  return data;
}

export function OneClickCreate({ project: p, onDone }: { project: Project; onDone: (step: number) => void }) {
  const qc = useQueryClient();
  const status = useServerFn(getIntegrationStatus);
  const fns = { write: useServerFn(writeSong), beat: useServerFn(generateBeat), audio: useServerFn(generateAudio), cover: useServerFn(generateCover) };
  const { data: integ } = useQuery({ queryKey: ["integrations"], queryFn: () => status() });
  const [steps, setSteps] = useState<Record<StepKey, { s: State; msg?: string }>>(
    () => Object.fromEntries(ORDER.map((k) => [k, { s: "pending" }])) as Record<StepKey, { s: State; msg?: string }>,
  );
  const [running, setRunning] = useState(false);
  const set = (k: StepKey, s: State, msg?: string) => setSteps((prev) => ({ ...prev, [k]: msg === undefined ? { s } : { s, msg } }));

  const canStart = p.consent;

  async function runStep(k: StepKey): Promise<boolean> {
    set(k, "running");
    try {
      const cur = await fresh(p.id);
      if (k === "song") {
        if (!cur.consent) { set(k, "failed", "Confirm media consent in step 1 first."); return false; }
        const r = await fns.write({ data: { projectId: p.id, mode: "all" } });
        if (!r.ok) { set(k, "failed", r.error); return false; }
        set(k, "done");
      } else if (k === "beat") {
        if (cur.beat_source === "uploaded" && cur.beat_status === "ready") {
          set(k, "done", isBeatCleared(cur.beat_rights as BeatRights) ? "Using your uploaded beat." : "Using your uploaded beat — rights not yet declared (required before release).");
        } else if (!integ?.beats[0]?.configured) set(k, "skipped", "No beat provider connected — the song generator makes its own backing.");
        else {
          set(k, "skipped", "The music generator composes the full arrangement itself, so no separate beat is needed.");
        }
      } else if (k === "audio") {
        if (cur.beat_source === "uploaded" && cur.beat_status === "ready") {
          await supabase.from("projects").update({ audio_path: cur.beat_path, audio_status: "ready", mastering_status: "none", mastered_path: null }).eq("id", p.id);
          set(k, "done", "Your uploaded beat is used as the song audio. No vocals were added — record them yourself or switch to a generated beat.");
        } else if (!integ?.music[0]?.configured) { set(k, "skipped", "No music provider connected. Export lyrics + prompt from the Audio step."); }
        else {
          const r = await fns.audio({ data: { projectId: p.id } });
          if (!r.ok) { set(k, "failed", r.error); return false; }
          set(k, "done");
        }
      } else if (k === "cover") {
        if (!integ?.covers[0]?.configured) { set(k, "skipped", "No image provider connected — upload a cover in the Release step."); }
        else {
          const r = await fns.cover({ data: { projectId: p.id } });
          if (!r.ok) { set(k, "failed", r.error); return false; }
          const latest = await fresh(p.id);
          await finalizeCover(latest, r.path, { title: latest.title, artist: (latest.release as ReleaseMeta).artist_name ?? "", showText: true });
          set(k, "done", "Made from the song only — none of your photos were used.");
        }
      } else if (k === "master") {
        if (cur.audio_status !== "ready") { set(k, "skipped", "No song audio yet."); }
        else { await runBasicMaster(cur); set(k, "done", "Basic processing, not professional mastering. Use an external service in the Audio step for a real master."); }
      } else if (k === "package") {
        const r = cur.release as ReleaseMeta;
        await supabase.from("projects").update({
          release: { ...r, track_title: r.track_title || cur.title, language: r.language || cur.language || "English" },
          stage: "release",
        }).eq("id", p.id);
        set(k, "done", "Details pre-filled. Add artist, date & credits, then export from the Release step.");
      }
      return true;
    } catch (e) {
      set(k, "failed", e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      qc.invalidateQueries({ queryKey: ["project", p.id] });
      qc.invalidateQueries({ queryKey: ["media", p.id] });
    }
  }

  async function runFrom(start: StepKey) {
    setRunning(true);
    for (const k of ORDER.slice(ORDER.indexOf(start))) {
      const ok = await runStep(k);
      if (!ok) break;
    }
    setRunning(false);
  }

  const firstFailed = ORDER.find((k) => steps[k].s === "failed");
  const allDone = ORDER.every((k) => steps[k].s === "done" || steps[k].s === "skipped");

  return (
    <section className="surface space-y-4 p-6" aria-labelledby="oneclick">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="oneclick" className="text-2xl font-semibold">One-click create</h2>
          <p className="text-sm text-muted-foreground">Runs every available step in order using your memories and choices. Missing services are skipped and explained — nothing is faked.</p>
        </div>
        <Button variant="hero" size="lg" disabled={running || !canStart} onClick={() => runFrom("song")}>
          <Sparkles /> {running ? "Creating…" : "Create My Song"}
        </Button>
      </div>
      {!p.consent && <p className="text-sm text-warning">Confirm media consent in the Memories step to start.</p>}
      <ol className="space-y-2" aria-live="polite">
        {ORDER.map((k) => {
          const st = steps[k];
          return (
            <li key={k} className="flex items-start gap-3 rounded-2xl bg-muted p-3 text-sm">
              {st.s === "running" ? <Loader2 className="size-5 shrink-0 animate-spin text-primary" /> :
                st.s === "done" ? <CheckCircle2 className="size-5 shrink-0 text-success" /> :
                st.s === "failed" ? <XCircle className="size-5 shrink-0 text-destructive" /> :
                st.s === "skipped" ? <MinusCircle className="size-5 shrink-0 text-warning" /> : <Circle className="size-5 shrink-0 text-muted-foreground" />}
              <div>
                <p className="font-semibold">{LABELS[k]} <span className="font-normal text-muted-foreground">— {st.s === "skipped" ? "skipped" : st.s}</span></p>
                {st.msg && <p className="text-muted-foreground">{st.msg}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {firstFailed && !running && <Button variant="outline" onClick={() => runFrom(firstFailed)}><RotateCcw /> Retry from “{LABELS[firstFailed]}”</Button>}
        {allDone && <>
          <Button variant="secondary" onClick={() => onDone(1)}>Edit lyrics</Button>
          <Button variant="secondary" onClick={() => onDone(2)}>Review audio</Button>
          <Button variant="gold" onClick={() => onDone(3)}>Finish release details →</Button>
        </>}
      </div>
    </section>
  );
}
