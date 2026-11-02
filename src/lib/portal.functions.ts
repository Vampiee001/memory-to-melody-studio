import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validTasks, type PortalAccess, type PortalUser, type TeamData, type PortalMetrics } from "./portal";

export const getPortalAccess = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("portal_access");
  if (error) throw new Error("Could not load account access");
  return data as unknown as PortalAccess;
});
export const findPortalUsers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { search: string }) => ({ search: d.search.trim().slice(0, 200) }))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("portal_users", { search_text: data.search });
    if (r.error) throw new Error("User lookup unavailable or not permitted");
    return r.data as unknown as PortalUser[];
  });
export const getPortalMetrics = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const r = await context.supabase.rpc("portal_metrics");
  if (r.error) throw new Error("Usage metrics unavailable or not permitted");
  return r.data as unknown as PortalMetrics;
});
export const getPortalTeam = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const r = await context.supabase.rpc("portal_team");
  if (r.error) throw new Error("Only the owner can view the team");
  return r.data as unknown as TeamData;
});
export const savePortalAdmin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; tasks: string[]; revoke: boolean }) => {
    if (!validTasks(d.tasks) || !d.email.includes("@")) throw new Error("Invalid email or permissions");
    return d;
  }).handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("portal_set_admin", { target_email: data.email, tasks: data.tasks, revoke_access: data.revoke });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });
export const checkPortalProviders = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const permitted = await context.supabase.rpc("portal_can", { task: "providers.read" });
  if (permitted.error || !permitted.data) throw new Error("Provider checks not permitted");
  const { writers, musicProviders, beatProviders, coverProviders, masteringProviders, distributors } = await import("./providers.server");
  const groups = { writers, music: musicProviders, beats: beatProviders, covers: coverProviders, mastering: masteringProviders, distributors };
  const checkedAt = new Date().toISOString();
  let gatewayHealth = "Not tested remotely";
  const key = process.env["LOVABLE_API_KEY"];
  if (key) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(8000) });
      gatewayHealth = response.ok ? "Gateway reachable" : `Gateway check failed (${response.status})`;
      await response.body?.cancel();
    } catch { gatewayHealth = "Gateway unreachable or timed out"; }
  }
  return { checkedAt, providers: Object.entries(groups).flatMap(([group, registry]) => Object.values(registry).map(p => ({ id: p.id, group, label: p.label, configured: p.isConfigured(), health: !p.isConfigured() ? "Setup required" : ["mastering", "distributors"].includes(group) ? "Not tested remotely" : gatewayHealth, note: p.isConfigured() ? ["mastering", "distributors"].includes(group) ? "Credentials present; remote health requires a documented non-billable endpoint." : "Non-generating gateway check only; individual model availability and credits are not verified." : group === "mastering" ? "Needs MASTERING_API_URL and MASTERING_API_KEY." : group === "distributors" ? "Needs DISTRIBUTOR_API_URL and DISTRIBUTOR_API_KEY and approved partner access." : "AI service credentials are missing." }))) };
});