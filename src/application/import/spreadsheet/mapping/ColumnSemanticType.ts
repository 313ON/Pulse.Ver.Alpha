export type ColumnSemanticType =
  | "GOAL"
  | "OBJECTIVE"
  | "ACTIVITY"
  | "ACTION"
  | "KPI"
  | "KPI_TARGET"
  | "KPI_VALUE"
  | "KPI_UNIT"
  | "OWNER"
  | "EXECUTOR"
  | "COLLABORATOR"
  | "UNIT"
  | "PERSON"
  | "START_DATE"
  | "END_DATE"
  | "DURATION"
  | "WORKING_DAYS"
  | "PERSON_HOURS"
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
  KPI_TARGET: "kpiTarget",
  KPI_VALUE: "kpiValue",
  KPI_UNIT: "kpiUnit",
  OWNER: "owner",
  EXECUTOR: "executor",
  COLLABORATOR: "collaborator",
  UNIT: "unit",
  PERSON: "person",
  START_DATE: "startDate",
  END_DATE: "endDate",
  DURATION: "duration",
  WORKING_DAYS: "workingDays",
  PERSON_HOURS: "personHours",
  PROGRESS: "progress"
};
