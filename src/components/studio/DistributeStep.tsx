import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Info, Send, Radio } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@/lib/projects";
import { getIntegrationStatus, submitToDistributor } from "@/lib/songs.functions";
import { checklistForProject, canTransition, DISTRIBUTION_LABELS, isReleaseReady, type DistributionStatus, type ReleaseMeta } from "@/lib/release";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProjectUpdate, useRefreshProject } from "./useProjectUpdate";

export const SPOTIFY_LINKS = {
  providers: "https://artists.spotify.com/providers",
  artists: "https://artists.spotify.com/",
  help: "https://support.spotify.com/us/artists/article/getting-music-on-spotify/",
};

const ORDER: DistributionStatus[] = ["draft", "ready", "submitted", "live"];

export function DistributeStep({ project: p }: { project: Project }) {
  const status = useServerFn(getIntegrationStatus);
  const submit = useServerFn(submitToDistributor);
  const update = useProjectUpdate(p.id);
  const refresh = useRefreshProject(p.id);
  const { data: integ } = useQuery({ queryKey: ["integrations"], queryFn: () => status() });
  const r = p.release as ReleaseMeta;
  const st = p.distribution_status as DistributionStatus;
  const ready = isReleaseReady(checklistForProject(p, r));
  const api = integ?.distributors[0];
  const [review, setReview] = useState<null | "api" | "manual">(null);
  const [confirmed, setConfirmed] = useState(false);
  const [distName, setDistName] = useState(r.distributor_name ?? "");
  const [spotifyUrl, setSpotifyUrl] = useState(r.spotify_url ?? "");
  const [busy, setBusy] = useState(false);

  async function doSubmit() {
    if (!confirmed) return;
    setBusy(true);
    try {
      if (review === "api") {
        const res = await submit({ data: { projectId: p.id, confirmed } });
        if (!res.ok) toast.error(res.error); else toast.success("Submitted to your distributor");
        refresh();
      } else {
        await update.mutateAsync({ distribution_status: "submitted", release: { ...r, distributor_name: distName } });
        toast.success("Marked as submitted");
      }
      setReview(null);
    } finally { setBusy(false); setConfirmed(false); }
  }

  return (
    <div className="space-y-6">
      <section className="surface p-6" aria-label="Distribution status">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORDER.map((s, i) => (
            <li key={s} aria-current={s === st ? "step" : undefined}
              className={`rounded-2xl p-3 text-center text-sm font-semibold ${s === st ? "bg-gradient-primary text-primary-foreground shadow-glow" : ORDER.indexOf(st) > i ? "bg-accent" : "bg-muted text-muted-foreground"}`}>
              {DISTRIBUTION_LABELS[s]}
            </li>
          ))}
        </ol>
        {st === "draft" && !ready && <p className="mt-3 text-sm text-muted-foreground">Finish the release checklist in step 4 to become Ready to distribute.</p>}
        {st === "draft" && ready && <Button className="mt-3" variant="gold" onClick={() => update.mutate({ distribution_status: "ready" })}>Mark ready to distribute</Button>}
      </section>

      <div role="note" className="flex gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          <strong>How Spotify releases actually work:</strong> Spotify doesn't let general third-party apps upload tracks. Music reaches Spotify through an approved
          distributor (or label). MemoryMelody prepares your package and hands it off; your distributor delivers it to Spotify. Connecting to Spotify
          for Artists lets you manage your profile and pitch songs — it does not upload music.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">1 · Choose a distributor</h2>
          <p className="text-sm text-muted-foreground">Pick a Spotify-approved distributor, then upload the audio, cover and metadata you exported in step 4. Check their policy on AI-assisted music.</p>
          <Button variant="outline" asChild><a href={SPOTIFY_LINKS.providers} target="_blank" rel="noreferrer">Spotify's preferred provider directory <ExternalLink /></a></Button>
          <div className="space-y-2">
            <Label htmlFor="dn">Distributor you're using</Label>
            <Input id="dn" value={distName} onChange={(e) => setDistName(e.target.value)} onBlur={() => update.mutate({ release: { ...r, distributor_name: distName } })} placeholder="e.g. the one you chose" />
          </div>
          <div className="rounded-2xl bg-muted p-4 text-sm">
            <p className="font-semibold">Distributor API integration</p>
            {api?.configured ? (
              <p className="mt-1 text-success">Connected — submissions go to your configured distributor API after your final review.</p>
            ) : (
              <p className="mt-1 text-muted-foreground">Not connected. Automatic submission needs an eligible partner API account with an approved distributor. Without one, use the manual handoff below.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="hero" disabled={!canTransition(st, "submitted", ready) || !api?.configured} onClick={() => setReview("api")}><Send /> Submit via API</Button>
            <Button variant="outline" disabled={!canTransition(st, "submitted", ready)} onClick={() => setReview("manual")}>I submitted it manually</Button>
          </div>
        </section>

        <section className="surface space-y-4 p-6">
          <h2 className="text-xl font-semibold">2 · Spotify for Artists</h2>
          <p className="text-sm text-muted-foreground">Once your distributor delivers the release, claim your artist profile to see stats, edit your bio and pitch upcoming songs to editors.</p>
          <Button variant="outline" asChild><a href={SPOTIFY_LINKS.artists} target="_blank" rel="noreferrer">Open Spotify for Artists <ExternalLink /></a></Button>
          <Button variant="ghost" asChild><a href={SPOTIFY_LINKS.help} target="_blank" rel="noreferrer">Spotify's guide to getting music on Spotify <ExternalLink /></a></Button>
          <div className="space-y-2">
            <Label htmlFor="su">Spotify track link (once live)</Label>
            <Input id="su" value={spotifyUrl} onChange={(e) => setSpotifyUrl(e.target.value)} placeholder="https://open.spotify.com/track/…" />
          </div>
          <Button variant="gold" disabled={!canTransition(st, "live", ready) || !/^https:\/\/open\.spotify\.com\//.test(spotifyUrl)}
            onClick={() => update.mutate({ distribution_status: "live", release: { ...r, spotify_url: spotifyUrl } }, { onSuccess: () => toast.success("Congratulations — it's live!") })}>
            <Radio /> Mark as Live
          </Button>
          {st === "live" && r.spotify_url && <a className="block text-sm text-gold underline" href={r.spotify_url} target="_blank" rel="noreferrer">Listen on Spotify</a>}
        </section>
      </div>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Final review</DialogTitle>
            <DialogDescription>Check everything carefully — releases are hard to change once delivered.</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Artist</dt><dd>{r.artist_name}</dd>
            <dt className="text-muted-foreground">Title</dt><dd>{r.track_title}</dd>
            <dt className="text-muted-foreground">Release date</dt><dd>{r.release_date}</dd>
            <dt className="text-muted-foreground">Language</dt><dd>{r.language}</dd>
            <dt className="text-muted-foreground">Explicit</dt><dd>{r.explicit ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Songwriters</dt><dd>{r.songwriters}</dd>
            <dt className="text-muted-foreground">Producers</dt><dd>{r.producers || "—"}</dd>
            <dt className="text-muted-foreground">Route</dt><dd>{review === "api" ? api?.label : `Manual — ${distName || "distributor"}`}</dd>
          </dl>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox className="mt-0.5" checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} />
            <span>I've reviewed this release, I own the necessary rights, and I {review === "api" ? "authorize MemoryMelody to send it to my distributor" : "have submitted it through my distributor"}.</span>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReview(null)}>Cancel</Button>
            <Button variant="hero" disabled={!confirmed || busy} onClick={doSubmit}>{busy ? "Submitting…" : "Confirm"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
