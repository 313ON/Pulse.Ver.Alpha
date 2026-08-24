export const GOAL_OWNER_REQUIRED_RULE = "goal.owner.required" as const;

export type AssignGoalOwnerRemediationInput = {
  importJobId: string;
  rule: typeof GOAL_OWNER_REQUIRED_RULE;
  targetEntityType: "goal";
  targetGoalId: string;
  proposedOwnerPersonId: string;
  reason: string;
};

export type AssignGoalOwnerRemediation = AssignGoalOwnerRemediationInput;

export function validateAssignGoalOwnerRemediation(input: AssignGoalOwnerRemediationInput): AssignGoalOwnerRemediation {
  if (!input.importJobId.trim()) throw new Error("Import job scope is required.");
  if (input.rule !== GOAL_OWNER_REQUIRED_RULE) throw new Error("Only goal.owner.required remediation is supported.");
  if (input.targetEntityType !== "goal" || !input.targetGoalId.trim()) {
    throw new Error("A goal target is required.");
  }
  if (!input.proposedOwnerPersonId.trim()) throw new Error("A proposed owner is required.");
  if (!input.reason.trim()) throw new Error("A remediation reason is required.");
  return {
    ...input,
    importJobId: input.importJobId.trim(),
    targetGoalId: input.targetGoalId.trim(),
    proposedOwnerPersonId: input.proposedOwnerPersonId.trim(),
    reason: input.reason.trim()
  };
}

export function applyGoalOwnerOverlay<T extends { goals: Array<{ id: string; owner: string }> }>(
  program: T,
  targetGoalId: string,
  ownerDisplayName: string
): T {
  return {
    ...program,
    goals: program.goals.map((goal) =>
      goal.id === targetGoalId ? { ...goal, owner: ownerDisplayName } : goal
    )
  };
}
