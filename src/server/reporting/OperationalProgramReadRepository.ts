import { getReadOnlyDatabase } from "../db";
import type { OperationalProgramReadPort } from "../../application/reporting/ports";
import type { ContextProgramAssignment } from "../../application/organization/OrganizationalContext";
import type { UnknownRow } from "../../application/program/ports";

type AssignmentRow = {
  work_item_id: string;
  public_id: string;
  owner_person_id: string;
  owner: string;
  collaborator_person_id?: string;
  collaborator?: string;
  plan_year: number;
};

export class SQLiteOperationalProgramReadRepository implements OperationalProgramReadPort {
  listGoals(planYear: number): UnknownRow[] {
    return getReadOnlyDatabase()
      .prepare("SELECT * FROM strategic_goals WHERE plan_year = ? ORDER BY id")
      .all(planYear) as UnknownRow[];
  }

  listObjectives(planYear: number): UnknownRow[] {
    return getReadOnlyDatabase()
      .prepare(`
        SELECT sg.*, g.plan_year
        FROM sub_goals sg
        JOIN strategic_goals g ON g.id = sg.goal_id
        WHERE g.plan_year = ?
        ORDER BY sg.goal_id, sg.id
      `)
      .all(planYear) as UnknownRow[];
  }

  listActivities(planYear: number): UnknownRow[] {
    return getReadOnlyDatabase()
      .prepare(`
        SELECT a.*, sg.goal_id, g.plan_year, p.full_name AS owner
        FROM activities a
        JOIN sub_goals sg ON sg.id = a.sub_goal_id
        JOIN strategic_goals g ON g.id = sg.goal_id
        LEFT JOIN people p ON p.id = a.owner_person_id
        WHERE g.plan_year = ?
        ORDER BY sg.goal_id, a.sub_goal_id, a.id
      `)
      .all(planYear) as UnknownRow[];
  }

  listActions(planYear: number): UnknownRow[] {
    return getReadOnlyDatabase()
      .prepare(`
        SELECT w.*, p.full_name AS owner, d.name AS department
        FROM work_items w
        JOIN people p ON p.id = w.owner_person_id
        JOIN departments d ON d.id = w.department_id
        WHERE w.plan_year = ?
        ORDER BY w.planned_end, w.public_id
      `)
      .all(planYear) as UnknownRow[];
  }

  listKpis(planYear: number): UnknownRow[] {
    return getReadOnlyDatabase()
      .prepare(`
        SELECT k.*
        FROM kpis k
        LEFT JOIN work_items w ON w.id = k.work_item_id
        WHERE k.work_item_id IS NULL OR w.plan_year = ?
        ORDER BY k.name
      `)
      .all(planYear) as UnknownRow[];
  }

  listActionAssignments(planYear: number): ReadonlyMap<string, readonly ContextProgramAssignment[]> {
    const rows = getReadOnlyDatabase()
      .prepare(`
        SELECT w.id AS work_item_id, w.public_id, w.owner_person_id, owner.full_name AS owner,
          w.plan_year,
          collaborator.id AS collaborator_person_id, collaborator.full_name AS collaborator
        FROM work_items w
        JOIN people owner ON owner.id = w.owner_person_id
        LEFT JOIN work_item_collaborators wc ON wc.work_item_id = w.id
        LEFT JOIN people collaborator ON collaborator.id = wc.person_id
        WHERE w.plan_year = ?
        ORDER BY w.public_id, collaborator.id
      `)
      .all(planYear) as AssignmentRow[];
    const assignments = new Map<string, ContextProgramAssignment[]>();
    for (const [index, row] of rows.entries()) {
      const provenance = {
        workbook: "pulse.sqlite",
        sheet: "work_items",
        row: index + 2,
        column: "owner_person_id",
        cell: `owner_person_id@${row.public_id}`,
        sourceYear: row.plan_year
      };
      const current = assignments.get(row.public_id) ?? [];
      if (!current.some((assignment) => assignment.id === `${row.work_item_id}:OWNER`)) {
        current.push({
          id: `${row.work_item_id}:OWNER`,
          entityType: "PERSON",
          entityId: row.owner_person_id,
          displayName: row.owner,
          role: "OWNER",
          responsibilityType: "PRIMARY",
          programEntityId: row.public_id,
          planYear: row.plan_year,
          provenance
        });
      }
      if (row.collaborator_person_id && row.collaborator) {
        current.push({
          id: `${row.work_item_id}:COLLABORATOR:${row.collaborator_person_id}`,
          entityType: "PERSON",
          entityId: row.collaborator_person_id,
          displayName: row.collaborator,
          role: "COLLABORATOR",
          responsibilityType: "SUPPORT",
          programEntityId: row.public_id,
          planYear: row.plan_year,
          provenance
        });
      }
      assignments.set(row.public_id, current);
    }
    return assignments;
  }
}
