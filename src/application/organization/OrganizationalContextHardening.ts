import type {
  DeepReadonly,
  OrganizationalContext,
  OrganizationalContextCompleteness,
  OrganizationalContextProvenance,
  OrganizationalContextQuality,
  OrganizationalContextSnapshot
} from "./OrganizationalContext";

function provenanceKey(item: OrganizationalContextProvenance): string {
  const reference = item.reference;
  return JSON.stringify([
    item.kind,
    item.sourceOnly,
    reference.workbook,
    reference.sheet,
    reference.row,
    reference.column,
    reference.cell,
    reference.sourceYear
  ]);
}

export function collectContextProvenance(
  context: Pick<OrganizationalContext, "assignments" | "historicalEvidence">
): OrganizationalContextProvenance[] {
  const values: OrganizationalContextProvenance[] = [
    ...context.assignments.flatMap((assignment) =>
      assignment.provenance
        ? [{ kind: "ASSIGNMENT" as const, reference: assignment.provenance, sourceOnly: false }]
        : []
    ),
    ...context.historicalEvidence.map((evidence) => ({
      kind: "HISTORICAL_EVIDENCE" as const,
      reference: evidence.reference,
      sourceOnly: evidence.sourceOnly
    }))
  ];

  return [...new Map(values.map((value) => [provenanceKey(value), value])).values()]
    .sort((left, right) => provenanceKey(left).localeCompare(provenanceKey(right)));
}

export function evaluateOrganizationalContext(
  context: Pick<
    OrganizationalContext,
    | "person"
    | "position"
    | "unit"
    | "assignments"
    | "historicalEvidence"
    | "unresolvedReferences"
    | "authorizationScope"
  >
): OrganizationalContextQuality {
  const completeness: OrganizationalContextCompleteness = {
    person: context.person.status,
    position: context.position.status,
    unit: context.unit.status,
    assignments: context.assignments.length > 0 ? "KNOWN" : "EMPTY",
    historicalEvidence: context.historicalEvidence.length > 0 ? "KNOWN" : "EMPTY",
    unresolvedReferences: context.unresolvedReferences.length > 0 ? "PRESENT" : "NONE"
  };

  const unavailable = !context.authorizationScope.subjectVisible
    || [context.person, context.position, context.unit]
      .some((value) => value.status === "UNAVAILABLE");
  const missingFields: string[] = (["person", "position", "unit"] as const)
    .filter((field) => context[field].status === "MISSING");
  if (!context.authorizationScope.subjectVisible) missingFields.push("authorizationScope");
  const status = unavailable
    ? "UNAVAILABLE"
    : missingFields.length > 0 || context.unresolvedReferences.length > 0
      ? "PARTIAL"
      : "COMPLETE";

  return {
    status,
    completeness,
    missingFields,
    unresolvedReferenceCount: context.unresolvedReferences.length,
    provenanceReferenceCount: collectContextProvenance(context).length
  };
}

function deepClone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Snapshot inputs are restricted to acyclic, plain JSON-compatible data:
 * null, booleans, strings, finite numbers, arrays, and plain objects.
 * This keeps isolation guarantees explicit without introducing a general
 * purpose cloning framework.
 */
function assertPlainJsonCompatible(value: unknown, ancestors = new WeakSet<object>()): void {
  if (value === null || typeof value === "boolean" || typeof value === "string") return;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new TypeError("Organizational context snapshots require finite JSON-compatible numbers.");
  }
  if (typeof value !== "object") {
    throw new TypeError("Organizational context snapshots require plain JSON-compatible data.");
  }
  if (ancestors.has(value)) {
    throw new TypeError("Organizational context snapshots do not support cyclic input.");
  }
  if (Array.isArray(value)) {
    ancestors.add(value);
    value.forEach((item) => assertPlainJsonCompatible(item, ancestors));
    ancestors.delete(value);
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Organizational context snapshots require plain JSON-compatible objects.");
  }
  ancestors.add(value);
  Object.values(value).forEach((item) => assertPlainJsonCompatible(item, ancestors));
  ancestors.delete(value);
}

function deepFreeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value as DeepReadonly<T>;
}

export function createOrganizationalContextSnapshot(
  context: OrganizationalContext
): OrganizationalContextSnapshot {
  assertPlainJsonCompatible(context);
  const isolatedContext = deepClone(context);
  isolatedContext.provenance = collectContextProvenance(isolatedContext);
  const quality = evaluateOrganizationalContext(isolatedContext);
  return deepFreeze({
    subject: deepClone(isolatedContext.subject),
    generatedAt: isolatedContext.generatedAt,
    context: isolatedContext,
    quality
  });
}
