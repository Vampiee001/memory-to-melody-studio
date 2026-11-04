import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSongsTool from "./tools/list-projects";
import getSongTool from "./tools/get-project";
import listPlaylistsTool from "./tools/list-playlists";

// Vite inlines the stable ref; the published SUPABASE_URL may be a proxy.
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "memory-to-melody-studio",
  title: "Memory To Melody Studio",
  version: "0.1.0",
  instructions:
    "Tools for MemoryMelody, an app that turns photos and videos into original songs and prepares them for release. Use list_songs to see the caller's song projects, get_song for lyrics, concept and release metadata, and list_playlists for their playlists. All data is scoped to the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSongsTool, getSongTool, listPlaylistsTool],
});
