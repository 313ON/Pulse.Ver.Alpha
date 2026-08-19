export type OrganizationStatus = "ACTIVE" | "INACTIVE";

export type Unit = {
  id: string;
  name: string;
  status: OrganizationStatus;
};

export type Position = {
  id: string;
  title: string;
  unitId: string;
  status?: OrganizationStatus;
};

export type Person = {
  id: string;
  fullName: string;
  status: OrganizationStatus;
  positionId?: string;
};

export type BusinessRole = {
  id: string;
  code?: string;
  title: string;
  status?: OrganizationStatus;
};

export type Expertise = {
  id: string;
  code?: string;
  title: string;
  status?: OrganizationStatus;
};

export type PersonRole = {
  id: string;
  personId: string;
  roleId: string;
};

export type PersonExpertise = {
  id: string;
  personId: string;
  expertiseId: string;
};

export type DerivedPersonUnit = {
  personId: string;
  unitId: string;
  derivation: "POSITION";
};

export type OrganizationalEntityType =
  | "UNIT"
  | "POSITION"
  | "PERSON"
  | "BUSINESS_ROLE"
  | "EXPERTISE";

export type OrganizationalResolutionStatus =
  | "UNKNOWN"
  | "CANDIDATE"
  | "RESOLVED"
  | "REJECTED";

export type OrganizationalIdentityReference = {
  entityType: OrganizationalEntityType;
  canonicalId?: string;
  externalId?: string;
  sourceLabel: string;
  normalizedLabel?: string;
  resolutionStatus: OrganizationalResolutionStatus;
};

export type OrganizationalProvenanceReference = {
  workbook: string;
  sheet: string;
  row: number;
  column: string;
  cell: string;
  sourceYear: number;
};

export function unresolvedOrganizationalReference(
  entityType: OrganizationalEntityType,
  sourceLabel: string,
  normalizedLabel?: string
): OrganizationalIdentityReference {
  return {
    entityType,
    sourceLabel,
    normalizedLabel,
    resolutionStatus: "UNKNOWN"
  };
}
