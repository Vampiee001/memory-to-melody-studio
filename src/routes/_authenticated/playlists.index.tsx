import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ListMusic, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { playlistsQuery } from "@/lib/playlists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/playlists/")({
  head: () => ({ meta: [{ title: "Playlists — MemoryMelody" }, { name: "description", content: "Organise your memory songs into playlists." }] }),
  component: PlaylistsPage,
});

function PlaylistsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery(playlistsQuery());
  const [title, setTitle] = useState("");

  async function create() {
    const { data: row, error } = await supabase.from("playlists").insert({ title: title.trim() || "New playlist" }).select("id").single();
    if (error || !row) { toast.error("Couldn't create playlist."); return; }
    setTitle("");
    qc.invalidateQueries({ queryKey: ["playlists"] });
    nav({ to: "/playlists/$id", params: { id: row.id } });
  }
  async function remove(id: string) {
    if (!confirm("Delete this playlist? Songs stay in your library.")) return;
    const { error } = await supabase.from("playlists").delete().eq("id", id);
    if (error) toast.error("Couldn't delete."); else qc.invalidateQueries({ queryKey: ["playlists"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-4xl font-semibold">Playlists</h1>
      <form className="surface flex gap-2 p-4" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <Input aria-label="New playlist title" placeholder="New playlist title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" variant="hero"><Plus /> Create</Button>
      </form>
      {isLoading ? <Skeleton className="h-40 rounded-3xl" /> : error ? <p className="text-destructive">Playlists couldn't be loaded.</p> : !data?.length ? (
        <div className="surface p-10 text-center text-muted-foreground"><ListMusic className="mx-auto mb-3 size-8" />No playlists yet. Create one to group your songs.</div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.map((pl) => (
            <li key={pl.id} className="surface flex items-center justify-between gap-2 p-5">
              <Link to="/playlists/$id" params={{ id: pl.id }} className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-semibold">{pl.title}</p>
                <p className="text-sm text-muted-foreground">{(pl.playlist_items as unknown as { count: number }[])[0]?.count ?? 0} songs</p>
              </Link>
              <Button variant="ghost" size="icon" aria-label={`Delete ${pl.title}`} onClick={() => remove(pl.id)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
