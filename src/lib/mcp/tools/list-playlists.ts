import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_playlists",
  title: "List playlists",
  description: "List the signed-in user's playlists with the songs in each, in order.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("playlists")
      .select("id, title, description, updated_at, playlist_items(position, projects(id, title, audio_status))")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const playlists = (data ?? []).map((pl) => ({
      id: pl.id,
      title: pl.title,
      description: pl.description,
      updatedAt: pl.updated_at,
      tracks: (pl.playlist_items ?? [])
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((item) => {
          const proj = Array.isArray(item.projects) ? item.projects[0] : item.projects;
          return {
            songId: proj?.id ?? null,
            title: proj?.title ?? null,
            audioStatus: proj?.audio_status ?? null,
          };
        }),
    }));
    return {
      content: [{ type: "text", text: playlists.length ? `${playlists.length} playlist(s)` : "No playlists yet" }],
      structuredContent: { playlists },
    };
  },
});
