import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleSlash, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getIntegrationStatus } from "@/lib/songs.functions";
import { supabase } from "@/integrations/supabase/client";
import { deleteProject } from "@/lib/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — MemoryMelody" }, { name: "description", content: "AI providers, distributor integration and privacy." }] }),
  component: SettingsPage,
});

function Row({ label, configured, note }: { label: string; configured: boolean; note: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl bg-muted p-4">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-muted-foreground">{note}</p>
      </div>
      {configured ? <Badge className="bg-success text-background"><CheckCircle2 className="mr-1 size-3" />Configured</Badge> : <Badge variant="outline"><CircleSlash className="mr-1 size-3" />Not configured</Badge>}
    </div>
  );
}

function SettingsPage() {
  const status = useServerFn(getIntegrationStatus);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["integrations"], queryFn: () => status() });

  async function deleteAll() {
    const { data: projects } = await supabase.from("projects").select("*");
    try {
      for (const p of projects ?? []) await deleteProject(p);
      toast.success("All projects and uploads deleted");
      qc.invalidateQueries();
    } catch { toast.error("Some items couldn't be deleted. Please retry."); }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-4xl font-semibold">Settings</h1>

      <section className="surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">AI services</h2>
        <p className="text-sm text-muted-foreground">Keys are stored securely on the server and are never sent to your browser.</p>
        {isLoading ? <Skeleton className="h-32" /> : (
          <>
            {data?.writers.map((w) => (
              <Row key={w.id} label={`Song writing — ${w.label}`} configured={w.configured}
                note={`Reads your story${w.images ? " and up to 4 photos" : ""}. ${w.video ? "" : "Video content isn't analyzed — only file names are used."}`} />
            ))}
            {data?.music.map((m) => (
              <Row key={m.id} label={`Music generation — ${m.label}`} configured={m.configured} note="30-second clips or full tracks up to ~3 minutes. Check the provider's terms for commercial use." />
            ))}
            {data?.beats.map((m) => <Row key={m.id} label={`Beat generation — ${m.label}`} configured={m.configured} note="Instrumental beats up to 30 seconds." />)}
            {data?.covers.map((m) => <Row key={m.id} label={`Cover art — ${m.label}`} configured={m.configured} note="Square artwork; your photos are only used if you pick one and confirm consent." />)}
            {data?.mastering.map((m) => <Row key={m.id} label={`Mastering — ${m.label}`} configured={m.configured} note="Needs MASTERING_API_URL and MASTERING_API_KEY secrets. Without it, only basic in-browser processing is available (clearly labelled, not professional mastering)." />)}
            <Row label="Spotify playlists (OAuth)" configured={!!data?.spotifyPlaylists} note="Not built in. Playlists stay in MemoryMelody; creating Spotify playlists needs a Spotify app (SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET) and OAuth wiring." />
          </>
        )}
      </section>

      <section className="surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Distributor integration</h2>
        {data?.distributors.map((d) => (
          <Row key={d.id} label={d.label} configured={d.configured} note="Only for users with an eligible, approved distributor API account." />
        ))}
        <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">To connect a distributor API</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Get partner/API access from a Spotify-approved distributor that offers it.</li>
            <li>Ask the app owner to add <code>DISTRIBUTOR_API_URL</code> and <code>DISTRIBUTOR_API_KEY</code> as project secrets.</li>
            <li>The adapter may need adjusting to match that distributor's API format.</li>
          </ol>
          <p className="mt-2">Without this, use the manual handoff on each song's Spotify step.</p>
        </div>
      </section>

      <section className="surface space-y-3 p-6">
        <h2 className="text-xl font-semibold">Privacy</h2>
        <p className="text-sm text-muted-foreground">Your uploads are private to your account. Photos are only sent to the AI writing service when you press “Analyze”. Delete a single song from your library, or everything here.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive"><Trash2 /> Delete all my projects & uploads</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything?</AlertDialogTitle>
              <AlertDialogDescription>All songs, photos, videos, audio and cover art will be permanently removed. This can't be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteAll}>Delete everything</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  );
}
