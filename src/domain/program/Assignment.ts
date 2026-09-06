export type AssignmentEntityType = "PERSON" | "UNIT" | "POSITION";

export type AssignmentRole = "OWNER" | "EXECUTOR" | "COLLABORATOR" | "ACCOUNTABLE" | "CONSULTED" | "INFORMED";

export type AssignmentResponsibilityType = "PRIMARY" | "SUPPORT";

export type Assignment = {
  id: string;
  entityType: AssignmentEntityType;
  entityId: string;
  displayName: string;
  role: AssignmentRole;
  responsibilityType: AssignmentResponsibilityType;
};

