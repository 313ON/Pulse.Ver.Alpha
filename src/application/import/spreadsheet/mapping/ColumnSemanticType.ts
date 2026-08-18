export type ColumnSemanticType =
  | "GOAL"
  | "OBJECTIVE"
  | "ACTIVITY"
  | "ACTION"
  | "KPI"
  | "OWNER"
  | "EXECUTOR"
  | "COLLABORATOR"
  | "UNIT"
  | "PERSON"
  | "START_DATE"
  | "END_DATE"
  | "PROGRESS";

export const HIERARCHY_SEMANTIC_TYPES: ColumnSemanticType[] = [
  "GOAL",
  "OBJECTIVE",
  "ACTIVITY",
  "ACTION",
  "KPI"
];

export const SEMANTIC_DATA_KEYS: Record<ColumnSemanticType, string> = {
  GOAL: "goal",
  OBJECTIVE: "objective",
  ACTIVITY: "activity",
  ACTION: "action",
  KPI: "kpi",
  OWNER: "owner",
  EXECUTOR: "executor",
  COLLABORATOR: "collaborator",
  UNIT: "unit",
  PERSON: "person",
  START_DATE: "startDate",
  END_DATE: "endDate",
  PROGRESS: "progress"
};
