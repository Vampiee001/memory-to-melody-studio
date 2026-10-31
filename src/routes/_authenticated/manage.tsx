import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ShieldCheck, Users, Activity, AudioLines, RefreshCw, Save, UserMinus, Search, Crown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TASKS, canManage, type TeamMember } from "@/lib/portal";
import { getPortalAccess, getPortalMetrics, getPortalTeam, findPortalUsers, savePortalAdmin, checkPortalProviders } from "@/lib/portal.functions";

export const Route = createFileRoute("/_authenticated/manage")({
  head: () => ({ meta: [
    { title: "Owner & admin portal — MemoryMelody" },
    { name: "description", content: "Manage the MemoryMelody team, account access, usage and provider readiness." },
    { property: "og:title", content: "Owner & admin portal — MemoryMelody" },
    { property: "og:description", content: "Secure team permissions, account lookup and studio activity." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Management,
});
function Failure({ error }: { error: Error | null }) { return error ? <p role="alert" className="py-4 text-destructive">{error.message}</p> : null; }
function Management() {
  const accessFn = useServerFn(getPortalAccess);
  const q = useQuery({ queryKey: ["portal-access"], queryFn: () => accessFn() });
  if (q.isPending) return <p className="py-12 text-muted-foreground">Loading account access…</p>;
  if (q.error) return <><Failure error={q.error} /><Button onClick={() => q.refetch()}>Retry</Button></>;
  if (!q.data || q.data.role === "user") return <div className="py-16 text-center"><ShieldCheck className="mx-auto mb-4 size-10 text-gold" /><h1 className="text-3xl">Management access required</h1><p className="mt-3 text-muted-foreground">Only the creator and appointed admins can open this portal.</p><Button asChild variant="outline" className="mt-6"><Link to="/">Your library</Link></Button></div>;
  const access = q.data;
  const tabs = [canManage(access, "usage.read") && "overview", access.role === "owner" && "team", canManage(access, "users.read") && "users", canManage(access, "providers.read") && "providers"].filter(Boolean) as string[];
  return <div className="space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6"><div><div className="mb-2 flex items-center gap-2 text-gold"><ShieldCheck className="size-5" /><span className="text-sm">MemoryMelody control room</span></div><h1 className="text-4xl font-semibold">{access.role === "owner" ? "Creator dashboard" : "Admin dashboard"}</h1><p className="mt-2 text-muted-foreground">Welcome{access.displayName ? `, ${access.displayName}` : " back"}.</p></div><Badge variant="outline" className="gap-2 border-gold p-3 text-gold"><Crown className="size-4" />{access.role === "owner" ? "Creator · permanent premium" : "Delegated admin"}</Badge></header>
    {tabs.length === 0 ? <p>No tasks have been assigned yet. Ask the creator to select your permissions.</p> : <Tabs defaultValue={tabs[0]}>
      <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1">
        {tabs.includes("overview") && <TabsTrigger value="overview"><Activity className="mr-2 size-4" />Overview</TabsTrigger>}
        {tabs.includes("team") && <TabsTrigger value="team"><ShieldCheck className="mr-2 size-4" />Team</TabsTrigger>}
        {tabs.includes("users") && <TabsTrigger value="users"><Users className="mr-2 size-4" />Users</TabsTrigger>}
        {tabs.includes("providers") && <TabsTrigger value="providers"><AudioLines className="mr-2 size-4" />Providers</TabsTrigger>}
      </TabsList>
      {tabs.includes("overview") && <TabsContent value="overview"><Overview /></TabsContent>}
      {tabs.includes("team") && <TabsContent value="team"><Team /></TabsContent>}
      {tabs.includes("users") && <TabsContent value="users"><UserLookup /></TabsContent>}
      {tabs.includes("providers") && <TabsContent value="providers"><Providers /></TabsContent>}
    </Tabs>}
  </div>;
}
function Overview() {
  const fn = useServerFn(getPortalMetrics);
  const q = useQuery({ queryKey: ["portal-metrics"], queryFn: () => fn() });
  const d = q.data;
  return <section className="space-y-6 py-6"><div className="flex items-center justify-between"><h2 className="text-2xl">Studio activity</h2><Button variant="ghost" size="icon" aria-label="Refresh metrics" disabled={q.isFetching} onClick={() => q.refetch()}><RefreshCw /></Button></div><Failure error={q.error} />{q.isPending ? <p>Loading metrics…</p> : d && <>
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[["Accounts", d.users], ["Memory projects", d.projects], ["Songs with audio", d.audio], ["Projects today (UTC)", d.today]].map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-4xl font-semibold text-gold">{value}</p></div>)}</div>
    <h3 className="text-xl">Projects started · last 7 days</h3><div className="divide-y divide-border">{d.daily.map(day => <div key={day.day} className="flex justify-between py-3"><span>{day.day}</span><span className="font-semibold">{day.projects}</span></div>)}</div>
    <div className="grid gap-3 border-t border-border pt-5 sm:grid-cols-3">{[["Cover images", d.covers], ["Currently failed projects", d.failed], ["Packages exported", d.exported], ["Submitted releases", d.submitted], ["Marked live", d.live]].map(([label, value]) => <p key={label} className="flex justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><strong>{value}</strong></p>)}</div><p className="text-xs text-muted-foreground">Project counts, not AI request totals or billing. Payments and subscription tracking are not connected.</p>
  </>}</section>;
}
function TaskChoices({ tasks, onChange, prefix }: { tasks: string[]; onChange: (tasks: string[]) => void; prefix: string }) {
  return <div className="grid gap-3 sm:grid-cols-3">{TASKS.map(t => <Label key={t.id} htmlFor={`${prefix}-${t.id}`} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3"><Checkbox id={`${prefix}-${t.id}`} checked={tasks.includes(t.id)} onCheckedChange={v => onChange(v === true ? [...tasks, t.id] : tasks.filter(x => x !== t.id))} /><span><span className="block font-semibold">{t.label}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{t.description}</span></span></Label>)}</div>;
}
function Member({ member }: { member: TeamMember }) {
  const [tasks, setTasks] = useState(member.permissions);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(savePortalAdmin);
  const qc = useQueryClient();
  async function update(revoke: boolean) {
    if (revoke && !window.confirm(`Revoke admin access for ${member.email}?`)) return;
    setBusy(true); try { await save({ data: { email: member.email, tasks, revoke } }); await qc.invalidateQueries({ queryKey: ["portal-team"] }); toast.success(revoke ? "Admin access revoked" : "Permissions saved"); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <article className="space-y-4 border-b border-border py-6"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{member.display_name || (member.role === "owner" ? "App creator" : "Admin")}</h3><p className="break-all text-sm text-muted-foreground">{member.email}</p></div><Badge variant="outline">{member.role}</Badge></div>{member.role === "owner" ? <p className="text-sm text-gold">Permanent premium · all permissions · cannot be revoked</p> : <><TaskChoices prefix={member.user_id} tasks={tasks} onChange={setTasks} /><div className="flex flex-wrap gap-2"><Button disabled={busy} variant="gold" onClick={() => update(false)}><Save />Save permissions</Button><Button disabled={busy} variant="outline" onClick={() => update(true)}><UserMinus />Revoke admin</Button></div></>}</article>;
}
function Team() {
  const fn = useServerFn(getPortalTeam), save = useServerFn(savePortalAdmin);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["portal-team"], queryFn: () => fn() });
  const [email, setEmail] = useState(""), [tasks, setTasks] = useState<string[]>([]), [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) { e.preventDefault(); setBusy(true); try { await save({ data: { email, tasks, revoke: false } }); setEmail(""); await qc.invalidateQueries({ queryKey: ["portal-team"] }); toast.success("Admin appointed"); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }
  return <section className="space-y-6 py-6"><h2 className="text-2xl">Team & permissions</h2><form onSubmit={add} className="space-y-4 border-b border-border pb-6"><Label htmlFor="admin-email">Appoint an admin · confirmed account required</Label><Input id="admin-email" type="email" required placeholder="Enter their account email" value={email} onChange={e => setEmail(e.target.value)} /><TaskChoices prefix="new" tasks={tasks} onChange={setTasks} /><Button variant="gold" disabled={busy}><ShieldCheck />{busy ? "Saving…" : "Appoint admin"}</Button></form><Failure error={q.error} />{q.isPending && <p>Loading team…</p>}{q.data?.members.map(m => <Member key={m.user_id + m.permissions.join()} member={m} />)}<h3 className="text-xl">Recent access changes</h3>{!q.data?.audit.length && <p className="text-sm text-muted-foreground">No access changes yet.</p>}{q.data?.audit.map((a, i) => <div key={i} className="border-b border-border py-3 text-sm"><p>{a.action} · <span className="break-all">{a.target_email}</span></p><p className="mt-1 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()} · {a.details.permissions.join(", ") || "No tasks"}</p></div>)}</section>;
}
function UserLookup() {
  const fn = useServerFn(findPortalUsers);
  const [text, setText] = useState(""), [search, setSearch] = useState("");
  const q = useQuery({ queryKey: ["portal-users", search], queryFn: () => fn({ data: { search } }) });
  return <section className="space-y-5 py-6"><h2 className="text-2xl">User lookup</h2><form onSubmit={e => { e.preventDefault(); setSearch(text); }} className="flex gap-2"><Input aria-label="Search users" placeholder="Email or display name" value={text} onChange={e => setText(e.target.value)} /><Button type="submit" variant="gold" size="icon" aria-label="Find users"><Search /></Button></form><Failure error={q.error} />{q.isPending && <p>Searching accounts…</p>}{q.data?.length === 0 && <p>No accounts match your search.</p>}<div className="divide-y divide-border">{q.data?.map(u => <article key={u.id} className="flex flex-wrap justify-between gap-4 py-5"><div className="min-w-0"><h3 className="font-semibold">{u.display_name || "Unnamed account"}</h3><p className="break-all text-sm text-muted-foreground">{u.email}</p><p className="mt-2 text-xs text-muted-foreground">Joined {new Date(u.created_at).toLocaleDateString()} · {u.email_confirmed_at ? "Email verified" : "Awaiting verification"}</p></div><div className="space-y-2 text-right"><Badge variant="outline">{u.premium ? "Creator · premium" : u.role}</Badge><p className="text-sm">{u.projects} projects · {u.songs} songs</p></div></article>)}</div><p className="text-xs text-muted-foreground">Up to 50 matching accounts. Paid subscriptions and credit balances are not connected yet.</p></section>;
}
function Providers() {
  const fn = useServerFn(checkPortalProviders);
  const q = useQuery({ queryKey: ["portal-providers"], queryFn: () => fn(), staleTime: 60000, retry: false });
  return <section className="space-y-5 py-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl">Provider readiness</h2><Button variant="outline" disabled={q.isFetching} onClick={() => q.refetch()}><RefreshCw />{q.isFetching ? "Checking…" : "Check connections"}</Button></div><Failure error={q.error} /><p className="text-sm text-muted-foreground">Checks configuration only; no songs, images or distributor submissions are created. Credentials do not prove a service is operational.</p>{q.data?.providers.map(p => <article key={p.group + p.id} className="flex flex-wrap justify-between gap-4 border-b border-border py-4"><div className="max-w-xl"><p className="text-xs uppercase text-gold">{p.group}</p><h3 className="mt-1 font-semibold">{p.label}</h3><p className="mt-1 text-sm text-muted-foreground">{p.note}</p></div><div className="space-y-2"><Badge variant="outline">{p.configured ? "Configured" : "Setup required"}</Badge><p className="text-xs text-muted-foreground">{p.health}</p></div></article>)}{q.data && <p className="text-xs text-muted-foreground">Checked {new Date(q.data.checkedAt).toLocaleString()}. External health checks require a documented non-billable endpoint.</p>}</section>;
}