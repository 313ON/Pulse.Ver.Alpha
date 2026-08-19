import type { SessionUser } from "../../server/auth";
import type {
  BusinessRole,
  Expertise,
  OrganizationalIdentityReference,
  OrganizationalProvenanceReference,
  Person,
  Position,
  Unit
} from "../../domain/organization";
import type { Assignment } from "../../domain/program";

export type ContextValue<T> =
  | { status: "KNOWN"; value: T }
  | { status: "MISSING"; reason: string }
  | { status: "UNAVAILABLE"; reason: string };

export type OrganizationalContextSubject =
  | { type: "PERSON"; id: string }
  | { type: "UNIT"; id: string }
  | { type: "PROGRAM_ENTITY"; id: string };

export type ContextAuthorizationScope = {
  scope: SessionUser["scope"];
  subjectVisible: boolean;
  reason?: string;
};

export type ContextProgramAssignment = Assignment & {
  programEntityId: string;
  planYear: number;
  provenance?: OrganizationalProvenanceReference;
};

export type ContextHistoricalEvidence = {
  reference: OrganizationalProvenanceReference;
  entityType: "PERSON" | "UNIT" | "POSITION" | "BUSINESS_ROLE" | "EXPERTISE";
  entityId?: string;
  sourceOnly: true;
};

export type OrganizationalContextCompleteness = {
  person: ContextValue<Person>["status"];
  position: ContextValue<Position>["status"];
  unit: ContextValue<Unit>["status"];
  assignments: "KNOWN" | "EMPTY";
  historicalEvidence: "KNOWN" | "EMPTY";
  unresolvedReferences: "NONE" | "PRESENT";
};

export type OrganizationalContextQuality = {
  status: "COMPLETE" | "PARTIAL" | "UNAVAILABLE";
  completeness: OrganizationalContextCompleteness;
  missingFields: string[];
  unresolvedReferenceCount: number;
  provenanceReferenceCount: number;
};

export type OrganizationalContextProvenance = {
  kind: "ASSIGNMENT" | "HISTORICAL_EVIDENCE";
  reference: OrganizationalProvenanceReference;
  sourceOnly: boolean;
};

export type OrganizationalContext = {
  subject: OrganizationalContextSubject;
  person: ContextValue<Person>;
  position: ContextValue<Position>;
  unit: ContextValue<Unit>;
  positions: Position[];
  people: Person[];
  businessRoles: BusinessRole[];
  expertise: Expertise[];
  assignments: ContextProgramAssignment[];
  historicalEvidence: ContextHistoricalEvidence[];
  unresolvedReferences: OrganizationalIdentityReference[];
  provenance: OrganizationalContextProvenance[];
  authorizationScope: ContextAuthorizationScope;
  generatedAt: string;
};

export type OrganizationalContextReadPort = {
  listAssignments(): ContextProgramAssignment[];
  listHistoricalEvidence(): ContextHistoricalEvidence[];
  listPersonRoles(personId: string): BusinessRole[];
  listPersonExpertise(personId: string): Expertise[];
};

export type OrganizationalContextSnapshot = {
  readonly subject: DeepReadonly<OrganizationalContextSubject>;
  readonly generatedAt: string;
  readonly context: DeepReadonly<OrganizationalContext>;
  readonly quality: DeepReadonly<OrganizationalContextQuality>;
};

export type DeepReadonly<T> =
  T extends (...args: never[]) => unknown
    ? T
    : T extends readonly (infer U)[]
      ? readonly DeepReadonly<U>[]
      : T extends object
        ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
        : T;
