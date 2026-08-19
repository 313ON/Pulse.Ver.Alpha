import { getReadOnlyDatabase } from "../db";
import type { OrganizationalContextReadPort } from "../../application/organization/OrganizationalContext";
import type { ContextHistoricalEvidence, ContextProgramAssignment } from "../../application/organization/OrganizationalContext";

type AssignmentRow = {
  id: string;
  public_id: string;
  owner_person_id: string;
  owner: string;
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
        SELECT w.id, w.public_id, w.owner_person_id, p.full_name AS owner, w.plan_year
        FROM work_items w
        JOIN people p ON p.id = w.owner_person_id
        ORDER BY w.plan_year, w.public_id
      `)
      .all() as AssignmentRow[];
    return rows.map((row) => ({
      id: `${row.id}:OWNER`,
      entityType: "PERSON",
      entityId: row.owner_person_id,
      displayName: row.owner,
      role: "OWNER",
      responsibilityType: "PRIMARY",
      programEntityId: row.public_id,
      planYear: row.plan_year
    }));
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
