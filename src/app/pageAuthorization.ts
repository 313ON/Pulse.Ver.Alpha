import type { PermissionCode } from "../server/auth";

export const pagePermissions: Partial<Record<string, PermissionCode>> = {
  goals: "goals.view",
  "sub-goals": "goals.view",
  activities: "activities.view",
  actions: "actions.view",
  departments: "organization.manage",
  roles: "organization.manage",
  persons: "organization.manage",
  users: "users.manage",
  kpis: "kpis.manage",
  risks: "risks.manage",
  dependencies: "dependencies.manage",
  "monthly-reviews": "reports.view",
  reports: "reports.view",
  imports: "imports.manage"
};

export function permissionForPage(section: string): PermissionCode {
  return pagePermissions[section] ?? "goals.view";
}
