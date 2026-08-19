import { getReadOnlyDatabase } from "../db";
import type { OrganizationalContextReadPort } from "../../application/organization/OrganizationalContext";
import type { ContextHistoricalEvidence, ContextProgramAssignment } from "../../application/organization/OrganizationalContext";

type AssignmentRow = {
  id: string;
  public_id: string;
  owner_person_id: string;
  owner: string;
  collaborator_person_id?: string;
  collaborator?: string;
  plan_year: number;
};

/**
 * Production read-side adapter for the organizational context boundary.
 * It exposes existing canonical work-item ownership as PERSON assignments
 * and intentionally has no write or schema-initialization capability.
 */
export class SQLiteOrganizationalContextReadRepository implements OrganizationalContextReadPort {
  listAssignments(): ContextProgramAssignment[] {
    const rows = getReadOnlyDatabase()
      .prepare(`
        SELECT w.id, w.public_id, w.owner_person_id, p.full_name AS owner,
          c.id AS collaborator_person_id, c.full_name AS collaborator, w.plan_year
        FROM work_items w
        JOIN people p ON p.id = w.owner_person_id
        LEFT JOIN work_item_collaborators wc ON wc.work_item_id = w.id
        LEFT JOIN people c ON c.id = wc.person_id
        ORDER BY w.plan_year, w.public_id
      `)
      .all() as AssignmentRow[];
    return rows.flatMap((row, index) => {
      const provenance = {
        workbook: "pulse.sqlite",
        sheet: "work_items",
        row: index + 2,
        column: "owner_person_id",
        cell: `owner_person_id@${row.public_id}`,
        sourceYear: row.plan_year
      };
      return [
        {
          id: `${row.id}:OWNER`,
          entityType: "PERSON" as const,
          entityId: row.owner_person_id,
          displayName: row.owner,
          role: "OWNER" as const,
          responsibilityType: "PRIMARY" as const,
          programEntityId: row.public_id,
          planYear: row.plan_year,
          provenance
        },
        ...(row.collaborator_person_id && row.collaborator
          ? [{
              id: `${row.id}:COLLABORATOR:${row.collaborator_person_id}`,
              entityType: "PERSON" as const,
              entityId: row.collaborator_person_id,
              displayName: row.collaborator,
              role: "COLLABORATOR" as const,
              responsibilityType: "SUPPORT" as const,
              programEntityId: row.public_id,
              planYear: row.plan_year,
              provenance
            }]
          : [])
      ];
    });
  }

  listHistoricalEvidence(): ContextHistoricalEvidence[] {
    return [];
  }

  listPersonRoles(): [] {
    return [];
  }

  listPersonExpertise(): [] {
    return [];
  }
}
