import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_songs",
  title: "List songs",
  description: "List the signed-in user's MemoryMelody song projects with their workflow stage and release status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("projects")
      .select("id, title, stage, distribution_status, mood, genre, language, length_sec, audio_status, mastering_status, cover_status, package_exported_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const songs = (data ?? []).map((p) => ({
      id: p.id,
      title: p.title,
      stage: p.stage,
      distributionStatus: p.distribution_status,
      mood: p.mood,
      genre: p.genre,
      language: p.language,
      lengthSec: p.length_sec,
      audioStatus: p.audio_status,
      masteringStatus: p.mastering_status,
      coverStatus: p.cover_status,
      packageExportedAt: p.package_exported_at,
      updatedAt: p.updated_at,
    }));
    return {
      content: [{ type: "text", text: songs.length ? `${songs.length} song(s)` : "No songs yet" }],
      structuredContent: { songs },
    };
  },
});
