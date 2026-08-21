import type {
  BusinessRole,
  Expertise,
  OrganizationalProvenanceReference,
  Person,
  Position,
  Unit
} from "../../../domain/organization";
import type {
  ContextProgramAssignment,
  OrganizationalContext,
  OrganizationalContextSnapshot
} from "../OrganizationalContext";
import { getPlanningContext } from "../../../domain/planning";

export const GOVERNANCE_RULE_SET_VERSION = "10C.1";
export const DEFAULT_PLAN_YEAR = getPlanningContext().planYear;
export function currentPlanYear(): number {
  return getPlanningContext().planYear;
}

export type GovernanceStatus = "PASS" | "WARNING" | "BLOCKED";
export type GovernanceSeverity = "INFO" | "WARNING" | "BLOCKER";
export type FactOrigin = "IMPORTED" | "MANUAL" | "CANONICAL" | "INFERRED" | "UNRESOLVED";

export type GovernanceSubject = {
  type:
    | "PERSON"
    | "UNIT"
    | "POSITION"
    | "BUSINESS_ROLE"
    | "EXPERTISE"
    | "ASSIGNMENT"
    | "PROGRAM_ENTITY"
    | "CONTEXT";
  id?: string;
};

export type GovernanceEvidence = {
  provenance?: OrganizationalProvenanceReference[];
  planYear?: number;
  sourceYear?: number;
  resolutionStatus?: string;
};

export type GovernanceFinding = {
  ruleId: string;
  severity: GovernanceSeverity;
  subject: GovernanceSubject;
  reason: string;
  evidence?: GovernanceEvidence;
};

export type GovernanceResult = {
  status: GovernanceStatus;
  ruleSetVersion: string;
  planYear: number;
  findings: GovernanceFinding[];
};

export type OrganizationalGovernanceIdentityReadPort = {
  getPerson(id: string): Person | undefined;
  getPosition(id: string): Position | undefined;
  getUnit(id: string): Unit | undefined;
};

export type OrganizationalGovernanceCanonicalFactReadPort = {
  getBusinessRole(id: string): BusinessRole | undefined;
  getExpertise(id: string): Expertise | undefined;
};

export type OrganizationalGovernanceAssignmentReadPort = {
  listAssignments(): ContextProgramAssignment[];
};

export type OrganizationalGovernanceInput = {
  snapshot: OrganizationalContextSnapshot;
  identity: OrganizationalGovernanceIdentityReadPort;
  canonicalAuthority?: OrganizationalGovernanceCanonicalFactReadPort;
  assignments: readonly ContextProgramAssignment[];
  assignmentContexts?: Readonly<Record<string, Pick<
    OrganizationalContext,
    "person" | "position" | "unit" | "authorizationScope"
  >>>;
  assignmentOrigins?: Readonly<Record<string, FactOrigin>>;
  identityOrigins?: Readonly<Record<string, FactOrigin>>;
  identityProvenance?: Readonly<Record<string, OrganizationalProvenanceReference>>;
};

const identityKey = (type: GovernanceSubject["type"], id: string) => `${type}:${id}`;

function provenanceEvidence(
  provenance: OrganizationalProvenanceReference | undefined,
  planYear?: number
): GovernanceEvidence | undefined {
  if (!provenance && planYear === undefined) return undefined;
  return {
    ...(provenance ? { provenance: [provenance], sourceYear: provenance.sourceYear } : {}),
    ...(planYear === undefined ? {} : { planYear })
  };
}

function stableEvidence(evidence: GovernanceEvidence | undefined): string {
  return JSON.stringify(evidence ?? null);
}

function stableFinding(finding: GovernanceFinding): string {
  return JSON.stringify([
    finding.ruleId,
    finding.severity,
    finding.subject.type,
    finding.subject.id ?? "",
    finding.reason,
    stableEvidence(finding.evidence)
  ]);
}

function addFinding(findings: GovernanceFinding[], finding: GovernanceFinding): void {
  findings.push(finding);
}

