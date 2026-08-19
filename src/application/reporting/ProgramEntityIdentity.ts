const WORK_ITEM_PUBLIC_ID_PATTERN = /^(G\d{2})-(O\d{2})-(A\d{2})-T\d{3}$/;

export type WorkItemHierarchyIdentity = {
  goalId: string;
  objectiveCode: string;
  activityCode: string;
  objectiveId: string;
  activityId: string;
};

export function programIdentity(planYear: number): string {
  return `program-${planYear}`;
}

export function isAnnualProgramIdentity(id: string, planYear: number): boolean {
  return id === programIdentity(planYear);
}

export function parseWorkItemHierarchyIdentity(publicId: string): WorkItemHierarchyIdentity | undefined {
  const match = WORK_ITEM_PUBLIC_ID_PATTERN.exec(publicId);
  if (!match) return undefined;
  const [, goalId, objectiveCode, activityCode] = match;
  return {
    goalId,
    objectiveCode,
    activityCode,
    objectiveId: `${goalId}-${objectiveCode}`,
    activityId: `${goalId}-${objectiveCode}-${activityCode}`
  };
}
