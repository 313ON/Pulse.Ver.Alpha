import type { ProgramNodeType } from "./types";

/**
 * Reserved contract for future Cognition Core validation.
 * Scores are intentionally optional until a validation engine is connected.
 */
export type CognitionValidationKey =
  | "goalAlignmentScore"
  | "objectiveCompleteness"
  | "activityRelevance"
  | "actionConsistency";

export type CognitionValidation = {
  key: CognitionValidationKey;
  label: string;
  score?: number;
  state: "pending" | "ready" | "needs-review";
  appliesTo: ProgramNodeType[];
};

export const COGNITION_VALIDATION_DEFINITIONS: CognitionValidation[] = [
  {
    key: "goalAlignmentScore",
    label: "امتیاز هم‌راستایی هدف",
    state: "pending",
    appliesTo: ["goal"]
  },
  {
    key: "objectiveCompleteness",
    label: "کامل‌بودن هدف جزئی",
    state: "pending",
    appliesTo: ["objective"]
  },
  {
    key: "activityRelevance",
    label: "ارتباط فعالیت با هدف",
    state: "pending",
    appliesTo: ["activity"]
  },
  {
    key: "actionConsistency",
    label: "سازگاری اقدام با فعالیت",
    state: "pending",
    appliesTo: ["action"]
  }
];
