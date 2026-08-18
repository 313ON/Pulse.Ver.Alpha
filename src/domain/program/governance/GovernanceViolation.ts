import type { ProgramNodeType } from "../types";

export type GovernanceSeverity = "warning" | "error";

export type GovernanceEntityType = ProgramNodeType | string;

export type GovernanceViolation = {
  entityId: string;
  entityType: GovernanceEntityType;
  rule: string;
  severity: GovernanceSeverity;
  message: string;
};

export type GovernanceValidationReport = {
  violations: GovernanceViolation[];
  errors: GovernanceViolation[];
  warnings: GovernanceViolation[];
  valid: boolean;
};

export function createGovernanceReport(violations: GovernanceViolation[] = []): GovernanceValidationReport {
  return {
    violations,
    errors: violations.filter((violation) => violation.severity === "error"),
    warnings: violations.filter((violation) => violation.severity === "warning"),
    valid: violations.every((violation) => violation.severity !== "error")
  };
}

