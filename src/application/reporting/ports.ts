import type { ContextProgramAssignment } from "../organization/OrganizationalContext";
import type { UnknownRow } from "../program/ports";

export type OperationalProgramReadPort = {
  listGoals(planYear: number): UnknownRow[];
  listObjectives(planYear: number): UnknownRow[];
  listActivities(planYear: number): UnknownRow[];
  listActions(planYear: number): UnknownRow[];
  listKpis(planYear: number): UnknownRow[];
  listActionAssignments(planYear: number): ReadonlyMap<string, readonly ContextProgramAssignment[]>;
};
