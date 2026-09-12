import type { ContextProgramAssignment } from "../organization/OrganizationalContext";
import type { UnknownRow } from "../program/ports";

export type OperationalProgramReadPort = {
  listGoals(planYear: number, organizationalUnitId?: string): UnknownRow[];
  listObjectives(planYear: number, organizationalUnitId?: string): UnknownRow[];
  listActivities(planYear: number, organizationalUnitId?: string): UnknownRow[];
  listActions(planYear: number, organizationalUnitId?: string): UnknownRow[];
  listKpis(planYear: number, organizationalUnitId?: string): UnknownRow[];
  listActionAssignments(planYear: number, organizationalUnitId?: string): ReadonlyMap<string, readonly ContextProgramAssignment[]>;
};
