import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Music2, Sparkles, Trash2, Image as ImageIcon, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import hero from "@/assets/hero.jpg";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Disclaimer, Wave } from "@/components/Brand";
import { projectsQuery, deleteProject, STAGE_LABEL, DEMO_PROJECT, type Project } from "@/lib/projects";
import { DISTRIBUTION_LABELS, type DistributionStatus } from "@/lib/release";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MemoryMelody — your memories, as an original song" },
      { name: "description", content: "Upload photos and clips, get original lyrics and music, and prepare a Spotify-ready release." },
      { property: "og:title", content: "MemoryMelody — your memories, as an original song" },
      { property: "og:description", content: "Upload photos and clips, get original lyrics and music, and prepare a Spotify-ready release." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, loading } = useAuth();
  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-border shadow-glow">
        <img src={hero} alt="" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        <div className="relative flex min-h-[420px] flex-col justify-end gap-5 p-6 sm:p-10">
          <Wave bars={9} />
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl">
            Your memories, <span className="text-gradient-gold">sung back to you.</span>
          </h1>
          <p className="max-w-xl text-muted-foreground sm:text-lg">
            Upload the photos and clips that matter. We'll write an original song about them — and walk you through releasing it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="hero" size="lg" className="h-auto min-h-12 whitespace-normal py-3">
              <Link to={user ? "/studio/new" : "/auth"}><Sparkles /> Create a song from your memories</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/demo">Hear the demo project</Link>
            </Button>
          </div>
        </div>
      </section>

      {loading ? null : user ? <Library /> : <HowItWorks />}
      <Disclaimer />
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { icon: ImageIcon, t: "Share memories", d: "Photos, video clips and the story behind them." },
    { icon: Music2, t: "Get your song", d: "Original lyrics, a concept and real AI-composed audio." },
    { icon: Rocket, t: "Release it", d: "Credits, rights checklist and a distributor handoff for Spotify." },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {steps.map((s) => (
        <div key={s.t} className="surface p-6">
          <s.icon className="mb-3 size-6 text-gold" />
          <h3 className="text-xl font-semibold">{s.t}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
        </div>
      ))}
    </section>
  );
}

function Library() {
  const { data, isLoading, error } = useQuery(projectsQuery());
  return (
    <section aria-labelledby="lib" className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 id="lib" className="text-2xl font-semibold">Your library</h2>
        <Button asChild variant="gold" size="sm"><Link to="/studio/new"><Plus /> New song</Link></Button>
      </div>
      {error && <p className="text-destructive">Couldn't load your projects.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/demo" className="surface group block p-5 transition hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-gold text-gold">Demo · sample only</Badge>
            <Wave bars={4} />
          </div>
          <h3 className="mt-4 text-xl font-semibold">{DEMO_PROJECT.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{DEMO_PROJECT.concept}</p>
        </Link>
        {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-[1.75rem]" />)}
        {data?.map((p) => <ProjectCard key={p.id} p={p} />)}
      </div>
      {data && data.length === 0 && (
        <div className="surface p-8 text-center">
          <Music2 className="mx-auto mb-3 size-8 text-gold" />
          <p className="font-display text-xl">No songs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Start with a handful of photos and a few words about what they mean to you.</p>
        </div>
      )}
    </section>
  );
}

function ProjectCard({ p }: { p: Project }) {
  const qc = useQueryClient();
  return (
    <div className="surface relative p-5">
      <Link to="/project/$id" params={{ id: p.id }} className="block">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{STAGE_LABEL[p.stage] ?? p.stage}</Badge>
          <Badge variant="outline">{DISTRIBUTION_LABELS[p.distribution_status as DistributionStatus]}</Badge>
        </div>
        <h3 className="mt-4 text-xl font-semibold">{p.title}</h3>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{[p.mood, p.genre].filter(Boolean).join(" · ") || "Not styled yet"}</p>
      </Link>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label={`Delete ${p.title}`}><Trash2 /></Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{p.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the project, uploaded photos/videos, audio and cover art.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                try { await deleteProject(p); toast.success("Project deleted"); qc.invalidateQueries({ queryKey: ["projects"] }); }
                catch { toast.error("Couldn't delete the project"); }
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
