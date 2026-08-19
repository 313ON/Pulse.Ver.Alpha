import { describe, expect, it } from "vitest";
import type { OrganizationalContext } from "./OrganizationalContext";
import {
  collectContextProvenance,
  createOrganizationalContextSnapshot,
  evaluateOrganizationalContext
} from "./OrganizationalContextHardening";

function context(overrides: Partial<OrganizationalContext> = {}): OrganizationalContext {
  return {
    subject: { type: "PERSON", id: "person-1" },
    person: { status: "KNOWN", value: { id: "person-1", fullName: "Person", status: "ACTIVE" } },
    position: { status: "KNOWN", value: { id: "position-1", title: "Position", unitId: "unit-1" } },
    unit: { status: "KNOWN", value: { id: "unit-1", name: "Unit", status: "ACTIVE" } },
    positions: [],
    people: [],
    businessRoles: [],
    expertise: [],
    assignments: [],
    historicalEvidence: [],
    unresolvedReferences: [],
    provenance: [],
    authorizationScope: { scope: "COMPANY", subjectVisible: true },
    generatedAt: "2026-08-19T00:00:00.000Z",
    ...overrides
  };
}

describe("OrganizationalContext hardening", () => {
  it("evaluates complete, partial, and unavailable data without inventing confidence", () => {
    expect(evaluateOrganizationalContext(context()).status).toBe("COMPLETE");
    expect(evaluateOrganizationalContext(context({
      position: { status: "MISSING", reason: "POSITION_NOT_ASSIGNED" },
      unit: { status: "MISSING", reason: "UNIT_NOT_DERIVED" }
    }))).toMatchObject({
      status: "PARTIAL",
      missingFields: ["position", "unit"]
    });
    expect(evaluateOrganizationalContext(context({
      person: { status: "UNAVAILABLE", reason: "OUTSIDE_AUTHORIZATION_SCOPE" }
    }))).toMatchObject({ status: "UNAVAILABLE" });
    expect(evaluateOrganizationalContext(context({
      authorizationScope: {
        scope: "OWN",
        subjectVisible: false,
        reason: "OUTSIDE_AUTHORIZATION_SCOPE"
      }
    }))).toMatchObject({
      status: "UNAVAILABLE",
      missingFields: ["authorizationScope"]
    });
  });

  it("propagates provenance without losing metadata variants", () => {
    const reference = {
      workbook: "Version 7 Khordad 1404.xlsx",
      sheet: "Organization",
      row: 7,
      column: "B",
      cell: "B8",
      sourceYear: 1404
    };
    const result = collectContextProvenance({
      assignments: [{
        id: "assignment-1",
        entityType: "PERSON",
        entityId: "person-1",
        displayName: "Person",
        role: "OWNER",
        responsibilityType: "PRIMARY",
        programEntityId: "G10-O01-A01-T001",
        planYear: 1405,
        provenance: reference
      }],
      historicalEvidence: [{
        reference,
        entityType: "PERSON",
        entityId: "person-1",
        sourceOnly: true
      }]
    });

    expect(result).toEqual([
      { kind: "ASSIGNMENT", reference, sourceOnly: false },
      { kind: "HISTORICAL_EVIDENCE", reference, sourceOnly: true }
    ]);

    const metadataVariant = {
      ...reference,
      workbook: "Version 7: Khordad 1404.xlsx"
    };
    const collisionVariant = {
      ...reference,
      workbook: "Version 7",
      sheet: "Khordad 1404.xlsx"
    };
    const variants = collectContextProvenance({
      assignments: [
        {
          id: "assignment-1",
          entityType: "PERSON",
          entityId: "person-1",
          displayName: "Person",
          role: "OWNER",
          responsibilityType: "PRIMARY",
          programEntityId: "G10-O01-A01-T001",
          planYear: 1405,
          provenance: metadataVariant
        },
        {
          id: "assignment-2",
          entityType: "PERSON",
          entityId: "person-1",
          displayName: "Person",
          role: "OWNER",
          responsibilityType: "PRIMARY",
          programEntityId: "G10-O01-A01-T001",
          planYear: 1405,
          provenance: collisionVariant
        }
      ],
      historicalEvidence: []
    });
    expect(variants).toHaveLength(2);
    expect(new Set(variants.map((item) => JSON.stringify(item.reference))).size).toBe(2);
  });

  it("creates an isolated deeply immutable read-side snapshot and derives provenance counts", () => {
    const source = context();
    source.provenance = [{
      kind: "ASSIGNMENT",
      reference: {
        workbook: "supplied-only",
        sheet: "Sheet",
        row: 1,
        column: "A",
        cell: "A1",
        sourceYear: 1405
      },
      sourceOnly: false
    }];
    const first = createOrganizationalContextSnapshot(source);
    const second = createOrganizationalContextSnapshot(source);
    expect(first).toEqual(second);
    expect(first.subject).toEqual(source.subject);
    expect(first.generatedAt).toBe(source.generatedAt);
    expect(first.quality.status).toBe("COMPLETE");
    expect(first.quality.provenanceReferenceCount).toBe(0);
    expect(first.context).not.toBe(source);
    expect(Object.isFrozen(first.context)).toBe(true);
    expect(Object.isFrozen(first.context.authorizationScope)).toBe(true);
    expect(() => {
      (first.context.authorizationScope as { scope: "COMPANY" | "OWN" }).scope = "OWN";
    }).toThrow();
    (source.authorizationScope as { scope: "COMPANY" | "OWN" }).scope = "OWN";
    expect(first.context.authorizationScope.scope).toBe("COMPANY");
  });

  it("rejects unsupported cyclic and non-plain snapshot inputs", () => {
    const cyclic = context() as OrganizationalContext & { self?: unknown };
    cyclic.self = cyclic;
    expect(() => createOrganizationalContextSnapshot(cyclic)).toThrow(/cyclic input/);

    const nonPlain = context({
      generatedAt: new Date("2026-08-19T00:00:00.000Z") as unknown as string
    });
    expect(() => createOrganizationalContextSnapshot(nonPlain)).toThrow(/plain JSON-compatible/);
  });
});
