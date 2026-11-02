import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getIntegrationStatus } from "@/lib/songs.functions";
import { CoverPanel } from "./CoverPanel";
import { Check, Circle, Download } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/projects";
import { checklistForProject, downloadText, isReleaseReady, releaseToCSV, type ReleaseMeta } from "@/lib/release";
import { LANGUAGES } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useProjectUpdate } from "./useProjectUpdate";
import { DISTRIBUTORS, DIRECT_PLATFORMS } from "@/lib/distribution";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ReleasePackageDownload } from "./ReleasePackageDownload";

export function ReleaseStep({ project: p, onNext }: { project: Project; onNext: () => void }) {
  const update = useProjectUpdate(p.id);
  const initial = p.release as ReleaseMeta;
  const [r, setR] = useState<ReleaseMeta>({ track_title: p.title, language: p.language ?? "English", ...initial });
  const status = useServerFn(getIntegrationStatus);
  const { data: integ } = useQuery({ queryKey: ["integrations"], queryFn: () => status() });

  const items = checklistForProject(p, r);
  const ready = isReleaseReady(items);
  const save = (extra = {}) => update.mutateAsync({ release: r, ...extra });

  const markExported = () => update.mutate({ release: r, package_exported_at: new Date().toISOString() });

  const pkg = () => ({
    ...r, lyrics: p.lyrics, music_prompt: p.music_prompt, audio_file: p.mastered_path ? `${r.track_title}-release.wav` : p.audio_path ? `${r.track_title}-preview` : null,
    mastering: p.mastering_status === "ready" ? p.mastering_engine : "none", beat_source: p.beat_source, beat_rights: p.beat_rights,
    cover_file: p.cover_path ? `${r.track_title}-cover-3000.jpg` : null, ai_generated: true, generated_with: "MemoryMelody",
    checklist: items.map((i) => ({ item: i.label, done: i.done })),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="surface space-y-4 p-6">
        <h2 className="text-2xl font-semibold">Release details</h2>
        <div className="space-y-2"><Label htmlFor="release-distributor">Distributor to Spotify & other stores</Label><Select value={DISTRIBUTORS.some(d => d.name === r.distributor_name) ? r.distributor_name : r.distributor_name ? "other" : "none"} onValueChange={v => setR({ ...r, distributor_name: v === "none" ? "" : v === "other" ? "Other distributor" : v })}><SelectTrigger id="release-distributor"><SelectValue placeholder="Choose a distributor" /></SelectTrigger><SelectContent><SelectItem value="none">Choose a distributor</SelectItem>{DISTRIBUTORS.map(d => <SelectItem key={d.name} value={d.name}>{d.name}</SelectItem>)}<SelectItem value="other">Other distributor / label</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">You → distributor → Spotify, Apple Music, Amazon Music and other supported stores. Check current fees, rights and AI-music acceptance. Selection does not connect an account or submit a release.</p>{DISTRIBUTORS.filter(d => d.name === r.distributor_name).map(d => <Button key={d.name} asChild variant="link"><a href={d.url} target="_blank" rel="noreferrer">Open {d.name} ↗</a></Button>)}</div>
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

        <CoverPanel project={p} artist={r.artist_name} configured={!!integ?.covers[0]?.configured} />

        <label className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <Checkbox className="mt-0.5" checked={!!r.ownership_declared} onCheckedChange={(v) => setR({ ...r, ownership_declared: !!v })} />
          <span>I declare I own or control the rights to this recording, lyrics, cover art and all source media, and that releasing it complies with the AI provider's terms.</span>
        </label>
        {p.package_exported_at && <p className="text-xs text-muted-foreground">Release package exported {new Date(p.package_exported_at).toLocaleString()} — exported files are not a submission.</p>}
        <ReleasePackageDownload project={p} release={r} ready={ready} onExport={markExported} />
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => save().then(() => toast.success("Saved"))}>Save</Button>
          <Button variant="outline" onClick={() => { downloadText(`${r.track_title}-release.json`, JSON.stringify(pkg(), null, 2), "application/json"); markExported(); }}><Download /> JSON</Button>
          <Button variant="outline" onClick={() => { downloadText(`${r.track_title}-release.csv`, releaseToCSV(r, { audio_status: p.audio_status, mastering: p.mastering_status, beat_source: p.beat_source }), "text/csv"); markExported(); }}><Download /> CSV</Button>
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
        <h3 className="border-t border-border pt-4 font-semibold">Other upload & earning options</h3>{DIRECT_PLATFORMS.map(platform => <div key={platform.name} className="border-b border-border pb-3"><Button asChild variant="link" className="px-0"><a href={platform.url} target="_blank" rel="noreferrer">{platform.name} ↗</a></Button><p className="text-xs text-muted-foreground">{platform.note}</p></div>)}<p className="text-xs text-muted-foreground">Availability, eligibility and income vary; no monetization is guaranteed.</p>
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