function validateFactOrigin(
  findings: GovernanceFinding[],
  origin: FactOrigin | undefined,
  subject: GovernanceSubject,
  provenance: OrganizationalProvenanceReference | undefined,
  requireImportedProvenance = false
): void {
  if (origin === "IMPORTED" && requireImportedProvenance && !provenance) {
    addFinding(findings, {
      ruleId: "provenance.imported.required",
      severity: "BLOCKER",
      subject,
      reason: "Imported organizational references require provenance."
    });
  }
  if (origin === "MANUAL") {
    addFinding(findings, {
      ruleId: "provenance.manual.review",
      severity: "WARNING",
      subject,
      reason: "Manual fact remains manual and requires review before being treated as canonical.",
      evidence: provenanceEvidence(provenance)
    });
  }
  if (origin === "INFERRED") {
    addFinding(findings, {
      ruleId: "provenance.inferred.not-canonical",
      severity: "BLOCKER",
      subject,
      reason: "An inferred fact cannot satisfy a canonical governance requirement.",
      evidence: provenanceEvidence(provenance)
    });
  }
  if (origin === "UNRESOLVED") {
    addFinding(findings, {
      ruleId: "identity.unresolved",
      severity: "BLOCKER",
      subject,
      reason: "The fact is explicitly unresolved and cannot satisfy governance.",
      evidence: provenanceEvidence(provenance, undefined)
    });
  }
}

