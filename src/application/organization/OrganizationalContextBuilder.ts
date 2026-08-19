import { canScope, type SessionUser } from "../../server/auth";
import type { OrganizationRepository } from "../../server/organization";
import type {
  OrganizationalIdentityReference,
  Person,
  Position,
  Unit
} from "../../domain/organization";
import type {
  ContextHistoricalEvidence,
  ContextProgramAssignment,
  ContextValue,
  OrganizationalContext,
  OrganizationalContextReadPort,
  OrganizationalContextSubject
} from "./OrganizationalContext";
import { collectContextProvenance } from "./OrganizationalContextHardening";
import { isAnnualProgramIdentity } from "../reporting/ProgramEntityIdentity";

const CURRENT_PLAN_YEAR = 1405;

export type OrganizationalContextBuilderDependencies = {
  organization: OrganizationRepository;
  readSide: OrganizationalContextReadPort;
};

function known<T>(value: T): ContextValue<T> {
  return { status: "KNOWN", value };
}

function missing<T>(reason: string): ContextValue<T> {
  return { status: "MISSING", reason };
}

function unavailable<T>(reason: string): ContextValue<T> {
  return { status: "UNAVAILABLE", reason };
}

function personUnitId(
  organization: OrganizationRepository,
  person: Person | undefined
): string | undefined {
  return person?.positionId
    ? organization.getPosition(person.positionId)?.unitId
    : undefined;
}

function isVisible(
  user: SessionUser,
  personId?: string,
  unitId?: string
): boolean {
  return canScope(user, {
    ownerPersonId: personId,
    departmentId: unitId
  });
}

function sortAssignments(assignments: ContextProgramAssignment[]): ContextProgramAssignment[] {
  return [...assignments].sort((left, right) =>
    `${left.programEntityId}:${left.id}`.localeCompare(`${right.programEntityId}:${right.id}`)
  );
}

function sortReferences(
  references: OrganizationalIdentityReference[]
): OrganizationalIdentityReference[] {
  return [...references].sort((left, right) =>
    `${left.entityType}:${left.sourceLabel}`.localeCompare(`${right.entityType}:${right.sourceLabel}`)
  );
}

function historicalAssignment(
  assignment: ContextProgramAssignment
): ContextHistoricalEvidence {
  return {
    reference: assignment.provenance!,
    entityType: assignment.entityType,
    entityId: assignment.entityId,
    sourceOnly: true
  };
}

export class OrganizationalContextBuilder {
  constructor(private readonly dependencies: OrganizationalContextBuilderDependencies) {}

  build(
    subject: OrganizationalContextSubject,
    user: SessionUser,
    generatedAt: string
  ): OrganizationalContext {
    const base = this.emptyContext(subject, user, generatedAt);
    const resolved = this.resolveSubject(subject);
    const subjectVisible = subject.type === "PERSON"
      ? Boolean(resolved.person && isVisible(user, resolved.person.id, resolved.visibleUnitId))
      : subject.type === "UNIT"
        ? Boolean(resolved.unit && isVisible(user, undefined, resolved.unit.id))
        : true;
    if (!subjectVisible) {
      return {
        ...base,
        person: unavailable("The requested organizational subject is outside the authorization scope."),
        position: unavailable("The requested organizational subject is outside the authorization scope."),
        unit: unavailable("The requested organizational subject is outside the authorization scope."),
        authorizationScope: {
          ...base.authorizationScope,
          subjectVisible: false,
          reason: "OUTSIDE_AUTHORIZATION_SCOPE"
        }
      };
    }

    const visible = this.filterVisibleData(subject, user, resolved);
    const person = resolved.person;
    const position = resolved.position;
    const unit = resolved.unit;
    const unitPeople = unit
      ? this.dependencies.organization.listPeople().filter((candidate) =>
          candidate.positionId
          && this.dependencies.organization.getPosition(candidate.positionId)?.unitId === unit.id
          && isVisible(user, candidate.id, unit.id)
        )
      : [];
    const unitPositions = unit
      ? this.dependencies.organization.listPositions().filter((candidate) => candidate.unitId === unit.id)
      : [];

    return {
      ...base,
      person: person ? known(person) : missing("PERSON_NOT_FOUND"),
      position: position ? known(position) : missing(person?.positionId ? "POSITION_NOT_FOUND" : "POSITION_NOT_ASSIGNED"),
      unit: unit ? known(unit) : missing(position?.unitId ? "UNIT_NOT_FOUND" : "UNIT_NOT_DERIVED"),
      positions: unitPositions,
      people: unitPeople,
      businessRoles: person && resolved.visiblePersonId
        ? this.dependencies.readSide.listPersonRoles(person.id)
        : [],
      expertise: person && resolved.visiblePersonId
        ? this.dependencies.readSide.listPersonExpertise(person.id)
        : [],
      assignments: visible.assignments,
      historicalEvidence: visible.historicalEvidence,
      unresolvedReferences: sortReferences(visible.unresolvedReferences),
      provenance: collectContextProvenance({
        assignments: visible.assignments,
        historicalEvidence: visible.historicalEvidence
      }),
      authorizationScope: {
        ...base.authorizationScope,
        subjectVisible: true
      }
    };
  }

