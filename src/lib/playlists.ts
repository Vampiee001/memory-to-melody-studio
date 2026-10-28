import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const playlistsQuery = () =>
  queryOptions({
    queryKey: ["playlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*, playlist_items(count)").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const playlistQuery = (id: string) =>
  queryOptions({
    queryKey: ["playlist", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("playlists").select("*").eq("id", id).single();
      if (error) throw error;
      const { data: items, error: e2 } = await supabase
        .from("playlist_items").select("id, position, project_id, projects(id, title, audio_path, audio_status, mastered_path, mastering_status, length_sec, genre, mood)")
        .eq("playlist_id", id).order("position");
      if (e2) throw e2;
      return { ...data, items: items ?? [] };
    },
  });

/** Reorder helper: move index `from` to `to`, returning new array. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it as T);
  return next;
}
