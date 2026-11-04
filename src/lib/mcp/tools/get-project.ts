import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_song",
  title: "Get song details",
  description: "Get one of the signed-in user's songs, including lyrics, concept, music prompt, release metadata and rights checklist.",
  inputSchema: { songId: z.string().uuid().describe("The song project ID, from list_songs.") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ songId }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data: p, error } = await supabase.from("projects").select("*").eq("id", songId).maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!p) return { content: [{ type: "text", text: "Song not found." }], isError: true };
    const song = {
      id: p.id,
      title: p.title,
      stage: p.stage,
      distributionStatus: p.distribution_status,
      mood: p.mood,
      genre: p.genre,
      vocal: p.vocal,
      language: p.language,
      lengthSec: p.length_sec,
      experienceSummary: p.experience_summary,
      concept: p.concept,
      lyrics: p.lyrics,
      musicPrompt: p.music_prompt,
      audioStatus: p.audio_status,
      audioError: p.audio_error,
      masteringStatus: p.mastering_status,
      masteringEngine: p.mastering_engine,
      coverStatus: p.cover_status,
      release: p.release,
      rightsChecklist: p.rights_checklist,
      packageExportedAt: p.package_exported_at,
      updatedAt: p.updated_at,
    };
    return {
      content: [{ type: "text", text: `${p.title} — stage: ${p.stage}, distribution: ${p.distribution_status}` }],
      structuredContent: { song },
    };
  },
});
