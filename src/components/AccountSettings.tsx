import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export function AccountSettings() {
  const [name, setName] = useState(""), [current, setCurrent] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  useEffect(() => { supabase.from("profiles").select("display_name").single().then(({ data, error }) => { if (error) toast.error("Couldn't load your display name"); else setName(data?.display_name ?? ""); }); }, []);
  async function saveName(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { const { data: auth } = await supabase.auth.getUser(); if (!auth.user) throw new Error("Please sign in again"); const r = await supabase.from("profiles").update({ display_name: name.trim().slice(0,80) }).eq("id",auth.user.id); if (r.error) throw r.error; await qc.invalidateQueries({ queryKey: ["portal-access"] }); toast.success("Display name saved"); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }
  async function change(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { const r = await supabase.auth.updateUser({ password, current_password: current }); if (r.error) throw r.error; setPassword(""); setCurrent(""); toast.success("Password updated"); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }
  return <section className="space-y-6 border-b border-border pb-6"><h2 className="text-xl">Your account</h2><form onSubmit={saveName} className="space-y-3"><Label htmlFor="display-name">Display name</Label><Input id="display-name" maxLength={80} value={name} onChange={e => setName(e.target.value)} /><Button disabled={busy} variant="outline">Save name</Button></form><form onSubmit={change} className="space-y-3"><h3 className="font-semibold">Change password</h3><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /><Button disabled={busy} variant="gold">Update password</Button></form></section>;
}