function validateContext(
  findings: GovernanceFinding[],
  input: OrganizationalGovernanceInput
): void {
  const context = input.snapshot.context;
  const subject = { type: "CONTEXT" as const, id: context.subject.id };

  if (input.snapshot.quality.status === "UNAVAILABLE" || !context.authorizationScope.subjectVisible) {
    addFinding(findings, {
      ruleId: "context.authorization.unavailable",
      severity: "BLOCKER",
      subject,
      reason: "Required organizational context is unavailable or outside authorization scope.",
      evidence: { resolutionStatus: "UNAVAILABLE" }
    });
  }

  for (const reference of context.unresolvedReferences) {
    if (reference.resolutionStatus !== "RESOLVED") {
      addFinding(findings, {
        ruleId: "identity.unresolved",
        severity: "BLOCKER",
        subject: { type: reference.entityType, id: reference.canonicalId ?? reference.externalId },
        reason: "An organizational identity is unresolved or ambiguous.",
        evidence: { resolutionStatus: reference.resolutionStatus }
      });
    }
  }
  for (const evidence of context.historicalEvidence) {
    if (evidence.reference.sourceYear === currentPlanYear() || !evidence.sourceOnly) {
      addFinding(findings, {
        ruleId: "plan-year.historical-evidence.leakage",
        severity: "BLOCKER",
        subject: {
          type: evidence.entityType,
          id: evidence.entityId
        },
        reason: `Historical/reference evidence cannot satisfy canonical ${currentPlanYear()} governance.`,
        evidence: {
          provenance: [evidence.reference],
          sourceYear: evidence.reference.sourceYear,
          resolutionStatus: evidence.sourceOnly ? "SOURCE_ONLY" : "CANONICAL_LEAKAGE"
        }
      });
    }
  }

  const person = context.person.status === "KNOWN" ? context.person.value : undefined;
  const position = context.position.status === "KNOWN" ? context.position.value : undefined;
  const unit = context.unit.status === "KNOWN" ? context.unit.value : undefined;
  const requiredFields = context.subject.type === "PERSON"
    ? (["person", "position", "unit"] as const)
    : context.subject.type === "UNIT"
      ? (["unit"] as const)
      : [];
  for (const field of requiredFields) {
    if (context[field].status === "MISSING") {
      addFinding(findings, {
        ruleId: `context.${field}.missing`,
        severity: "BLOCKER",
        subject,
        reason: `Required organizational fact ${field} is missing.`
      });
    } else if (context[field].status === "UNAVAILABLE") {
      addFinding(findings, {
        ruleId: `context.${field}.unavailable`,
        severity: "BLOCKER",
        subject,
        reason: `Required organizational fact ${field} is unavailable.`
      });
    }
  }

  if (context.person.status === "KNOWN") {
    validateFactOrigin(
      findings,
      input.identityOrigins?.[identityKey("PERSON", person!.id)],
      { type: "PERSON", id: person!.id },
      input.identityProvenance?.[identityKey("PERSON", person!.id)],
      true
    );
    if (!input.identity.getPerson(person!.id)) {
      addFinding(findings, {
        ruleId: "identity.person.canonical",
        severity: "BLOCKER",
        subject: { type: "PERSON", id: person!.id },
        reason: "Person is not present in the canonical identity read-side."
      });
    }
    if (person!.status === "INACTIVE") {
      addFinding(findings, {
        ruleId: "identity.inactive",
        severity: "BLOCKER",
        subject: { type: "PERSON", id: person!.id },
        reason: "An inactive Person cannot satisfy an active governance requirement."
      });
    }
    if (person!.positionId && context.position.status !== "KNOWN") {
      addFinding(findings, {
        ruleId: "organization.person-position.missing",
        severity: "BLOCKER",
        subject: { type: "PERSON", id: person!.id },
        reason: "Person declares a Position relationship that is missing or unavailable."
      });
    }
  }

  if (position) {
    validateFactOrigin(
      findings,
      input.identityOrigins?.[identityKey("POSITION", position.id)],
      { type: "POSITION", id: position.id },
      input.identityProvenance?.[identityKey("POSITION", position.id)],
      true
    );
    if (!input.identity.getPosition(position.id)) {
      addFinding(findings, {
        ruleId: "identity.position.canonical",
        severity: "BLOCKER",
        subject: { type: "POSITION", id: position.id },
        reason: "Position is not present in the canonical identity read-side."
      });
    }
    if (position.status === "INACTIVE") {
      addFinding(findings, {
        ruleId: "identity.inactive",
        severity: "BLOCKER",
        subject: { type: "POSITION", id: position.id },
        reason: "An inactive Position cannot satisfy an active governance requirement."
      });
    }
    if (context.unit.status !== "KNOWN") {
      addFinding(findings, {
        ruleId: "organization.position-unit.missing",
        severity: "BLOCKER",
        subject: { type: "POSITION", id: position.id },
        reason: "Position → Unit relationship is missing or unavailable."
      });
    }
  }

  if (unit) {
    validateFactOrigin(
      findings,
      input.identityOrigins?.[identityKey("UNIT", unit.id)],
      { type: "UNIT", id: unit.id },
      input.identityProvenance?.[identityKey("UNIT", unit.id)],
      true
    );
    if (!input.identity.getUnit(unit.id)) {
      addFinding(findings, {
        ruleId: "identity.unit.canonical",
        severity: "BLOCKER",
        subject: { type: "UNIT", id: unit.id },
        reason: "Unit is not present in the canonical identity read-side."
      });
    }
    if (unit.status === "INACTIVE") {
      addFinding(findings, {
        ruleId: "identity.inactive",
        severity: "BLOCKER",
        subject: { type: "UNIT", id: unit.id },
        reason: "An inactive Unit cannot satisfy an active governance requirement."
      });
    }
  }

  const canonicalPerson = person ? input.identity.getPerson(person.id) : undefined;
  const canonicalPosition = position ? input.identity.getPosition(position.id) : undefined;
  const canonicalUnit = unit ? input.identity.getUnit(unit.id) : undefined;

  if (person && position && person.positionId && person.positionId !== position.id) {
    addFinding(findings, {
      ruleId: "organization.person-position.contradictory",
      severity: "BLOCKER",
      subject: { type: "PERSON", id: person.id },
      reason: "Person → Position relationship contradicts the context Position."
    });
  }
  if (person && canonicalPerson && canonicalPerson.positionId !== person.positionId) {
    addFinding(findings, {
      ruleId: "organization.person-position.canonical-contradictory",
      severity: "BLOCKER",
      subject: { type: "PERSON", id: person.id },
      reason: "Canonical Person → Position contradicts the trusted context."
    });
  }
  if (position && canonicalPosition && canonicalPosition.unitId !== position.unitId) {
    addFinding(findings, {
      ruleId: "organization.position-unit.canonical-contradictory",
      severity: "BLOCKER",
      subject: { type: "POSITION", id: position.id },
      reason: "Canonical Position → Unit contradicts the trusted context."
    });
  }
  if (person && canonicalPerson?.positionId && canonicalUnit) {
    const derivedPosition = input.identity.getPosition(canonicalPerson.positionId);
    if (derivedPosition && derivedPosition.unitId !== unit?.id) {
      addFinding(findings, {
        ruleId: "organization.person-unit.canonical-contradictory",
        severity: "BLOCKER",
        subject: { type: "PERSON", id: person.id },
        reason: "Canonical derived Person → Unit contradicts the trusted context."
      });
    }
  }
  if (position && unit && position.unitId !== unit.id) {
    addFinding(findings, {
      ruleId: "organization.position-unit.contradictory",
      severity: "BLOCKER",
      subject: { type: "POSITION", id: position.id },
      reason: "Position → Unit relationship contradicts the context Unit."
    });
  }
  if (person && position && unit && person.positionId === position.id && position.unitId !== unit.id) {
    addFinding(findings, {
      ruleId: "organization.person-unit.derived-contradictory",
      severity: "BLOCKER",
      subject: { type: "PERSON", id: person.id },
      reason: "Derived Person → Unit relationship contradicts Position → Unit."
    });
  }

  for (const role of context.businessRoles) {
    const origin = input.identityOrigins?.[identityKey("BUSINESS_ROLE", role.id)];
    if (origin !== "CANONICAL" || !input.canonicalAuthority?.getBusinessRole(role.id)) {
      addFinding(findings, {
        ruleId: "identity.business-role.canonical-source",
        severity: "BLOCKER",
        subject: { type: "BUSINESS_ROLE", id: role.id },
        reason: "BusinessRole must be explicitly supplied by an approved canonical source."
      });
    }
    validateFactOrigin(
      findings,
      origin,
      { type: "BUSINESS_ROLE", id: role.id },
      input.identityProvenance?.[identityKey("BUSINESS_ROLE", role.id)],
      true
    );
  }
  for (const expertise of context.expertise) {
    const origin = input.identityOrigins?.[identityKey("EXPERTISE", expertise.id)];
    if (origin !== "CANONICAL" || !input.canonicalAuthority?.getExpertise(expertise.id)) {
      addFinding(findings, {
        ruleId: "identity.expertise.canonical-source",
        severity: "BLOCKER",
        subject: { type: "EXPERTISE", id: expertise.id },
        reason: "Expertise must be explicitly supplied by an approved canonical source."
      });
    }
    validateFactOrigin(
      findings,
      origin,
      { type: "EXPERTISE", id: expertise.id },
      input.identityProvenance?.[identityKey("EXPERTISE", expertise.id)],
      true
    );
  }
}

