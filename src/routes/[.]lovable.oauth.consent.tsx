import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { supabaseOAuth } from "@/lib/supabase-oauth";
import { Button } from "@/components/ui/button";
import { Wave } from "@/components/Brand";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // SSR has no localStorage session and would redirect signed-in users.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { redirect: next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await supabaseOAuth.getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  head: () => ({
    meta: [
      { title: "Connect an app — MemoryMelody" },
      { name: "description", content: "Authorize an app to use MemoryMelody as you." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="mx-auto mt-12 max-w-md surface p-8 text-center">
      <Wave bars={7} className="mb-4" />
      <h1 className="text-xl font-semibold">This authorization request couldn't be loaded</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-4 text-sm text-muted-foreground">The link may have expired — start the connection again from the app you're connecting.</p>
    </div>
  ),
});

const SCOPE_LABELS: Record<string, string> = {
  openid: "Confirm your identity",
  email: "Share your email address",
  profile: "Share your basic profile",
};

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an app";
  const rawScopes = details?.scopes ?? (typeof details?.scope === "string" ? details.scope.split(" ").filter(Boolean) : []);
  const scopes = rawScopes.map((s) => SCOPE_LABELS[s] ?? `Additional permission requested: ${s}`);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await supabaseOAuth.approveAuthorization(authorization_id)
      : await supabaseOAuth.denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <div className="mx-auto mt-8 max-w-md surface p-8">
      <div className="mb-6 text-center">
        <Wave bars={7} className="mb-3" />
        <h1 className="text-2xl font-semibold">Connect {clientName} to MemoryMelody</h1>
        <p className="mt-2 text-sm text-muted-foreground">This lets {clientName} use this app as you.</p>
      </div>

      <div className="space-y-3 rounded-2xl bg-muted p-4 text-sm">
        <p className="font-semibold">{clientName} will be able to call this app's enabled tools while you are signed in.</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {scopes.map((s) => (
            <li key={s}>{s}</li>
          ))}
          <li>Read your songs, lyrics and playlists</li>
        </ul>
        <p className="text-xs text-muted-foreground">This does not bypass this app's permissions or backend policies.</p>
      </div>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <div className="mt-6 flex flex-col gap-2">
        <Button variant="hero" disabled={busy} onClick={() => decide(true)}>{busy ? "Please wait…" : "Approve"}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>Cancel connection</Button>
      </div>
    </div>
  );
}
