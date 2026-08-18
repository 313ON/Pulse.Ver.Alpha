export type ImportColumnGroup =
  | "goal"
  | "objective"
  | "activity"
  | "action"
  | "kpi"
  | "assignment"
  | "date";

export type ImportColumnDefinition = {
  key: string;
  headers: string[];
  required?: boolean;
};

export type ImportTemplateDefinition = {
  name: string;
  goalColumns?: ImportColumnDefinition[];
  objectiveColumns?: ImportColumnDefinition[];
  activityColumns?: ImportColumnDefinition[];
  actionColumns?: ImportColumnDefinition[];
  kpiColumns?: ImportColumnDefinition[];
  assignmentColumns?: ImportColumnDefinition[];
  dateColumns?: ImportColumnDefinition[];
};

export type ImportTemplateColumnProperty =
  | "goalColumns"
  | "objectiveColumns"
  | "activityColumns"
  | "actionColumns"
  | "kpiColumns"
  | "assignmentColumns"
  | "dateColumns";

export const importTemplateGroupProperties: Record<
  ImportColumnGroup,
  ImportTemplateColumnProperty
> = {
  goal: "goalColumns",
  objective: "objectiveColumns",
  activity: "activityColumns",
  action: "actionColumns",
  kpi: "kpiColumns",
  assignment: "assignmentColumns",
  date: "dateColumns"
};
