import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route = createFileRoute("/reset-password")({ head: () => ({ meta: [{ title: "Reset password — MemoryMelody" }, { name: "description", content: "Securely choose a new password for your MemoryMelody account." }, { property: "og:title", content: "Reset password — MemoryMelody" }, { property: "og:description", content: "Securely choose a new account password." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }), component: ResetPassword });
function ResetPassword() {
  const [ready, setReady] = useState(false), [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    const recovery = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === "PASSWORD_RECOVERY" && session) setReady(true); });
    if (recovery) supabase.auth.getUser().then(({ data }) => setReady(!!data.user));
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) { e.preventDefault(); if (password !== confirm) { setError("Passwords do not match"); return; } setBusy(true); setError(""); const r = await supabase.auth.updateUser({ password }); setBusy(false); if (r.error) setError(r.error.message); else { setPassword(""); setConfirm(""); setDone(true); } }
  return <div className="mx-auto max-w-md space-y-5 py-12"><h1 className="text-3xl">Choose a new password</h1>{done ? <><p>Password updated successfully.</p><Button asChild variant="gold"><Link to="/">Return to your library</Link></Button></> : !ready ? <><p className="text-muted-foreground">Open the password reset link from your email. If it expired, request a new one.</p><Button asChild variant="outline"><Link to="/auth">Back to sign in</Link></Button></> : <form onSubmit={submit} className="space-y-4"><Label htmlFor="reset-new">New password</Label><Input id="reset-new" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /><Label htmlFor="reset-confirm">Confirm password</Label><Input id="reset-confirm" type="password" minLength={8} autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} />{error && <p role="alert" className="text-destructive">{error}</p>}<Button variant="gold" disabled={busy}>{busy ? "Saving…" : "Set password"}</Button></form>}</div>;
}