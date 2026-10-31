export const TASKS = [
  { id: "users.read", label: "Look up users", description: "View account names, emails and song counts." },
  { id: "usage.read", label: "View usage metrics", description: "View app-wide project and release counts." },
  { id: "providers.read", label: "Check providers", description: "View connection readiness without accessing secrets." },
] as const;
export type PortalAccess = { role: "user" | "admin" | "owner"; permissions: string[]; premium: boolean; displayName: string };
export function canManage(access: PortalAccess, task: string) {
  return access.role === "owner" || (access.role === "admin" && access.permissions.includes(task));
}
export function validTasks(tasks: string[]) {
  return tasks.every(task => TASKS.some(t => t.id === task));
}
export type PortalUser = { id: string; email: string; display_name: string; role: string; premium: boolean; projects: number; songs: number; created_at: string; email_confirmed_at: string | null; last_sign_in_at: string | null };
export type TeamMember = { user_id: string; email: string; display_name: string; role: string; permissions: string[] };
export type TeamData = { members: TeamMember[]; audit: { action: string; created_at: string; target_email: string; details: { permissions: string[] } }[] };
export type PortalMetrics = { users: number; projects: number; audio: number; covers: number; failed: number; exported: number; submitted: number; live: number; today: number; daily: { day: string; projects: number }[] };