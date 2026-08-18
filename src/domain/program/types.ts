import type {
  KpiDirection,
  KpiMeasurement,
  KpiMeasurementRule,
  Priority,
  ProgramDate,
  ProgramStatus,
  Progress
} from "./primitives";

export type { KpiDirection, KpiMeasurement, KpiMeasurementRule, Priority, ProgramDate, ProgramStatus, Progress };

export type ProgramEntityStatus = ProgramStatus;

export type EntityReference = {
  id: string;
  label?: string;
};

export type WorkType = "پروژه" | "اقدام" | "فعالیت تکرارشونده" | "پایش KPI" | "Milestone";

export type Timeline = {
  start: ProgramDate;
  end: ProgramDate;
};

export type ProgramEntity = {
  id: string;
  title: string;
  description: string;
  status: ProgramStatus;
  owner: string;
  priority: Priority;
  timeline: Timeline;
  progress: Progress;
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
  ownerRef?: EntityReference;
  department?: EntityReference;
  workType?: WorkType;
  plannedStart?: ProgramDate;
  plannedEnd?: ProgramDate;
  actualCompletion?: ProgramDate;
  blocker?: string;
  notes?: string;
  deliverable?: string;
  externalIdentifiers?: Record<string, string>;
  goalId?: string;
  objectiveId?: string;
  activityId?: string;
  kpis: KPI[];
};

export type KPI = ProgramEntity & {
  type: "kpi";
  ownerRef?: EntityReference;
  actionId?: string;
  unit: string;
  baseline?: number;
  target: number;
  actual: number;
  direction: KpiDirection;
  measurementRule?: KpiMeasurementRule;
  frequency?: string;
  measurement?: KpiMeasurement;
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

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  "پیش‌نویس": "پیش‌نویس",
  "نیازمند تکمیل": "نیازمند تکمیل",
  "در انتظار تأیید": "در انتظار تأیید",
  "تأیید شده": "تأیید شده",
  "شروع نشده": "شروع نشده",
  "در حال اجرا": "در حال اجرا",
  "تکمیل شده": "تکمیل شده",
  "مسدود": "مسدود",
  "متوقف شده": "متوقف شده",
  "لغو شده": "لغو شده"
};
