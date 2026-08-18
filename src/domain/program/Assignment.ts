export type AssignmentEntityType = "PERSON" | "UNIT";

export type AssignmentRole = "OWNER" | "EXECUTOR" | "COLLABORATOR";

export type AssignmentResponsibilityType = "PRIMARY" | "SUPPORT";

export type Assignment = {
  id: string;
  entityType: AssignmentEntityType;
  entityId: string;
  displayName: string;
  role: AssignmentRole;
  responsibilityType: AssignmentResponsibilityType;
};

