import { getReadOnlyDatabase } from "../db";
import type {
  BusinessRole,
  DerivedPersonUnit,
  Expertise,
  Person,
  Position,
  Unit
} from "../../domain/organization";

type UnitRow = {
  id: string;
  name: string;
  active: number;
};

type PositionRow = {
  id: string;
  title: string;
  department_id: string;
};

type PersonRow = {
  id: string;
  full_name: string;
  active: number;
  seat_id?: string | null;
};

export type OrganizationRepository = {
  listUnits(): Unit[];
  getUnit(id: string): Unit | undefined;
  listPositions(): Position[];
  getPosition(id: string): Position | undefined;
  listPeople(): Person[];
  getPerson(id: string): Person | undefined;
  getPersonPosition(personId: string): Position | undefined;
  getPositionUnit(positionId: string): Unit | undefined;
  getDerivedPersonUnit(personId: string): DerivedPersonUnit | undefined;
};

export type OrganizationContractBoundary = {
  listBusinessRoles(): BusinessRole[];
  listExpertise(): Expertise[];
};

function status(active: number): "ACTIVE" | "INACTIVE" {
  return active === 1 ? "ACTIVE" : "INACTIVE";
}

export class SQLiteOrganizationRepository
  implements OrganizationRepository, OrganizationContractBoundary {
  listUnits(): Unit[] {
    const rows = getReadOnlyDatabase()
      .prepare("SELECT id, name, active FROM departments ORDER BY name")
      .all() as UnitRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: status(row.active)
    }));
  }

  getUnit(id: string): Unit | undefined {
    const row = getReadOnlyDatabase()
      .prepare("SELECT id, name, active FROM departments WHERE id = ?")
      .get(id) as UnitRow | undefined;
    return row
      ? { id: row.id, name: row.name, status: status(row.active) }
      : undefined;
  }

  listPositions(): Position[] {
    const rows = getReadOnlyDatabase()
      .prepare("SELECT id, title, department_id FROM seats ORDER BY title")
      .all() as PositionRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      unitId: row.department_id
    }));
  }

  getPosition(id: string): Position | undefined {
    const row = getReadOnlyDatabase()
      .prepare("SELECT id, title, department_id FROM seats WHERE id = ?")
      .get(id) as PositionRow | undefined;
    return row
      ? { id: row.id, title: row.title, unitId: row.department_id }
      : undefined;
  }

  listPeople(): Person[] {
    const rows = getReadOnlyDatabase()
      .prepare("SELECT id, full_name, active, seat_id FROM people ORDER BY full_name")
      .all() as PersonRow[];
    return rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      status: status(row.active),
      ...(row.seat_id ? { positionId: row.seat_id } : {})
    }));
  }

  getPerson(id: string): Person | undefined {
    const row = getReadOnlyDatabase()
      .prepare("SELECT id, full_name, active, seat_id FROM people WHERE id = ?")
      .get(id) as PersonRow | undefined;
    return row
      ? {
          id: row.id,
          fullName: row.full_name,
          status: status(row.active),
          ...(row.seat_id ? { positionId: row.seat_id } : {})
        }
      : undefined;
  }

  getPersonPosition(personId: string): Position | undefined {
    const row = getReadOnlyDatabase()
      .prepare(`
        SELECT s.id, s.title, s.department_id
        FROM people p
        JOIN seats s ON s.id = p.seat_id
        WHERE p.id = ?
      `)
      .get(personId) as PositionRow | undefined;
    return row
      ? { id: row.id, title: row.title, unitId: row.department_id }
      : undefined;
  }

  getPositionUnit(positionId: string): Unit | undefined {
    const row = getReadOnlyDatabase()
      .prepare(`
        SELECT d.id, d.name, d.active
        FROM seats s
        JOIN departments d ON d.id = s.department_id
        WHERE s.id = ?
      `)
      .get(positionId) as UnitRow | undefined;
    return row
      ? { id: row.id, name: row.name, status: status(row.active) }
      : undefined;
  }

  getDerivedPersonUnit(personId: string): DerivedPersonUnit | undefined {
    const row = getReadOnlyDatabase()
      .prepare(`
        SELECT s.department_id AS unit_id
        FROM people p
        JOIN seats s ON s.id = p.seat_id
        WHERE p.id = ?
      `)
      .get(personId) as { unit_id: string } | undefined;
    return row
      ? { personId, unitId: row.unit_id, derivation: "POSITION" }
      : undefined;
  }

  listBusinessRoles(): BusinessRole[] {
    // Business roles are deliberately not sourced from seats, app_roles, users,
    // or work_items.role_id in this compatibility boundary.
    return [];
  }

  listExpertise(): Expertise[] {
    return [];
  }
}
