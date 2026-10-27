import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/Brand";
import { SPOTIFY_LINKS } from "@/components/studio/DistributeStep";

export const Route = createFileRoute("/spotify")({
  head: () => ({
    meta: [
      { title: "Releasing on Spotify — MemoryMelody" },
      { name: "description", content: "How to get your MemoryMelody song onto Spotify through an approved distributor." },
      { property: "og:title", content: "Releasing on Spotify — MemoryMelody" },
      { property: "og:description", content: "How to get your MemoryMelody song onto Spotify through an approved distributor." },
    ],
  }),
  component: SpotifyGuide,
});

const steps = [
  ["Finish your package", "Final audio (MP3/WAV), square cover art, credits, lyrics and the rights checklist — all prepared in MemoryMelody."],
  ["Pick an approved distributor", "Spotify accepts music through distributors and labels listed in its provider directory. Compare fees, payout splits and AI-music policies."],
  ["Upload & review", "Upload your exported files and metadata to the distributor. Review everything — MemoryMelody never submits without your explicit confirmation."],
  ["Claim Spotify for Artists", "After delivery, claim your profile to pitch the song, see listener stats and update your bio."],
  ["Get paid", "Royalties are collected and paid by your distributor, not by Spotify directly or by MemoryMelody."],
];

function SpotifyGuide() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-4xl font-semibold">Releasing your song on Spotify</h1>
      <p className="text-muted-foreground">Spotify doesn't offer a way for general third-party apps to upload music. Releases go through an approved distributor. Here's the honest path.</p>
      <ol className="space-y-3">
        {steps.map(([t, d], i) => (
          <li key={t} className="surface flex gap-4 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-gold font-bold text-gold-foreground">{i + 1}</span>
            <div><h2 className="text-lg font-semibold">{t}</h2><p className="text-sm text-muted-foreground">{d}</p></div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-3">
        <Button variant="hero" asChild><a href={SPOTIFY_LINKS.providers} target="_blank" rel="noreferrer">Provider directory <ExternalLink /></a></Button>
        <Button variant="outline" asChild><a href={SPOTIFY_LINKS.artists} target="_blank" rel="noreferrer">Spotify for Artists <ExternalLink /></a></Button>
        <Button variant="ghost" asChild><Link to="/">Back to my songs</Link></Button>
      </div>
      <Disclaimer />
    </div>
  );
}
