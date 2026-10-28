import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ImagePlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { mediaQuery, type Project } from "@/lib/projects";
import { generateCover } from "@/lib/songs.functions";
import { composeCover, type CoverText } from "@/lib/cover";
import { currentUserId, signedUrl, uploadWithProgress } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useRefreshProject } from "./useProjectUpdate";
import { useSignedUrl } from "./useSignedUrl";

/** Render final 3000x3000 cover from a source in `covers` bucket and save as cover_path. */
export async function finalizeCover(p: Pick<Project, "id" | "cover_path">, sourcePath: string, text: CoverText) {
  const src = await signedUrl("covers", sourcePath);
  if (!src) throw new Error("Couldn't load the artwork.");
  const blob = await (await fetch(src)).blob();
  const out = await composeCover(blob, text);
  const uid = await currentUserId();
  const path = `${uid}/${p.id}/cover-${Date.now()}.jpg`;
  await uploadWithProgress("covers", path, out);
  if (p.cover_path && p.cover_path !== sourcePath) await supabase.storage.from("covers").remove([p.cover_path]);
  const { error } = await supabase.from("projects").update({ cover_path: path, cover_text: text, cover_status: "ready" }).eq("id", p.id);
  if (error) throw error;
}

export function CoverPanel({ project: p, artist, configured }: { project: Project; artist?: string | undefined; configured: boolean }) {
  const gen = useServerFn(generateCover);
  const refresh = useRefreshProject(p.id);
  const { data: media = [] } = useQuery(mediaQuery(p.id));
  const photos = media.filter((m) => m.kind === "image" && !m.mime_type.includes("hei"));
  const saved = (p.cover_text ?? {}) as CoverText;
  const [mode, setMode] = useState<"generate" | "upload">(p.cover_source === "uploaded" ? "upload" : "generate");
  const [text, setText] = useState<CoverText>({ title: saved.title ?? p.title, artist: saved.artist ?? artist ?? "", showText: saved.showText ?? true });
  const [refId, setRefId] = useState<string>("");
  const [refConsent, setRefConsent] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cover = useSignedUrl("covers", p.cover_path);

  async function doGenerate() {
    setBusy("Generating artwork…");
    try {
      const r = await gen({ data: { projectId: p.id, referenceMediaId: refId || null, referenceConsent: refConsent } });
      if (!r.ok) { toast.error(r.error); return; }
      setBusy("Adding title text…");
      await finalizeCover(p, r.path, text);
      toast.success("Cover ready");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Cover failed"); }
    finally { setBusy(null); refresh(); }
  }

  async function doUpload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { toast.error("Use a JPG, PNG or WebP under 10 MB."); return; }
    setBusy("Uploading…");
    try {
      const uid = await currentUserId();
      const path = `${uid}/${p.id}/art-upload-${Date.now()}.${file.type.split("/")[1]}`;
      await uploadWithProgress("covers", path, file);
      if (p.cover_art_path) await supabase.storage.from("covers").remove([p.cover_art_path]);
      await supabase.from("projects").update({ cover_art_path: path, cover_source: "uploaded" }).eq("id", p.id);
      await finalizeCover(p, path, text);
      toast.success("Cover ready");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
    finally { setBusy(null); refresh(); }
  }

  async function reapplyText() {
    if (!p.cover_art_path) return;
    setBusy("Updating text…");
    try { await finalizeCover(p, p.cover_art_path, text); toast.success("Cover updated"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
    finally { setBusy(null); refresh(); }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border p-5">
      <h3 className="text-lg font-semibold">Cover art</h3>
      <div role="radiogroup" aria-label="Cover source" className="grid grid-cols-2 gap-2">
        {(["generate", "upload"] as const).map((c) => (
          <button key={c} role="radio" aria-checked={mode === c} onClick={() => setMode(c)}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold transition ${mode === c ? "bg-gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {c === "generate" ? "Auto-generate cover" : "Upload cover image"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl border border-border bg-muted">
          {cover ? <img src={cover} alt="Cover art preview" className="h-full w-full object-cover" /> : <ImagePlus className="m-auto mt-20 text-muted-foreground" />}
        </div>
        <div className="flex-1 space-y-3">
          <div className="space-y-1"><Label htmlFor="ct">Title on cover</Label><Input id="ct" value={text.title ?? ""} onChange={(e) => setText({ ...text, title: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="ca">Artist on cover</Label><Input id="ca" value={text.artist ?? ""} onChange={(e) => setText({ ...text, artist: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><Switch checked={text.showText !== false} onCheckedChange={(v) => setText({ ...text, showText: v })} /> Show text on cover</label>
          {p.cover_art_path && <Button size="sm" variant="ghost" onClick={reapplyText} disabled={!!busy}>Apply text changes</Button>}
        </div>
      </div>

      {mode === "generate" ? (
        configured ? (
          <div className="space-y-3">
            {photos.length > 0 && (
              <div className="space-y-2 text-sm">
                <Label htmlFor="ref">Inspire from one of my photos (optional)</Label>
                <select id="ref" className="w-full rounded-xl border border-border bg-background p-2" value={refId} onChange={(e) => { setRefId(e.target.value); setRefConsent(false); }}>
                  <option value="">No photo — artwork from the song only</option>
                  {photos.map((m) => <option key={m.id} value={m.id}>{m.file_name}</option>)}
                </select>
                {refId && (
                  <label className="flex items-start gap-2">
                    <Checkbox className="mt-0.5" checked={refConsent} onCheckedChange={(v) => setRefConsent(!!v)} />
                    <span>Everyone recognisable in this photo agreed to it being used for public cover art.</span>
                  </label>
                )}
              </div>
            )}
            <Button variant="outline" onClick={doGenerate} disabled={!!busy || (!!refId && !refConsent)}><Wand2 /> {busy ?? (p.cover_path ? "Regenerate cover" : "Generate cover")}</Button>
          </div>
        ) : <p className="text-sm text-muted-foreground">No image-generation provider is connected. Upload a cover instead.</p>
      ) : (
        <>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!!busy}><ImagePlus /> {busy ?? (p.cover_path ? "Replace image" : "Upload image")}</Button>
          <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { doUpload(e.target.files?.[0]); e.target.value = ""; }} />
        </>
      )}
      {p.cover_status === "failed" && <p role="alert" className="text-sm text-destructive">{p.cover_error}</p>}
      {cover && <Button size="sm" variant="ghost" asChild><a href={cover} download={`${p.title}-cover-3000.jpg`}><Download /> Download 3000×3000 JPG</a></Button>}
      <p className="text-xs text-muted-foreground">Exported as a square 3000×3000 JPG, the size most distributors ask for.</p>
    </div>
  );
}