function validateAssignment(
  findings: GovernanceFinding[],
  assignment: ContextProgramAssignment,
  input: OrganizationalGovernanceInput
): void {
  const subject: GovernanceSubject = { type: "ASSIGNMENT", id: assignment.id };
  const evidence = provenanceEvidence(assignment.provenance, assignment.planYear);
  const origin = input.assignmentOrigins?.[assignment.id];

  validateFactOrigin(findings, origin, subject, assignment.provenance);

  const rootSubjectMatchesAssignment =
    (assignment.entityType === "PERSON"
      && input.snapshot.context.subject.type === "PERSON"
      && input.snapshot.context.subject.id === assignment.entityId)
    || (assignment.entityType === "UNIT"
      && input.snapshot.context.subject.type === "UNIT"
      && input.snapshot.context.subject.id === assignment.entityId);
  const assignmentContext = input.assignmentContexts?.[assignment.id];
  const requiresOrganizationalContext =
    assignment.role === "OWNER" || assignment.role === "EXECUTOR";
  const organizationalContext =
    assignmentContext
    ?? (rootSubjectMatchesAssignment ? input.snapshot.context : undefined);

  if (assignmentContext && !assignmentContext.authorizationScope.subjectVisible) {
    addFinding(findings, {
      ruleId: "assignment.context.authorization.unavailable",
      severity: "BLOCKER",
      subject,
      reason: "Assignment-specific organizational context is outside authorization scope.",
      evidence
    });
  }

  if (requiresOrganizationalContext && !organizationalContext) {
    addFinding(findings, {
      ruleId: "assignment.context.required",
      severity: "BLOCKER",
      subject,
      reason: "OWNER/EXECUTOR assignment requires assignment-specific organizational context unless it matches the root context subject.",
      evidence
    });
  }
  if (requiresOrganizationalContext && organizationalContext) {
    if (assignment.entityType === "PERSON"
      && (organizationalContext.person.status !== "KNOWN"
        || organizationalContext.person.value.id !== assignment.entityId)) {
      addFinding(findings, {
        ruleId: "assignment.context.identity.mismatch",
        severity: "BLOCKER",
        subject,
        reason: "Assignment context Person must exactly match the PERSON assignment target.",
        evidence
      });
    }
    if (assignment.entityType === "UNIT"
      && (organizationalContext.unit.status !== "KNOWN"
        || organizationalContext.unit.value.id !== assignment.entityId)) {
      addFinding(findings, {
        ruleId: "assignment.context.identity.mismatch",
        severity: "BLOCKER",
        subject,
        reason: "Assignment context Unit must exactly match the UNIT assignment target.",
        evidence
      });
    }
    if (!assignmentContext && !organizationalContext.authorizationScope.subjectVisible) {
      addFinding(findings, {
        ruleId: "assignment.context.authorization.unavailable",
        severity: "BLOCKER",
        subject,
        reason: "Assignment-specific organizational context is outside authorization scope.",
        evidence
      });
    }
    const requiredContextFields = assignment.entityType === "PERSON"
      ? (["person", "position", "unit"] as const)
      : (["unit"] as const);
    for (const field of requiredContextFields) {
      if (organizationalContext[field].status !== "KNOWN") {
        addFinding(findings, {
          ruleId: `assignment.context.${field}.unavailable`,
          severity: "BLOCKER",
          subject,
          reason: `Required assignment organizational fact ${field} is missing or unavailable.`,
          evidence
        });
      }
    }
    const contextPerson = organizationalContext.person.status === "KNOWN" ? organizationalContext.person.value : undefined;
    const contextPosition = organizationalContext.position.status === "KNOWN" ? organizationalContext.position.value : undefined;
    const contextUnit = organizationalContext.unit.status === "KNOWN" ? organizationalContext.unit.value : undefined;
    if (contextPerson && !input.identity.getPerson(contextPerson.id)) {
      addFinding(findings, {
        ruleId: "identity.person.canonical",
        severity: "BLOCKER",
        subject: { type: "PERSON", id: contextPerson.id },
        reason: "Assignment context Person is not present in the canonical identity read-side."
      });
    }
    if (contextPosition && !input.identity.getPosition(contextPosition.id)) {
      addFinding(findings, {
        ruleId: "identity.position.canonical",
        severity: "BLOCKER",
        subject: { type: "POSITION", id: contextPosition.id },
        reason: "Assignment context Position is not present in the canonical identity read-side."
      });
    }
    if (contextUnit && !input.identity.getUnit(contextUnit.id)) {
      addFinding(findings, {
        ruleId: "identity.unit.canonical",
        severity: "BLOCKER",
        subject: { type: "UNIT", id: contextUnit.id },
        reason: "Assignment context Unit is not present in the canonical identity read-side."
      });
    }
    if (contextPerson?.status === "INACTIVE" || contextPosition?.status === "INACTIVE" || contextUnit?.status === "INACTIVE") {
      addFinding(findings, {
        ruleId: "identity.inactive",
        severity: "BLOCKER",
        subject,
        reason: "An inactive assignment organizational identity cannot satisfy governance.",
        evidence
      });
    }
    if (contextPerson && contextPosition && contextPerson.positionId !== contextPosition.id) {
      addFinding(findings, {
        ruleId: "organization.person-position.contradictory",
        severity: "BLOCKER",
        subject,
        reason: "Assignment context Person → Position relationship is contradictory.",
        evidence
      });
    }
    if (contextPosition && contextUnit && contextPosition.unitId !== contextUnit.id) {
      addFinding(findings, {
        ruleId: "organization.position-unit.contradictory",
        severity: "BLOCKER",
        subject,
        reason: "Assignment context Position → Unit relationship is contradictory.",
        evidence
      });
    }
    if (contextPerson && contextPosition && contextUnit) {
      const canonicalPerson = input.identity.getPerson(contextPerson.id);
      const canonicalPosition = input.identity.getPosition(contextPosition.id);
      const canonicalUnit = input.identity.getUnit(contextUnit.id);
      if (canonicalPerson?.positionId !== contextPerson.positionId
        || canonicalPosition?.unitId !== contextPosition.unitId
        || canonicalPerson?.positionId !== canonicalPosition?.id
        || canonicalPosition?.unitId !== canonicalUnit?.id) {
        addFinding(findings, {
          ruleId: "organization.assignment-context.canonical-contradictory",
          severity: "BLOCKER",
          subject,
          reason: "Assignment context Person → Position → Unit contradicts canonical read-side relationships.",
          evidence
        });
      }
    }
  }

  if (assignment.planYear !== currentPlanYear()) {
    addFinding(findings, {
      ruleId: "plan-year.assignment.not-canonical",
      severity: "BLOCKER",
      subject,
      reason: `Only plan year ${currentPlanYear()} assignments may participate in canonical governance.`,
      evidence
    });
    return;
  }

  if (assignment.provenance && assignment.provenance.sourceYear !== currentPlanYear()) {
    addFinding(findings, {
      ruleId: "plan-year.historical-assignment.blocked",
      severity: "BLOCKER",
      subject,
      reason: `Historical provenance cannot satisfy a canonical ${currentPlanYear()} assignment.`,
      evidence
    });
  }

  if (origin === "IMPORTED" && !assignment.provenance) {
    addFinding(findings, {
      ruleId: "provenance.imported.required",
      severity: "BLOCKER",
      subject,
      reason: "Imported organizational assignments require provenance.",
      evidence
    });
  }

  if (!["OWNER", "EXECUTOR", "COLLABORATOR"].includes(assignment.role)) {
    addFinding(findings, {
      ruleId: "assignment.role.invalid",
      severity: "BLOCKER",
      subject,
      reason: "Assignment role is not a supported OWNER, EXECUTOR, or COLLABORATOR value.",
      evidence
    });
    return;
  }

  if (assignment.entityType !== "PERSON" && assignment.entityType !== "UNIT") {
    addFinding(findings, {
      ruleId: "assignment.target-type.invalid",
      severity: "BLOCKER",
      subject,
      reason: "Assignment target type must be PERSON or UNIT.",
      evidence
    });
    return;
  }

  if (assignment.entityType === "PERSON") {
    const person = input.identity.getPerson(assignment.entityId);
    if (!person) {
      addFinding(findings, {
        ruleId: "assignment.person.canonical",
        severity: "BLOCKER",
        subject: { type: "PERSON", id: assignment.entityId },
        reason: "PERSON assignment target is not a canonical Person.",
        evidence: { ...evidence, resolutionStatus: "UNKNOWN" }
      });
      return;
    }
    if (person.status === "INACTIVE") {
      addFinding(findings, {
        ruleId: "assignment.target.inactive",
        severity: "BLOCKER",
        subject: { type: "PERSON", id: person.id },
        reason: "Assignment target is inactive.",
        evidence
      });
    }
    if (assignment.role === "OWNER" || assignment.role === "EXECUTOR") {
      const position = person.positionId ? input.identity.getPosition(person.positionId) : undefined;
      const unit = position ? input.identity.getUnit(position.unitId) : undefined;
      if (!position) {
        addFinding(findings, {
          ruleId: "assignment.organization.position.missing",
          severity: "BLOCKER",
          subject: { type: "PERSON", id: person.id },
          reason: "OWNER/EXECUTOR target has no canonical Position relationship.",
          evidence
        });
      } else if (!unit) {
        addFinding(findings, {
          ruleId: "assignment.organization.unit.missing",
          severity: "BLOCKER",
          subject: { type: "PERSON", id: person.id },
          reason: "OWNER/EXECUTOR target Position has no canonical Unit relationship.",
          evidence
        });
      } else {
        const contextUnit = organizationalContext?.unit;
        if (requiresOrganizationalContext && contextUnit?.status !== "KNOWN") {
          addFinding(findings, {
            ruleId: "assignment.context.unavailable",
            severity: "BLOCKER",
            subject,
            reason: "Required OWNER/EXECUTOR organizational context is missing or unavailable.",
            evidence
          });
        }
        if (contextUnit?.status === "KNOWN" && contextUnit.value.id !== unit.id) {
          addFinding(findings, {
            ruleId: "assignment.organization.unit.contradictory",
            severity: "BLOCKER",
            subject: { type: "ASSIGNMENT", id: assignment.id },
            reason: "OWNER/EXECUTOR target Unit contradicts the trusted context Unit.",
            evidence
          });
        }
      }
    }
  } else {
    const unit = input.identity.getUnit(assignment.entityId);
    if (!unit) {
      addFinding(findings, {
        ruleId: "assignment.unit.canonical",
        severity: "BLOCKER",
        subject: { type: "UNIT", id: assignment.entityId },
        reason: "UNIT assignment target is not a canonical Unit.",
        evidence: { ...evidence, resolutionStatus: "UNKNOWN" }
      });
      return;
    }
    if (unit.status === "INACTIVE") {
      addFinding(findings, {
        ruleId: "assignment.target.inactive",
        severity: "BLOCKER",
        subject: { type: "UNIT", id: unit.id },
        reason: "Assignment target is inactive.",
        evidence
      });
    }
    const contextUnit = organizationalContext?.unit;
    if (requiresOrganizationalContext && contextUnit?.status !== "KNOWN") {
      addFinding(findings, {
        ruleId: "assignment.context.unavailable",
        severity: "BLOCKER",
        subject,
        reason: "Required OWNER/EXECUTOR organizational context is missing or unavailable.",
        evidence
      });
    }
    if ((assignment.role === "OWNER" || assignment.role === "EXECUTOR")
      && contextUnit?.status === "KNOWN"
      && contextUnit.value.id !== unit.id) {
      addFinding(findings, {
        ruleId: "assignment.organization.unit.contradictory",
        severity: "BLOCKER",
        subject,
        reason: "OWNER/EXECUTOR Unit target contradicts the trusted context Unit.",
        evidence
      });
    }
  }
}

