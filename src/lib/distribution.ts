export const DISTRIBUTORS = [
  { name: "DistroKid", url: "https://distrokid.com/" },
  { name: "TuneCore", url: "https://www.tunecore.com/" },
  { name: "CD Baby", url: "https://cdbaby.com/" },
  { name: "LANDR", url: "https://www.landr.com/music-distribution/" },
  { name: "Amuse", url: "https://www.amuse.io/" },
] as const;
export const DIRECT_PLATFORMS = [
  { name: "Bandcamp", url: "https://bandcamp.com/", note: "Direct music sales; check its AI-content policy before uploading." },
  { name: "SoundCloud for Artists", url: "https://artists.soundcloud.com/", note: "Uploads and eligible monetization; plan, rights and content rules apply." },
  { name: "YouTube", url: "https://www.youtube.com/", note: "Music videos and eligible channel monetization; partner-program and originality rules apply." },
] as const;