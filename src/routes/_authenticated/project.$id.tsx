import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { projectQuery } from "@/lib/projects";
import { Skeleton } from "@/components/ui/skeleton";
import { MemoriesStep } from "@/components/studio/MemoriesStep";
import { SongStep } from "@/components/studio/SongStep";
import { AudioStep } from "@/components/studio/AudioStep";
import { ReleaseStep } from "@/components/studio/ReleaseStep";
import { DistributeStep } from "@/components/studio/DistributeStep";
import { Disclaimer } from "@/components/Brand";

export const Route = createFileRoute("/_authenticated/project/$id")({
  head: () => ({ meta: [{ title: "Song studio — MemoryMelody" }, { name: "description", content: "Create, edit and release your memory song." }] }),
  component: ProjectPage,
});

const STEPS = ["Memories", "Song", "Audio", "Release", "Spotify"] as const;
export type Step = (typeof STEPS)[number];

function ProjectPage() {
  const { id } = Route.useParams();
  const { data: p, isLoading, error } = useQuery(projectQuery(id));
  const [step, setStep] = useState<number | null>(null);
  if (isLoading) return <Skeleton className="h-96 rounded-[2rem]" />;
  if (error || !p) return <p className="text-destructive">This project couldn't be loaded.</p>;
  const initial = { memories: 0, song: 1, audio: 2, release: 3 }[p.stage] ?? 0;
  const current = step ?? initial;
  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Library</Link>
      <h1 className="text-3xl font-semibold sm:text-4xl">{p.title}</h1>
      <nav aria-label="Song steps" className="-mx-4 overflow-x-auto px-4">
        <ol className="flex min-w-max gap-2">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                onClick={() => go(i)}
                aria-current={i === current ? "step" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${i === current ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
              >
                <span className="mr-1 opacity-60">{i + 1}</span>{s}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      {current === 0 && <MemoriesStep project={p} onNext={() => go(1)} />}
      {current === 1 && <SongStep project={p} onNext={() => go(2)} />}
      {current === 2 && <AudioStep project={p} onNext={() => go(3)} />}
      {current === 3 && <ReleaseStep project={p} onNext={() => go(4)} />}
      {current === 4 && <DistributeStep project={p} />}
      <Disclaimer />
    </div>
  );
}
