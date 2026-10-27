import { useEffect, useRef, useState } from "react";
import { Check, Circle, Download, ImagePlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Project } from "@/lib/projects";
import { buildReleaseChecklist, downloadText, isReleaseReady, releaseToCSV, type ReleaseMeta } from "@/lib/release";
import { LANGUAGES } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjectUpdate } from "./useProjectUpdate";

export function ReleaseStep({ project: p, onNext }: { project: Project; onNext: () => void }) {
  const update = useProjectUpdate(p.id);
  const initial = p.release as ReleaseMeta;
  const [r, setR] = useState<ReleaseMeta>({ track_title: p.title, language: p.language ?? "English", ...initial });
  const [cover, setCover] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (p.cover_path) supabase.storage.from("covers").createSignedUrl(p.cover_path, 3600).then(({ data }) => setCover(data?.signedUrl ?? null));
  }, [p.cover_path]);

  const items = buildReleaseChecklist({
    release: r, lyrics: p.lyrics, audioReady: p.audio_status === "ready", coverPath: p.cover_path,
    rights: (p.rights_checklist ?? {}) as Record<string, boolean>,
  });
  const ready = isReleaseReady(items);
  const save = (extra = {}) => update.mutateAsync({ release: r, ...extra });

  async function uploadCover(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error("Cover must be a JPG or PNG under 10 MB.");
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const path = `${u.user!.id}/${p.id}/cover-${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await supabase.storage.from("covers").upload(path, file, { contentType: file.type });
    if (error) { toast.error("Cover upload failed"); return; }
    if (p.cover_path) await supabase.storage.from("covers").remove([p.cover_path]);
    await update.mutateAsync({ cover_path: path });
    toast.success("Cover uploaded");
  }

  const pkg = () => ({
    ...r, lyrics: p.lyrics, music_prompt: p.music_prompt, audio_file: p.audio_path ? `${r.track_title}.mp3` : null,
    cover_file: p.cover_path ? "cover" : null, ai_generated: true, generated_with: "MemoryMelody",
    checklist: items.map((i) => ({ item: i.label, done: i.done })),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="surface space-y-4 p-6">
        <h2 className="text-2xl font-semibold">Release details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="artist" label="Artist name" value={r.artist_name} onChange={(v) => setR({ ...r, artist_name: v })} />
          <Field id="track" label="Track title" value={r.track_title} onChange={(v) => setR({ ...r, track_title: v })} />
          <div className="space-y-2">
            <Label htmlFor="date">Release date</Label>
            <Input id="date" type="date" value={r.release_date ?? ""} onChange={(e) => setR({ ...r, release_date: e.target.value })} />
            <p className="text-xs text-muted-foreground">Distributors usually need 2–4 weeks of lead time.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lang">Language</Label>
            <Input id="lang" list="langs" value={r.language ?? ""} onChange={(e) => setR({ ...r, language: e.target.value })} />
            <datalist id="langs">{LANGUAGES.map((l) => <option key={l} value={l} />)}</datalist>
          </div>
          <Field id="sw" label="Songwriter credits" placeholder="Your legal name(s)" value={r.songwriters} onChange={(v) => setR({ ...r, songwriters: v })} />
          <Field id="pr" label="Producer credits" value={r.producers} onChange={(v) => setR({ ...r, producers: v })} />
        </div>
        <label className="flex items-center justify-between rounded-2xl bg-muted p-4 text-sm">
          <span>Explicit content</span>
          <Switch checked={!!r.explicit} onCheckedChange={(v) => setR({ ...r, explicit: v })} aria-label="Explicit content" />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <div className="size-28 overflow-hidden rounded-2xl border border-border bg-muted">
            {cover ? <img src={cover} alt="Cover art" className="h-full w-full object-cover" /> : <ImagePlus className="m-auto mt-10 text-muted-foreground" />}
          </div>
          <div className="space-y-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><ImagePlus /> Upload cover art</Button>
            <Button variant="ghost" size="sm" disabled title="Requires an image-generation provider"><Wand2 /> Generate cover (coming soon)</Button>
            <p className="text-xs text-muted-foreground">Square JPG/PNG, 3000×3000 px recommended.</p>
          </div>
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png" onChange={(e) => uploadCover(e.target.files?.[0])} />
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <Checkbox className="mt-0.5" checked={!!r.ownership_declared} onCheckedChange={(v) => setR({ ...r, ownership_declared: !!v })} />
          <span>I declare I own or control the rights to this recording, lyrics, cover art and all source media, and that releasing it complies with the AI provider's terms.</span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => save().then(() => toast.success("Saved"))}>Save</Button>
          <Button variant="outline" onClick={() => downloadText(`${r.track_title}-release.json`, JSON.stringify(pkg(), null, 2), "application/json")}><Download /> JSON</Button>
          <Button variant="outline" onClick={() => downloadText(`${r.track_title}-release.csv`, releaseToCSV(r, { audio_status: p.audio_status }), "text/csv")}><Download /> CSV</Button>
          <Button variant="outline" onClick={() => downloadText(`${r.track_title}-lyrics.txt`, p.lyrics ?? "")}><Download /> Lyrics</Button>
        </div>
      </section>

      <section className="surface space-y-3 p-6" aria-labelledby="cl">
        <h2 id="cl" className="text-xl font-semibold">Release checklist</h2>
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-2 text-sm">
              {i.done ? <Check className="size-4 text-success" aria-label="done" /> : <Circle className="size-4 text-muted-foreground" aria-label="to do" />}
              <span className={i.done ? "" : "text-muted-foreground"}>{i.label}</span>
            </li>
          ))}
        </ul>
        <Button variant="hero" className="w-full" disabled={!ready}
          onClick={async () => { await save({ distribution_status: p.distribution_status === "draft" ? "ready" : p.distribution_status }); onNext(); }}>
          {ready ? "Mark ready to distribute →" : `${items.filter((i) => !i.done).length} items left`}
        </Button>
        <Button variant="ghost" className="w-full" onClick={async () => { await save(); onNext(); }}>Go to Spotify guide</Button>
      </section>
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value?: string | undefined; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
