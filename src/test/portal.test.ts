import { describe, expect, it } from "vitest";
import { canManage, validTasks, type PortalAccess } from "@/lib/portal";
const user: PortalAccess = { role: "user", permissions: [], premium: false, displayName: "" };
describe("Portal permission rules", () => {
  it("only owner can delegate admins", () => {
    expect(canManage({ ...user, role: "owner", premium: true }, "team.manage")).toBe(true);
    expect(canManage({ ...user, role: "admin", permissions: ["users.read"] }, "team.manage")).toBe(false);
  });
  it("admins may only perform selected tasks", () => {
    const admin: PortalAccess = { ...user, role: "admin", permissions: ["users.read"] };
    expect(canManage(admin, "users.read")).toBe(true);
    expect(canManage(admin, "providers.read")).toBe(false);
    expect(canManage(user, "users.read")).toBe(false);
  });
  it("rejects invented owner permissions", () => {
    expect(validTasks(["users.read", "usage.read", "providers.read"])).toBe(true);
    expect(validTasks(["team.manage"])).toBe(false);
  });
});