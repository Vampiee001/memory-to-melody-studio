import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Download, ImagePlus, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { moveItem, playlistQuery } from "@/lib/playlists";
import { projectsQuery } from "@/lib/projects";
import { downloadText } from "@/lib/release";
import { currentUserId, signedUrl, uploadWithProgress } from "@/lib/upload";
import { useSignedUrl } from "@/components/studio/useSignedUrl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/playlists/$id")({
  head: () => ({ meta: [{ title: "Playlist — MemoryMelody" }, { name: "description", content: "Edit and play your playlist." }] }),
  component: PlaylistPage,
});

type Item = { id: string; position: number; project_id: string; projects: { id: string; title: string; audio_path: string | null; audio_status: string; mastered_path: string | null; mastering_status: string } | null };

function PlaylistPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: pl, isLoading, error } = useQuery(playlistQuery(id));
  const { data: library = [] } = useQuery(projectsQuery());
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [addId, setAddId] = useState("");
  const [playing, setPlaying] = useState<number | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cover = useSignedUrl("covers", pl?.cover_path);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["playlist", id] }); qc.invalidateQueries({ queryKey: ["playlists"] }); };

  useEffect(() => { if (pl) { setTitle(pl.title); setDesc(pl.description ?? ""); } }, [pl?.id]);

  const items = (pl?.items ?? []) as unknown as Item[];
  const playable = (i: Item) => i.projects?.audio_status === "ready" && !!i.projects.audio_path;

  useEffect(() => {
    if (playing === null) { setSrc(null); return; }
    const it = items[playing];
    if (!it) { setPlaying(null); return; }
    const pr = it.projects!;
    signedUrl("audio", pr.mastering_status === "ready" && pr.mastered_path ? pr.mastered_path : pr.audio_path).then(setSrc);
  }, [playing]);
  useEffect(() => { if (src) audioRef.current?.play().catch(() => {}); }, [src]);

  function next(from: number) {
    for (let i = from + 1; i < items.length; i++) if (playable(items[i]!)) { setPlaying(i); return; }
    setPlaying(null);
  }

  async function saveMeta() {
    const { error } = await supabase.from("playlists").update({ title: title.trim() || "Untitled playlist", description: desc }).eq("id", id);
    if (error) toast.error("Couldn't save."); else { toast.success("Saved"); refresh(); }
  }
  async function add() {
    if (!addId) return;
    const { error } = await supabase.from("playlist_items").insert({ playlist_id: id, project_id: addId, position: items.length });
    if (error) toast.error("Couldn't add song."); else { setAddId(""); refresh(); }
  }
  async function removeItem(itemId: string) {
    const { error } = await supabase.from("playlist_items").delete().eq("id", itemId);
    if (error) toast.error("Couldn't remove."); else refresh();
  }
  async function move(from: number, to: number) {
    const next = moveItem(items, from, to);
    if (next === items) return;
    const res = await Promise.all(next.map((it, i) => supabase.from("playlist_items").update({ position: i }).eq("id", it.id)));
    if (res.some((r) => r.error)) toast.error("Couldn't reorder."); refresh();
  }
  async function uploadCover(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) { toast.error("Use a JPG, PNG or WebP under 10 MB."); return; }
    try {
      const uid = await currentUserId();
      const path = `${uid}/playlists/${id}/cover-${Date.now()}.${file.type.split("/")[1]}`;
      await uploadWithProgress("covers", path, file);
      if (pl?.cover_path) await supabase.storage.from("covers").remove([pl.cover_path]);
      await supabase.from("playlists").update({ cover_path: path }).eq("id", id);
      refresh();
    } catch { toast.error("Cover upload failed."); }
  }
  function exportMeta() {
    downloadText(`${title}-playlist.json`, JSON.stringify({
      title, description: desc, tracks: items.map((i, n) => ({ position: n + 1, title: i.projects?.title, has_audio: i.projects ? playable(i) : false })),
      note: "Exported from MemoryMelody. This is not a Spotify playlist.",
    }, null, 2), "application/json");
  }

  if (isLoading) return <Skeleton className="h-96 rounded-[2rem]" />;
  if (error || !pl) return <p className="text-destructive">This playlist couldn't be loaded.</p>;
  const inList = new Set(items.map((i) => i.project_id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/playlists" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Playlists</Link>
      <section className="surface flex flex-col gap-5 p-6 sm:flex-row">
        <button onClick={() => fileRef.current?.click()} className="aspect-square w-40 shrink-0 overflow-hidden rounded-2xl border border-border bg-muted" aria-label="Upload playlist cover">
          {cover ? <img src={cover} alt="Playlist cover" className="h-full w-full object-cover" /> : <ImagePlus className="m-auto text-muted-foreground" />}
        </button>
        <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => uploadCover(e.target.files?.[0])} />
        <div className="flex-1 space-y-3">
          <Input aria-label="Playlist title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg font-semibold" />
          <Textarea aria-label="Description" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={saveMeta}>Save</Button>
            <Button variant="hero" disabled={!items.some(playable)} onClick={() => next(-1)}><Play /> Play all</Button>
            <Button variant="outline" onClick={exportMeta}><Download /> Export</Button>
          </div>
        </div>
      </section>

      {src && playing !== null && (
        <div className="surface space-y-2 p-4">
          <p className="text-sm">Now playing: <strong>{items[playing]?.projects?.title}</strong></p>
          <audio ref={audioRef} controls src={src} className="w-full" onEnded={() => next(playing)} aria-label="Playlist player" />
        </div>
      )}

      <section className="surface space-y-3 p-6">
        <div className="flex gap-2">
          <select aria-label="Add a song" className="flex-1 rounded-xl border border-border bg-background p-2 text-sm" value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Add a song from your library…</option>
            {library.filter((s) => !inList.has(s.id)).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </select>
          <Button onClick={add} disabled={!addId}>Add</Button>
        </div>
        {!items.length ? <p className="py-6 text-center text-sm text-muted-foreground">No songs yet.</p> : (
          <ol className="space-y-2">
            {items.map((it, i) => (
              <li key={it.id} className={`flex items-center gap-2 rounded-2xl p-3 ${playing === i ? "bg-primary/15" : "bg-muted"}`}>
                <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
                <Link to="/project/$id" params={{ id: it.project_id }} className="min-w-0 flex-1 truncate font-semibold">{it.projects?.title ?? "Deleted song"}</Link>
                {!playable(it) && <span className="text-xs text-muted-foreground">no audio</span>}
                <Button size="icon" variant="ghost" aria-label="Play" disabled={!playable(it)} onClick={() => setPlaying(i)}><Play /></Button>
                <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}><ArrowUp /></Button>
                <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}><ArrowDown /></Button>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => removeItem(it.id)}><Trash2 /></Button>
              </li>
            ))}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">Playlists are saved in MemoryMelody only — no Spotify playlist is created.</p>
      </section>
    </div>
  );
}
