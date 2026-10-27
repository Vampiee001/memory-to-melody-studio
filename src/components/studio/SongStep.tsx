import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/projects";
import { writeSong } from "@/lib/songs.functions";
import { downloadText } from "@/lib/release";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Wave } from "@/components/Brand";
import { useProjectUpdate, useRefreshProject } from "./useProjectUpdate";

type Mode = "all" | "lyrics" | "title" | "prompt";

export function SongStep({ project: p, onNext }: { project: Project; onNext: () => void }) {
  const write = useServerFn(writeSong);
  const update = useProjectUpdate(p.id);
  const refresh = useRefreshProject(p.id);
  const [busy, setBusy] = useState<Mode | null>(null);
  const [f, setF] = useState({ title: p.title, concept: p.concept ?? "", lyrics: p.lyrics ?? "", music_prompt: p.music_prompt ?? "", experience_summary: p.experience_summary ?? "" });
  useEffect(() => {
    setF({ title: p.title, concept: p.concept ?? "", lyrics: p.lyrics ?? "", music_prompt: p.music_prompt ?? "", experience_summary: p.experience_summary ?? "" });
  }, [p.title, p.concept, p.lyrics, p.music_prompt, p.experience_summary]);

  async function run(mode: Mode) {
    if (!p.consent) { toast.error("Confirm media consent in step 1 first."); return; }
    setBusy(mode);
    try {
      const r = await write({ data: { projectId: p.id, mode } });
      if (!r.ok) toast.error(r.error);
      else { toast.success(mode === "all" ? "Your song is written" : "Updated"); refresh(); }
    } catch {
      toast.error("Something went wrong writing your song.");
    } finally {
      setBusy(null);
    }
  }

  const hasDraft = !!p.lyrics;

  if (!hasDraft && busy !== "all") {
    return (
      <div className="surface flex flex-col items-center gap-4 p-10 text-center">
        <Sparkles className="size-8 text-gold" />
        <h2 className="text-2xl font-semibold">Ready to hear what your memories say?</h2>
        <p className="max-w-md text-sm text-muted-foreground">We'll read your story and look at up to 4 of your photos to write an experience summary, a song concept, original lyrics and a music-production prompt. Video content isn't analyzed.</p>
        <Button variant="hero" size="lg" onClick={() => run("all")}>Analyze & write my song</Button>
      </div>
    );
  }
  if (busy === "all") {
    return (
      <div className="surface flex flex-col items-center gap-4 p-12 text-center" aria-live="polite">
        <Wave bars={14} className="h-10" />
        <p className="font-display text-xl">Listening to your memories…</p>
        <p className="text-sm text-muted-foreground">This usually takes 20–60 seconds.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
      <section className="surface space-y-4 p-6">
        <h2 className="text-xl font-semibold text-gold">Experience summary</h2>
        <Textarea rows={4} aria-label="Experience summary" value={f.experience_summary} onChange={(e) => setF({ ...f, experience_summary: e.target.value })} />
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label htmlFor="t">Title</Label><Regen busy={busy === "title"} onClick={() => run("title")} label="title" /></div>
          <Input id="t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="c">Song concept</Label>
          <Textarea id="c" rows={4} value={f.concept} onChange={(e) => setF({ ...f, concept: e.target.value })} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label htmlFor="mp">Music-generation prompt</Label><Regen busy={busy === "prompt"} onClick={() => run("prompt")} label="prompt" /></div>
          <Textarea id="mp" rows={5} value={f.music_prompt} onChange={(e) => setF({ ...f, music_prompt: e.target.value })} />
        </div>
      </section>
      <section className="surface space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Lyrics</h2>
          <Regen busy={busy === "lyrics"} onClick={() => run("lyrics")} label="lyrics" />
        </div>
        <Textarea rows={22} aria-label="Lyrics" className="font-sans leading-relaxed" value={f.lyrics} onChange={(e) => setF({ ...f, lyrics: e.target.value })} />
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => run("all")} disabled={!!busy}><RefreshCw /> Regenerate everything</Button>
          <Button variant="outline" onClick={() => downloadText(`${f.title}.txt`, `${f.title}\n\n${f.lyrics}\n\n--- Music prompt ---\n${f.music_prompt}`)}><Download /> Export</Button>
          <Button variant="secondary" onClick={() => update.mutate(f, { onSuccess: () => toast.success("Saved") })} disabled={update.isPending}>Save edits</Button>
          <Button variant="hero" onClick={() => update.mutate(f, { onSuccess: onNext })}>Make the music →</Button>
        </div>
      </section>
    </div>
  );
}

function Regen({ busy, onClick, label }: { busy: boolean; onClick: () => void; label: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={busy} aria-label={`Regenerate ${label}`}>
      <RefreshCw className={busy ? "animate-spin" : ""} /> {busy ? "Working…" : "Regenerate"}
    </Button>
  );
}
