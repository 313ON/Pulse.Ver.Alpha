export type ProgramEntityStatus =
  | "پیش‌نویس"
  | "در حال اجرا"
  | "تکمیل شده"
  | "مسدود"
  | "متوقف شده";

export type Priority = "بحرانی" | "زیاد" | "متوسط" | "کم";

export type Timeline = {
  start: string;
  end: string;
};

export type ProgramEntity = {
  id: string;
  title: string;
  description: string;
  status: ProgramEntityStatus;
  owner: string;
  priority: Priority;
  timeline: Timeline;
  progress: number;
};

export type Program = ProgramEntity & {
  type: "program";
  goals: Goal[];
};

export type Goal = ProgramEntity & {
  type: "goal";
  programId: string;
  objectives: Objective[];
};

export type Objective = ProgramEntity & {
  type: "objective";
  goalId: string;
  activities: Activity[];
};

export type Activity = ProgramEntity & {
  type: "activity";
  objectiveId: string;
  actions: Action[];
};

export type Action = ProgramEntity & {
  type: "action";
  activityId: string;
  kpis: KPI[];
};

export type KPI = ProgramEntity & {
  type: "kpi";
  actionId: string;
  unit: string;
  target: string;
  actual: string;
};

export type ProgramNode = Program | Goal | Objective | Activity | Action | KPI;

export type ProgramNodeType = ProgramNode["type"];

export type ParentNodeType = Exclude<ProgramNodeType, "kpi">;

export const PROGRAM_TYPE_LABELS: Record<ProgramNodeType, string> = {
  program: "برنامه",
  goal: "هدف راهبردی",
  objective: "هدف جزئی",
  activity: "فعالیت",
  action: "اقدام",
  kpi: "شاخص / نتیجه"
};

export const PROGRAM_STATUS_LABELS: Record<ProgramEntityStatus, string> = {
  "پیش‌نویس": "پیش‌نویس",
  "در حال اجرا": "در حال اجرا",
  "تکمیل شده": "تکمیل شده",
  "مسدود": "مسدود",
  "متوقف شده": "متوقف شده"
};
