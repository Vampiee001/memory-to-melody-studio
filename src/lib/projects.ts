import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Project = Tables<"projects">;
export type Media = Tables<"project_media">;

export const projectsQuery = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const projectQuery = (id: string) =>
  queryOptions({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

export const mediaQuery = (id: string) =>
  queryOptions({
    queryKey: ["media", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_media").select("*").eq("project_id", id).order("position");
      if (error) throw error;
      const paths = data.map((m) => m.storage_path);
      const urls = paths.length ? (await supabase.storage.from("media").createSignedUrls(paths, 3600)).data ?? [] : [];
      return data.map((m, i) => ({ ...m, url: urls[i]?.signedUrl ?? null }));
    },
  });

export async function deleteProject(p: Project) {
  const { data: media } = await supabase.from("project_media").select("storage_path").eq("project_id", p.id);
  if (media?.length) await supabase.storage.from("media").remove(media.map((m) => m.storage_path));
  if (p.audio_path) await supabase.storage.from("audio").remove([p.audio_path]);
  if (p.cover_path) await supabase.storage.from("covers").remove([p.cover_path]);
  const { error } = await supabase.from("projects").delete().eq("id", p.id);
  if (error) throw error;
}

export const STAGE_LABEL: Record<string, string> = {
  memories: "Gathering memories",
  song: "Lyrics written",
  audio: "Audio ready",
  release: "Release prep",
};

export const DEMO_PROJECT = {
  title: "Lola's Kitchen Light",
  mood: "nostalgic",
  genre: "acoustic",
  vocal: "Female vocal",
  language: "Taglish",
  length_sec: 120,
  context:
    "Sunday lunches at my grandmother's house in Cebu — the smell of adobo, her humming old songs, cousins running around the mango tree. She passed last year and these are the photos we have left.",
  experience_summary:
    "A family's Sunday rituals centred on a grandmother's kitchen in Cebu: shared meals, laughter under a mango tree, and the quiet hum of her songs. The emotional core is gratitude mixed with the ache of her absence.",
  concept:
    "A gentle acoustic ballad that walks through one remembered Sunday, from morning market to evening goodbyes, ending with the narrator cooking her recipe for the next generation.",
  lyrics: `[Verse 1]
Morning light on the kitchen tile
You'd hum a tune and make me smile
Garlic, laurel, a pot that sings
Your hands remembered everything

[Pre-Chorus]
And I didn't know, I didn't know
How fast the Sundays go

[Chorus]
Leave the kitchen light on, Lola
I can still find my way home
Every song you never finished
I'll keep singing on my own

[Bridge]
Now I stir the pot the way you showed me
Little hands are watching me

[Final Chorus]
Leave the kitchen light on, Lola…`,
  music_prompt:
    "Warm acoustic folk ballad, 76 BPM, G major, fingerpicked nylon guitar, soft brushed percussion, light strings in chorus, intimate breathy female vocal, nostalgic and tender, builds gently into final chorus.",
};