export function evaluateOrganizationalGovernance(
  input: OrganizationalGovernanceInput
): GovernanceResult {
  const findings: GovernanceFinding[] = [];
  validateContext(findings, input);
  for (const assignment of input.assignments) validateAssignment(findings, assignment, input);

  const deduplicated = [...new Map(findings.map((finding) => [stableFinding(finding), finding])).values()]
    .sort((left, right) =>
      left.ruleId.localeCompare(right.ruleId)
      || left.subject.type.localeCompare(right.subject.type)
      || (left.subject.id ?? "").localeCompare(right.subject.id ?? "")
      || left.reason.localeCompare(right.reason)
    );
  const status = deduplicated.some((finding) => finding.severity === "BLOCKER")
    ? "BLOCKED"
    : deduplicated.some((finding) => finding.severity === "WARNING")
      ? "WARNING"
      : "PASS";

  return {
    status,
    ruleSetVersion: GOVERNANCE_RULE_SET_VERSION,
    planYear: currentPlanYear(),
    findings: deduplicated
  };
}

export function createOrganizationalGovernanceInput(
  snapshot: OrganizationalContextSnapshot,
  identity: OrganizationalGovernanceIdentityReadPort,
  assignments: OrganizationalGovernanceAssignmentReadPort,
  options: Pick<OrganizationalGovernanceInput, "assignmentOrigins" | "identityOrigins"> = {}
): OrganizationalGovernanceInput {
  return {
    snapshot,
    identity,
    assignments: assignments.listAssignments(),
    ...options
  };
}
