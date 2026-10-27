import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Music2, AlertTriangle, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/projects";
import { generateAudio, getIntegrationStatus } from "@/lib/songs.functions";
import { downloadText, RIGHTS_ITEMS } from "@/lib/release";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Wave } from "@/components/Brand";
import { useProjectUpdate, useRefreshProject } from "./useProjectUpdate";

export function AudioStep({ project: p, onNext }: { project: Project; onNext: () => void }) {
  const status = useServerFn(getIntegrationStatus);
  const gen = useServerFn(generateAudio);
  const refresh = useRefreshProject(p.id);
  const update = useProjectUpdate(p.id);
  const { data: integ, isLoading } = useQuery({ queryKey: ["integrations"], queryFn: () => status() });
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const rights = (p.rights_checklist ?? {}) as Record<string, boolean>;
  const music = integ?.music[0];

  useEffect(() => {
    let alive = true;
    if (p.audio_path && p.audio_status === "ready") {
      supabase.storage.from("audio").createSignedUrl(p.audio_path, 3600).then(({ data }) => alive && setUrl(data?.signedUrl ?? null));
    }
    return () => { alive = false; };
  }, [p.audio_path, p.audio_status]);

  async function compose() {
    setBusy(true);
    try {
      const r = await gen({ data: { projectId: p.id } });
      if (!r.ok) toast.error(r.error); else toast.success("Your song is ready to play");
    } catch { toast.error("Audio generation failed."); }
    finally { setBusy(false); refresh(); }
  }

  const exportBrief = () =>
    downloadText(`${p.title}-music-brief.txt`, `${p.title}\n\n[Music prompt]\n${p.music_prompt ?? ""}\n\n[Lyrics]\n${p.lyrics ?? ""}`);

  const composing = busy || p.audio_status === "composing";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="surface space-y-5 p-6">
        <h2 className="text-2xl font-semibold">Audio</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Checking music provider…</p> : !music?.configured ? (
          <div className="rounded-2xl border border-warning/50 bg-warning/10 p-4 text-sm">
            <AlertTriangle className="mb-2 size-5 text-warning" />
            <p className="font-semibold">No music-generation provider is set up.</p>
            <p className="mt-1 text-muted-foreground">You can still export your lyrics and music prompt to use in any music tool.</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={exportBrief}><Download /> Export lyrics + prompt</Button>
              <Button size="sm" variant="ghost" asChild><Link to="/settings"><Settings /> Settings</Link></Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Provider: <strong className="text-foreground">{music.label}</strong>. {p.length_sec && p.length_sec > 30 ? "Full-length tracks can take a couple of minutes." : "Clips take about 30–60 seconds."}</p>
        )}

        {composing ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted p-10 text-center" aria-live="polite">
            <Wave bars={16} className="h-12" />
            <p className="font-display text-lg">Composing your song…</p>
            <p className="text-xs text-muted-foreground">Keep this tab open.</p>
          </div>
        ) : p.audio_status === "ready" && url ? (
          <div className="space-y-3 rounded-3xl bg-muted p-5">
            <div className="flex items-center gap-3"><Music2 className="text-gold" /><span className="font-semibold">{p.title}</span></div>
            <audio controls src={url} className="w-full" aria-label={`Play ${p.title}`} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild><a href={url} download={`${p.title}.mp3`}><Download /> Download MP3</a></Button>
              <Button variant="ghost" size="sm" onClick={compose} disabled={!music?.configured}>Generate a new take</Button>
            </div>
          </div>
        ) : (
          <>
            {p.audio_status === "failed" && <p role="alert" className="rounded-2xl bg-destructive/15 p-3 text-sm text-destructive">{p.audio_error}</p>}
            <Button variant="hero" size="lg" onClick={compose} disabled={!music?.configured || !p.lyrics}>
              <Music2 /> Generate audio
            </Button>
            {!p.lyrics && <p className="text-xs text-muted-foreground">Write lyrics in step 2 first.</p>}
          </>
        )}
        <Button variant="outline" onClick={exportBrief}><Download /> Export lyrics + music prompt</Button>
      </section>

      <section className="surface space-y-4 p-6" aria-labelledby="rights">
        <h2 id="rights" className="text-xl font-semibold">Rights & licensing checklist</h2>
        <p className="text-xs text-muted-foreground">Complete this before releasing. Rights to AI-generated audio depend on the provider's terms.</p>
        {RIGHTS_ITEMS.map((it) => (
          <label key={it.key} className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={!!rights[it.key]} onCheckedChange={(v) => update.mutate({ rights_checklist: { ...rights, [it.key]: !!v } })} />
            <span>{it.label}</span>
          </label>
        ))}
        <Button variant="hero" className="w-full" onClick={() => { update.mutate({ stage: "release" }); onNext(); }}>Prepare release →</Button>
      </section>
    </div>
  );
}