  private emptyContext(
    subject: OrganizationalContextSubject,
    user: SessionUser,
    generatedAt: string
  ): OrganizationalContext {
    return {
      subject,
      person: missing("NOT_RESOLVED"),
      position: missing("NOT_RESOLVED"),
      unit: missing("NOT_RESOLVED"),
      businessRoles: [],
      expertise: [],
      positions: [],
      people: [],
      assignments: [],
      historicalEvidence: [],
      unresolvedReferences: [],
      provenance: [],
      authorizationScope: {
        scope: user.scope,
        subjectVisible: false
      },
      generatedAt
    };
  }

  private resolveSubject(subject: OrganizationalContextSubject): {
    person?: Person;
    position?: Position;
    unit?: Unit;
    visiblePersonId?: string;
    visibleUnitId?: string;
    programEntityId?: string;
  } {
    if (subject.type === "PERSON") {
      const person = this.dependencies.organization.getPerson(subject.id);
      const position = person?.positionId
        ? this.dependencies.organization.getPosition(person.positionId)
        : undefined;
      const unit = position
        ? this.dependencies.organization.getUnit(position.unitId)
        : undefined;
      return {
        person,
        position,
        unit,
        visiblePersonId: person?.id,
        visibleUnitId: unit?.id
      };
    }

    if (subject.type === "UNIT") {
      return {
        unit: this.dependencies.organization.getUnit(subject.id),
        visibleUnitId: subject.id
      };
    }

    return { programEntityId: subject.id };
  }

  private filterVisibleData(
    subject: OrganizationalContextSubject,
    user: SessionUser,
    resolved: ReturnType<OrganizationalContextBuilder["resolveSubject"]>
  ) {
    const assignments = this.dependencies.readSide.listAssignments()
      .filter((assignment) => assignment.planYear === CURRENT_PLAN_YEAR)
      .filter((assignment) => {
        if (subject.type === "PROGRAM_ENTITY") {
          return isAnnualProgramIdentity(subject.id, CURRENT_PLAN_YEAR)
            ? true
            : assignment.programEntityId === subject.id;
        }
        if (subject.type === "PERSON") return assignment.entityType === "PERSON" && assignment.entityId === subject.id;
        return assignment.entityType === "UNIT"
          ? assignment.entityId === resolved.visibleUnitId
          : this.personBelongsToUnit(assignment.entityId, resolved.visibleUnitId);
      })
      .filter((assignment) => {
        const personId = assignment.entityType === "PERSON" ? assignment.entityId : undefined;
        const unitId = assignment.entityType === "UNIT"
          ? assignment.entityId
          : personUnitId(this.dependencies.organization, this.dependencies.organization.getPerson(assignment.entityId));
        return isVisible(user, personId, unitId);
      });

    const historicalEvidence = this.dependencies.readSide.listHistoricalEvidence()
      .filter((evidence) => evidence.reference.sourceYear !== CURRENT_PLAN_YEAR)
      .filter((evidence) => {
        if (subject.type === "PERSON") return evidence.entityId === subject.id;
        if (subject.type === "UNIT") return evidence.entityId === subject.id;
        return false;
      });
    const historicalAssignments = assignments
      .filter((assignment) =>
        Boolean(assignment.provenance) && assignment.provenance!.sourceYear !== CURRENT_PLAN_YEAR
      )
      .map(historicalAssignment);
    const canonicalAssignments = assignments
      .filter((assignment) => assignment.provenance?.sourceYear === CURRENT_PLAN_YEAR || !assignment.provenance);

    const unresolvedReferences = canonicalAssignments
      .filter((assignment) =>
        assignment.entityType === "PERSON" && !this.dependencies.organization.getPerson(assignment.entityId)
        || assignment.entityType === "UNIT" && !this.dependencies.organization.getUnit(assignment.entityId)
      )
      .map((assignment) => ({
        entityType: assignment.entityType,
        externalId: assignment.entityId,
        sourceLabel: assignment.displayName,
        resolutionStatus: "UNKNOWN" as const
      }));

    return {
      assignments: sortAssignments(canonicalAssignments),
      historicalEvidence: [...historicalEvidence, ...historicalAssignments],
      unresolvedReferences
    };
  }

  private personBelongsToUnit(personId: string, unitId?: string): boolean {
    if (!unitId) return false;
    return personUnitId(this.dependencies.organization, this.dependencies.organization.getPerson(personId)) === unitId;
  }
}
