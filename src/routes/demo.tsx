import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Disclaimer, Wave } from "@/components/Brand";
import { DEMO_PROJECT as d } from "@/lib/projects";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Demo project — MemoryMelody" },
      { name: "description", content: "A sample MemoryMelody project showing a song concept, lyrics and music prompt." },
      { property: "og:title", content: "Demo project — MemoryMelody" },
      { property: "og:description", content: "A sample MemoryMelody project showing a song concept, lyrics and music prompt." },
    ],
  }),
  component: Demo,
});

function Demo() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div role="note" className="rounded-2xl border border-gold/50 bg-gold/10 p-4 text-sm">
        <strong className="text-gold">Demo project.</strong> This is sample content written to show the flow. No real media was uploaded and there is no generated audio.
      </div>
      <div className="surface p-6 sm:p-8">
        <div className="flex flex-wrap gap-2">
          {[d.mood, d.genre, d.vocal, d.language].map((t) => <Badge key={t} variant="secondary" className="capitalize">{t}</Badge>)}
        </div>
        <h1 className="mt-4 text-4xl font-semibold">{d.title}</h1>
        <Wave bars={12} className="mt-3" />
        <h2 className="mt-6 text-lg font-semibold text-gold">Memory context</h2>
        <p className="text-muted-foreground">{d.context}</p>
        <h2 className="mt-6 text-lg font-semibold text-gold">Experience summary</h2>
        <p className="text-muted-foreground">{d.experience_summary}</p>
        <h2 className="mt-6 text-lg font-semibold text-gold">Concept</h2>
        <p className="text-muted-foreground">{d.concept}</p>
        <h2 className="mt-6 text-lg font-semibold text-gold">Lyrics</h2>
        <pre className="whitespace-pre-wrap font-sans leading-relaxed">{d.lyrics}</pre>
        <h2 className="mt-6 text-lg font-semibold text-gold">Music prompt</h2>
        <p className="rounded-2xl bg-muted p-4 text-sm">{d.music_prompt}</p>
      </div>
      <Button asChild variant="hero" size="lg"><Link to="/studio/new">Make your own</Link></Button>
      <Disclaimer />
    </div>
  );
}
