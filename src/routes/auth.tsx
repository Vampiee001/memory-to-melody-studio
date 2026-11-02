import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wave } from "@/components/Brand";

const safePath = (p?: string) => (p && p.startsWith("/") && !p.startsWith("//") ? p : "/");

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
  head: () => ({
    meta: [
      { title: "Sign in — MemoryMelody" },
      { name: "description", content: "Sign in to save your memory songs and release plans." },
      { property: "og:title", content: "Sign in — MemoryMelody" },
      { property: "og:description", content: "Sign in to save your memory songs and release plans." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: safePath(redirect) });
    });
    const { data } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_IN" && s) navigate({ to: safePath(redirect) });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, redirect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSent(true);
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { display_name: displayName.trim() } } });
        if (error) throw error;
        setSent(true);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google sign-in failed. Please try again.");
  }

  return (
    <div className="mx-auto mt-8 max-w-md surface p-8">
      <div className="mb-6 text-center">
        <Wave bars={7} className="mb-3" />
        <h1 className="text-3xl font-semibold">{mode === "in" ? "Welcome back" : mode === "reset" ? "Reset your password" : "Create your account"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your songs and uploads stay private to your account.</p>
      </div>
      {sent ? (
        <p className="rounded-2xl bg-accent p-4 text-center text-sm">
          {mode === "reset" ? "If an account exists for this email, you’ll receive a password reset link." : <>Check <strong>{email}</strong> for a confirmation link, then come back to sign in.</>}
          <Button variant="link" onClick={() => { setSent(false); setMode("in"); }}>Back to sign in</Button>
        </p>
      ) : (
        <>
          <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "up" && <div className="space-y-2"><Label htmlFor="signup-name">Display name</Label><Input id="signup-name" required autoComplete="name" maxLength={80} value={displayName} onChange={e => setDisplayName(e.target.value)} /></div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {mode !== "reset" && <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>}
            <Button type="submit" variant="hero" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "reset" ? "Send reset link" : "Create account"}
            </Button>
          </form>
          {mode === "in" && <Button variant="link" className="mt-3 w-full" onClick={() => setMode("reset")}>Forgot password?</Button>}
          <Button variant="ghost" className="mt-4 w-full text-center text-sm text-muted-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </Button>
        </>
      )}
    </div>
  );
}
