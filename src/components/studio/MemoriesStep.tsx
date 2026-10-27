import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Film, Upload, X, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mediaQuery, type Project } from "@/lib/projects";
import { formatBytes, GENRES, LANGUAGES, LENGTHS, MOODS, validateMediaFile, VOCALS } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProjectUpdate } from "./useProjectUpdate";

type Uploading = { id: string; name: string; progress: number; error?: string };

function uploadWithProgress(path: string, file: File, token: string, onProgress: (n: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${import.meta.env["VITE_SUPABASE_URL"]}/storage/v1/object/media/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}

export function MemoriesStep({ project: p, onNext }: { project: Project; onNext: () => void }) {
  const qc = useQueryClient();
  const update = useProjectUpdate(p.id);
  const { data: media = [] } = useQuery(mediaQuery(p.id));
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const [form, setForm] = useState({
    title: p.title, context: p.context ?? "", mood: p.mood ?? "", genre: p.genre ?? "",
    vocal: p.vocal ?? "", language: p.language ?? "English", length_sec: p.length_sec ?? 30,
  });
  const [consent, setConsent] = useState(p.consent);
  const inputRef = useRef<HTMLInputElement>(null);
  const refreshMedia = () => qc.invalidateQueries({ queryKey: ["media", p.id] });

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!consent) { toast.error("Please confirm the consent box before uploading."); return; }
    const { data: s } = await supabase.auth.getSession();
    const token = s.session?.access_token;
    const uid = s.session?.user.id;
    if (!token || !uid) return;
    let count = media.length;
    for (const file of Array.from(files)) {
      const v = validateMediaFile(file, count);
      if (!v.ok) { toast.error(v.error); continue; }
      count++;
      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const path = `${uid}/${p.id}/${id}.${ext}`;
      setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
      try {
        await uploadWithProgress(path, file, token, (n) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress: n } : x))));
        const { error } = await supabase.from("project_media").insert({
          project_id: p.id, user_id: uid, storage_path: path, kind: v.kind, mime_type: file.type,
          size_bytes: file.size, file_name: file.name, position: count,
        });
        if (error) throw error;
        setUploads((u) => u.filter((x) => x.id !== id));
        refreshMedia();
      } catch (e) {
        setUploads((u) => u.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)));
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remove(m: (typeof media)[number]) {
    await supabase.storage.from("media").remove([m.storage_path]);
    const { error } = await supabase.from("project_media").delete().eq("id", m.id);
    if (error) toast.error("Couldn't remove file");
    refreshMedia();
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= media.length) return;
    const a = media[i], b = media[j];
    if (!a || !b) return;
    await Promise.all([
      supabase.from("project_media").update({ position: j }).eq("id", a.id),
      supabase.from("project_media").update({ position: i }).eq("id", b.id),
    ]);
    // normalize remaining positions
    refreshMedia();
  }

  async function save(next: boolean) {
    await update.mutateAsync({
      ...form, mood: form.mood || null, genre: form.genre || null, vocal: form.vocal || null,
      consent, consent_at: consent ? (p.consent_at ?? new Date().toISOString()) : null,
    });
    toast.success("Saved");
    if (next) onNext();
  }

  const canContinue = consent && (form.context.trim().length > 10 || media.length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="surface space-y-5 p-6" aria-labelledby="up">
        <h2 id="up" className="text-2xl font-semibold">Your memories</h2>
        <label className="flex items-start gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-4 text-sm">
          <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} className="mt-0.5" aria-describedby="consent-desc" />
          <span id="consent-desc">
            <ShieldCheck className="mr-1 inline size-4 text-gold" />
            I consent to MemoryMelody processing my uploads to write this song, and I confirm I only upload photos and videos I own or have permission to use (including from people shown in them).
          </span>
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
          disabled={!consent}
          className="flex w-full flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border p-8 text-center transition hover:border-primary disabled:opacity-50"
        >
          <Upload className="size-7 text-primary" />
          <span className="font-semibold">Add photos & video clips</span>
          <span className="text-xs text-muted-foreground">JPG, PNG, WEBP, HEIC up to 15 MB · MP4, MOV, WEBM up to 100 MB · max 20</span>
        </button>
        <input ref={inputRef} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm" onChange={(e) => onFiles(e.target.files)} />

        {uploads.map((u) => (
          <div key={u.id} className="space-y-1 text-sm" aria-live="polite">
            <div className="flex justify-between"><span className="truncate">{u.name}</span><span>{u.error ? "Failed" : `${u.progress}%`}</span></div>
            {u.error ? <p className="text-xs text-destructive">{u.error}</p> : <Progress value={u.progress} />}
          </div>
        ))}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {media.map((m, i) => (
            <li key={m.id} className="group relative overflow-hidden rounded-2xl border border-border bg-muted">
              {m.kind === "image" && m.url ? (
                <img src={m.url} alt={m.file_name} className="aspect-square w-full object-cover" loading="lazy" />
              ) : m.url ? (
                <video src={m.url} className="aspect-square w-full object-cover" muted playsInline preload="metadata" aria-label={m.file_name} />
              ) : <div className="aspect-square" />}
              {m.kind === "video" && <Film className="absolute left-2 top-2 size-4 text-gold" aria-hidden />}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/80 px-2 py-1 text-[11px]">
                <span>{formatBytes(m.size_bytes)}</span>
                <span className="flex gap-1">
                  <button onClick={() => move(i, -1)} aria-label={`Move ${m.file_name} earlier`} className="rounded p-1 hover:bg-accent"><ArrowUp className="size-3" /></button>
                  <button onClick={() => move(i, 1)} aria-label={`Move ${m.file_name} later`} className="rounded p-1 hover:bg-accent"><ArrowDown className="size-3" /></button>
                  <button onClick={() => remove(m)} aria-label={`Remove ${m.file_name}`} className="rounded p-1 hover:bg-destructive"><X className="size-3" /></button>
                </span>
              </div>
            </li>
          ))}
        </ul>
        {media.some((m) => m.kind === "video") && (
          <p className="text-xs text-muted-foreground">Note: video clips are stored with your project, but their content isn't analyzed — no video-understanding provider is configured. Describe them in your story below.</p>
        )}
      </section>

      <section className="surface space-y-4 p-6" aria-labelledby="st">
        <h2 id="st" className="text-2xl font-semibold">The story & sound</h2>
        <div className="space-y-2">
          <Label htmlFor="title">Working title</Label>
          <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ctx">What do these memories mean to you?</Label>
          <Textarea id="ctx" rows={5} placeholder="Who's there, where, what happened, how it felt…" value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} />
        </div>
        <Pills label="Mood" options={MOODS} value={form.mood} onChange={(mood) => setForm({ ...form, mood })} />
        <Pills label="Genre" options={GENRES} value={form.genre} onChange={(genre) => setForm({ ...form, genre })} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Pick label="Vocals" value={form.vocal} options={VOCALS.map((v) => ({ value: v, label: v }))} onChange={(vocal) => setForm({ ...form, vocal })} />
          <Pick label="Language" value={form.language} options={LANGUAGES.map((v) => ({ value: v, label: v }))} onChange={(language) => setForm({ ...form, language })} />
          <Pick label="Length" value={String(form.length_sec)} options={LENGTHS.map((l) => ({ value: String(l.value), label: l.label }))} onChange={(v) => setForm({ ...form, length_sec: Number(v) })} />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" onClick={() => save(false)} disabled={update.isPending}>Save</Button>
          <Button variant="hero" onClick={() => save(true)} disabled={!canContinue || update.isPending}>Analyze memories →</Button>
        </div>
        {!canContinue && <p className="text-xs text-muted-foreground">Confirm consent and add a few words or at least one file to continue.</p>}
      </section>
    </div>
  );
}

function Pills({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(value === o ? "" : o)}
            className={`rounded-full border px-3 py-1.5 text-sm capitalize transition ${value === o ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary"}`}>
            {o}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Pick({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}><SelectValue placeholder="Choose" /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
