import type { GoalBrief } from "./types";

const fields: Array<keyof GoalBrief> = ["brief", "strategicRationale", "expectedOutcome", "scope", "successCriteria"];

export function validateGoalBrief(input: Partial<GoalBrief>): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    const value = input[field];
    if (value !== undefined && typeof value !== "string") errors.push(`${field} must be text.`);
    if (typeof value === "string" && value.length > 2000) errors.push(`${field} is too long.`);
  }
  return errors;
}

export function isGoalBriefComplete(input: Partial<GoalBrief> | null | undefined): boolean {
  return Boolean(input && fields.every((field) => typeof input[field] === "string" && input[field]!.trim().length > 0));
}

export function normalizeGoalBrief(input: Partial<GoalBrief>): GoalBrief {
  return {
    brief: input.brief?.trim() ?? "",
    strategicRationale: input.strategicRationale?.trim() ?? "",
    expectedOutcome: input.expectedOutcome?.trim() ?? "",
    scope: input.scope?.trim() ?? "",
    successCriteria: input.successCriteria?.trim() ?? "",
    ...(input.source?.trim() ? { source: input.source.trim() } : {})
  };
}
