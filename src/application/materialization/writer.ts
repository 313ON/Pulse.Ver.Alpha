import { createHash, randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { MaterializationPlan, MaterializationPlanItem } from "./plan";
import type { MaterializationOperation, MaterializationCounts } from "./persistence";
import { assertLegalMaterializationTransition } from "./persistence";
import { approvedMaterializationSnapshotHash, serializeApprovedMaterializationSnapshot } from "./snapshot";

export type MaterializeCanonicalPlanCommand = {
  operationId: string;
  importJobId: string;
  approvedAnalysisRevision: number;
  sourceSnapshotHash: string;
  planHash: string;
  actorUserId: string;
  targetPlanYear: number;
  plan: MaterializationPlan;
};

export type MaterializationWriterFailurePoint =
  | "goal"
  | "objective"
  | "activity"
  | "work-item"
  | "provenance"
  | "mapping"
  | "final-operation";

export type MaterializationWriterOptions = {
  now?: () => string;
  failurePoint?: MaterializationWriterFailurePoint;
  authorize?: (actorUserId: string) => void;
};

export type MaterializeCanonicalPlanResult = {
  status: "COMPLETED" | "NO_OP";
  operation: MaterializationOperation;
  counts: MaterializationWriteCounts;
};

export type MaterializationWriteCounts = MaterializationCounts & {
  goalsReused: number;
  objectivesReused: number;
  activitiesReused: number;
  workItemsReused: number;
};

type Row = Record<string, unknown>;
const typeOrder = ["goal", "departmental_goal", "objective", "activity", "action"] as const;

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  return `{${Object.entries(value as Row).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
}

function operation(row: Row): MaterializationOperation {
  return {
    operationId: String(row.operation_id),
    importJobId: String(row.import_job_id),
    approvedAnalysisRevision: Number(row.approved_analysis_revision),
    sourceSnapshotHash: String(row.source_snapshot_hash),
    actorUserId: String(row.actor_user_id),
    targetPlanYear: Number(row.target_plan_year),
    status: String(row.status) as MaterializationOperation["status"],
    requestedAt: String(row.requested_at),
    startedAt: row.started_at ? String(row.started_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    counts: {
      goals: Number(row.goal_count), objectives: Number(row.objective_count),
      activities: Number(row.activity_count), workItems: Number(row.work_item_count),
      provenance: Number(row.provenance_count),
      goalsReused: Number(row.goal_reused_count ?? 0),
      objectivesReused: Number(row.objective_reused_count ?? 0),
      activitiesReused: Number(row.activity_reused_count ?? 0),
      workItemsReused: Number(row.work_item_reused_count ?? 0)
    },
    createdAt: String(row.created_at), updatedAt: String(row.updated_at)
  };
}

function readOperation(db: Database.Database, id: string): MaterializationOperation {
  const row = db.prepare("SELECT * FROM materialization_operations WHERE operation_id = ?").get(id) as Row | undefined;
  if (!row) throw new Error(`Materialization operation "${id}" was not found.`);
  return operation(row);
}

function assertCommand(command: MaterializeCanonicalPlanCommand): void {
  const plan = command.plan;
  if (plan.status !== "READY" || plan.errors.length || plan.summary.blockedItems) throw new Error("Only a READY, unblocked materialization plan may be written.");
  if (plan.importJobId !== command.importJobId) throw new Error("Materialization plan import ID mismatch.");
  if (plan.approvedAnalysisRevision !== command.approvedAnalysisRevision) throw new Error("Materialization plan revision mismatch.");
  if (plan.sourceSnapshot.sourceSnapshotHash !== command.sourceSnapshotHash) throw new Error("Materialization plan snapshot hash mismatch.");
  if (plan.planYear !== command.targetPlanYear || plan.sourceSnapshot.targetPlanYear !== command.targetPlanYear) throw new Error("Materialization plan year mismatch.");
  const { planHash: supplied, ...withoutHash } = plan;
  const expected = createHash("sha256").update(stable({ ...withoutHash, items: [...plan.items].sort((a, b) => a.logicalIdentity.logicalKey.localeCompare(b.logicalIdentity.logicalKey)) })).digest("hex");
  if (expected !== supplied || supplied !== command.planHash) throw new Error("Materialization plan hash mismatch.");
  for (const item of plan.items) {
    if (item.entityType === "action" && !item.canonicalAllocation.publicIdInput) {
      throw new Error(`The READY plan has no public ID allocation for "${item.logicalIdentity.logicalKey}".`);
    }
  }
}

function failIf(point: MaterializationWriterFailurePoint | undefined, expected: MaterializationWriterFailurePoint): void {
  if (point === expected) throw new Error(`Injected materialization failure at ${expected}.`);
}

function idFor(item: MaterializationPlanItem, prefix: string): string {
  return `${prefix}-${item.logicalIdentity.planYear}-${item.canonicalAllocation.ordinal}`;
}

function canonicalStatus(value: unknown): string {
  const status = String(value ?? "شروع نشده").trim();
  return status === "برنامه‌ریزی‌شده" || status === "برنامه ریزی شده" ? "شروع نشده" : status;
}

function canonicalId(item: MaterializationPlanItem, ids: Map<string, string>): string {
  const existing = item.canonicalReference?.canonicalId;
  if (item.conflictState === "REUSE" && existing) return existing;
  const id = item.entityType === "goal"
    ? `G${String(item.canonicalAllocation.ordinal).padStart(2, "0")}`
    : item.entityType === "departmental_goal"
      ? `DG-${item.logicalIdentity.planYear}-${item.canonicalAllocation.ordinal}`
    : idFor(item, item.entityType === "objective" ? "objective" : item.entityType === "activity" ? "activity" : "work-item");
  ids.set(item.logicalIdentity.logicalKey, id);
  return id;
}

function resolveParent(item: MaterializationPlanItem, ids: Map<string, string>): string {
  if (!item.parent) throw new Error(`Missing parent for "${item.logicalIdentity.logicalKey}".`);
  const parent = ids.get(item.parent.logicalKey);
  if (!parent) throw new Error(`Parent was not materialized for "${item.logicalIdentity.logicalKey}".`);
  return parent;
}

function counts(created: Map<string, number>, reused: Map<string, number>, provenance: number): MaterializationWriteCounts {
  return {
    goals: created.get("goal") ?? 0,
    objectives: created.get("objective") ?? 0,
    activities: created.get("activity") ?? 0,
    workItems: created.get("action") ?? 0,
    provenance,
    goalsReused: reused.get("goal") ?? 0,
    objectivesReused: reused.get("objective") ?? 0,
    activitiesReused: reused.get("activity") ?? 0,
    workItemsReused: reused.get("action") ?? 0
  };
}

export class SQLiteCanonicalMaterializationWriter {
  constructor(private readonly database: Database.Database, private readonly options: MaterializationWriterOptions = {}) {}

  execute(command: MaterializeCanonicalPlanCommand): MaterializeCanonicalPlanResult {
    this.options.authorize?.(command.actorUserId);
    if (!command.actorUserId.trim()) throw new Error("An actor user ID is required.");
    assertCommand(command);
    const existingRow = this.database.prepare(`SELECT * FROM materialization_operations
      WHERE import_job_id=? AND approved_analysis_revision=? AND source_snapshot_hash=?`)
      .get(command.importJobId, command.approvedAnalysisRevision, command.sourceSnapshotHash) as Row | undefined;
    if (existingRow && String(existingRow.operation_id) !== command.operationId) {
      const existing = operation(existingRow);
      if (existing.targetPlanYear !== command.targetPlanYear) throw new Error("Materialization operation target year mismatch.");
      if (existing.status === "COMPLETED") return {
        status: "NO_OP", operation: existing,
        counts: { ...existing.counts, goalsReused: 0, objectivesReused: 0, activitiesReused: 0, workItemsReused: 0 }
      };
      throw new Error(`Materialization snapshot is already owned by operation "${existing.operationId}".`);
    }
    const current = readOperation(this.database, command.operationId);
    if (current.importJobId !== command.importJobId ||
        current.approvedAnalysisRevision !== command.approvedAnalysisRevision ||
        current.sourceSnapshotHash !== command.sourceSnapshotHash ||
        current.targetPlanYear !== command.targetPlanYear) throw new Error("Materialization operation identity mismatch.");
    if (current.status === "COMPLETED") return {
      status: "NO_OP", operation: current,
      counts: { ...current.counts, goalsReused: 0, objectivesReused: 0, activitiesReused: 0, workItemsReused: 0 }
    };
    if (current.status !== "READY") throw new Error(`Materialization requires READY operation, got ${current.status}.`);

    const now = this.options.now ?? (() => new Date().toISOString());
    try {
      const result = this.database.transaction(() => {
        const executing = readOperation(this.database, command.operationId);
        assertLegalMaterializationTransition(executing.status, "EXECUTING");
        const snapshotPayload = serializeApprovedMaterializationSnapshot(command.plan);
        const snapshotHash = approvedMaterializationSnapshotHash(command.plan);
        this.database.prepare(`INSERT INTO materialization_snapshots
          (operation_id, snapshot_version, import_job_id, approved_analysis_revision, source_snapshot_hash, plan_hash, payload_json, created_at)
          VALUES (?, 2, ?, ?, ?, ?, ?, ?)`)
          .run(command.operationId, command.importJobId, command.approvedAnalysisRevision,
            command.sourceSnapshotHash, snapshotHash, snapshotPayload, now());
        this.database.prepare("UPDATE materialization_operations SET status='EXECUTING', started_at=?, updated_at=? WHERE operation_id=?")
          .run(now(), now(), command.operationId);
        const ids = new Map<string, string>();
        const created = new Map<string, number>();
        const reusedCounts = new Map<string, number>();
        const canonicalByKey = new Map<string, string>();
        const ordered = [...command.plan.items].sort((a, b) =>
          typeOrder.indexOf(a.entityType) - typeOrder.indexOf(b.entityType) ||
          a.ordering.ordinal - b.ordering.ordinal ||
          a.logicalIdentity.logicalKey.localeCompare(b.logicalIdentity.logicalKey));
        let provenanceCount = 0;
        for (const item of ordered) {
          const identityKey = item.logicalIdentity.logicalKey;
          const existing = item.canonicalReference?.canonicalId;
          const reused = item.conflictState === "REUSE" && Boolean(existing);
          const id = reused ? existing! : canonicalId(item, ids);
          ids.set(identityKey, id);
          if (canonicalByKey.has(identityKey) && canonicalByKey.get(identityKey) !== id) throw new Error(`Canonical identity collision for "${identityKey}".`);
          canonicalByKey.set(identityKey, id);
          if (item.entityType === "goal") {
            failIf(this.options.failurePoint, "goal");
            const conflict = this.database.prepare("SELECT id FROM strategic_goals WHERE plan_year=? AND title=? AND id<>?")
              .get(command.targetPlanYear, item.logicalIdentity.title, id);
            if (conflict && !reused) throw new Error(`Canonical goal conflict for "${identityKey}".`);
            const ownerId = item.responsibility.find((value) =>
              value.field === "owner" && value.targetType === "PERSON" && value.resolved
            )?.targetId ?? null;
            if (!reused) this.database.prepare("INSERT INTO strategic_goals (id,title,owner_person_id,plan_year) VALUES (?,?,?,?)")
              .run(id, item.logicalIdentity.title, ownerId, command.targetPlanYear);
          } else if (item.entityType === "departmental_goal") {
            failIf(this.options.failurePoint, "goal");
            const strategicGoalId = resolveParent(item, ids);
            const departmentId = item.responsibility.find((value) => value.field === "department" && value.targetType === "UNIT" && value.resolved)?.targetId ?? null;
            const conflict = this.database.prepare("SELECT id FROM departmental_goals WHERE strategic_goal_id=? AND IFNULL(department_id,'')=IFNULL(?, '') AND title=? AND plan_year=? AND id<>?")
              .get(strategicGoalId, departmentId, item.logicalIdentity.title, command.targetPlanYear, id);
            if (conflict && !reused) throw new Error(`Canonical departmental goal conflict for "${identityKey}".`);
            if (!reused) this.database.prepare("INSERT INTO departmental_goals (id,strategic_goal_id,department_id,title,owner_person_id,plan_year) VALUES (?,?,?,?,?,?)")
              .run(id, strategicGoalId, departmentId, item.logicalIdentity.title,
                item.responsibility.find((value) => value.field === "owner" && value.targetType === "PERSON" && value.resolved)?.targetId ?? null,
                command.targetPlanYear);
          } else if (item.entityType === "objective") {
            failIf(this.options.failurePoint, "objective");
            const parentId = resolveParent(item, ids);
            const departmentalGoalId = item.parent?.entityType === "departmental_goal" ? parentId : null;
            const goalId = departmentalGoalId
              ? String((this.database.prepare("SELECT strategic_goal_id FROM departmental_goals WHERE id=?").get(departmentalGoalId) as Row | undefined)?.strategic_goal_id ?? "")
              : parentId;
            if (!this.database.prepare("SELECT 1 FROM strategic_goals WHERE id=?").get(goalId)) throw new Error(`Objective parent goal is missing: ${goalId} for ${identityKey}`);
            const conflict = this.database.prepare("SELECT id FROM sub_goals WHERE goal_id=? AND title=? AND id<>?")
              .get(goalId, item.logicalIdentity.title, id);
            if (conflict && !reused) throw new Error(`Canonical objective conflict for "${identityKey}".`);
            if (!reused) this.database.prepare("INSERT INTO sub_goals (id,goal_id,title,owner_person_id,departmental_goal_id) VALUES (?,?,?,?,?)")
              .run(id, goalId, item.logicalIdentity.title, item.responsibility.find((v) => v.field === "owner" && v.targetType === "PERSON")?.targetId ?? null, departmentalGoalId);
          } else if (item.entityType === "activity") {
            failIf(this.options.failurePoint, "activity");
            const objectiveId = resolveParent(item, ids);
            const conflict = this.database.prepare("SELECT id FROM activities WHERE sub_goal_id=? AND title=? AND id<>?")
              .get(objectiveId, item.logicalIdentity.title, id);
            if (conflict && !reused) throw new Error(`Canonical activity conflict for "${identityKey}".`);
            if (!reused) this.database.prepare("INSERT INTO activities (id,sub_goal_id,title,description,owner_person_id) VALUES (?,?,?,?,?)")
              .run(id, objectiveId, item.logicalIdentity.title, item.normalizedValues.description ?? null, item.responsibility.find((v) => v.field === "owner" && v.targetType === "PERSON")?.targetId ?? null);
          } else {
            failIf(this.options.failurePoint, "work-item");
            const activityId = resolveParent(item, ids);
            const goalRow = this.database.prepare(`SELECT sg.goal_id
              FROM activities a JOIN sub_goals sg ON sg.id = a.sub_goal_id WHERE a.id=?`).get(activityId) as Row | undefined;
            const goal = String(goalRow?.goal_id ?? "");
            const publicId = item.canonicalAllocation.publicIdInput!;
            const departmentId = item.responsibility.find((value) => ["department", "unit", "responsible"].includes(value.field) && value.targetType === "UNIT" && value.resolved)?.targetId ?? null;
            const ownerId = item.responsibility.find((value) => value.field === "owner" && value.targetType === "PERSON" && value.resolved)?.targetId ?? null;
            if (!reused) {
                const values = item.normalizedValues;
              const subGoal = this.database.prepare("SELECT sub_goal_id FROM activities WHERE id=?").get(activityId) as { sub_goal_id?: string } | undefined;
              if (!this.database.prepare("SELECT 1 FROM strategic_goals WHERE id=?").get(goal)) throw new Error(`Action goal is missing: ${goal} for ${identityKey}`);
              if (subGoal?.sub_goal_id && !this.database.prepare("SELECT 1 FROM sub_goals WHERE id=?").get(subGoal.sub_goal_id)) throw new Error(`Action objective is missing: ${subGoal.sub_goal_id} for ${identityKey}`);
              const conflict = this.database.prepare("SELECT id FROM work_items WHERE public_id=? AND id<>?")
                .get(publicId, id);
              if (conflict) throw new Error(`Canonical work-item conflict for "${identityKey}".`);
              this.database.prepare(`INSERT INTO work_items
                (id,public_id,goal_id,sub_goal_id,activity_id,department_id,owner_person_id,title,work_type,deliverable,status,progress,planned_start,planned_end,description,plan_year)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
                id, publicId, goal, subGoal?.sub_goal_id ?? null, activityId, departmentId, ownerId,
                item.logicalIdentity.title, values.workType ?? "اقدام", values.deliverable ?? null, canonicalStatus(values.status), Number(values.progress ?? 0),
                values.startDate && /^\d{4}\/\d{2}\/\d{2}$/u.test(String(values.startDate)) ? values.startDate : null,
                values.endDate && /^\d{4}\/\d{2}\/\d{2}$/u.test(String(values.endDate)) ? values.endDate : null, values.description ?? null, command.targetPlanYear);
              const assignments = Array.isArray(values.assignments) ? values.assignments : [];
              for (const assignment of assignments) {
                const candidate = assignment as Row;
                if (candidate.entityType === "PERSON" && candidate.entityId) {
                  const exists = this.database.prepare("SELECT id FROM people WHERE id=?").get(candidate.entityId);
                  if (exists) this.database.prepare("INSERT OR IGNORE INTO work_item_collaborators(work_item_id,person_id) VALUES (?,?)").run(id, candidate.entityId);
                }
                this.database.prepare(`INSERT INTO work_item_assignments
                  (id, work_item_id, raci_type, target_type, target_id, display_name, normalized_name, resolved, source_json)
                  VALUES (?,?,?,?,?,?,?,?,?)`).run(
                  `${id}:raci:${(this.database.prepare("SELECT COUNT(*) AS count FROM work_item_assignments WHERE work_item_id=?").get(id) as { count: number }).count + 1}`,
                  id, String(candidate.raciType ?? "I"), String(candidate.targetType ?? "UNRESOLVED"), candidate.entityId || null,
                  String(candidate.displayName ?? ""), String(candidate.normalizedName ?? candidate.displayName ?? ""), candidate.resolved ? 1 : 0, JSON.stringify(candidate));
              }
            }
          }
          if (!reused) created.set(item.entityType, (created.get(item.entityType) ?? 0) + 1);
          else reusedCounts.set(item.entityType, (reusedCounts.get(item.entityType) ?? 0) + 1);
          for (const provenance of item.provenanceReferences) {
            failIf(this.options.failurePoint, "provenance");
            const sourceRecord = item.sourceRecords.find((source) => source.recordId === provenance.sourceRecordId);
            if (!sourceRecord) throw new Error(`Missing source record for provenance.`);
            const evidence = sourceRecord.provenance;
            const provenanceId = `provenance-${command.operationId}-${provenance.sourceRecordId}-${item.entityType}`;
            this.database.prepare(`INSERT INTO canonical_provenance
              (provenance_id,canonical_entity_type,canonical_entity_id,import_job_id,source_record_id,source_workbook,source_sheet,source_row,source_cell,semantic_type,provenance_json,first_created_operation_id,relation_type)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
              provenanceId, item.entityType, id, command.importJobId, sourceRecord.recordId,
              sourceRecord.provenance[0]?.workbookName ?? "unknown", sourceRecord.provenance[0]?.sheetName ?? null,
              sourceRecord.rowNumber ?? null, sourceRecord.provenance[0]?.address ?? null,
              sourceRecord.provenance[0]?.semanticType ?? null, JSON.stringify(evidence), command.operationId, provenance.relation);
            provenanceCount += 1;
          }
          for (const source of item.sourceRecords) {
            failIf(this.options.failurePoint, "mapping");
            this.database.prepare(`INSERT INTO materialization_entity_map
              (operation_id,import_job_id,source_record_id,canonical_entity_type,canonical_entity_id,logical_identity_key,mapping_status)
              VALUES (?,?,?,?,?,?,?)`).run(command.operationId, command.importJobId, source.recordId, item.entityType, id, identityKey, reused ? "REUSED" : "CREATED");
          }
        }
        const actual = counts(created, reusedCounts, provenanceCount);
        failIf(this.options.failurePoint, "final-operation");
        this.database.prepare(`UPDATE materialization_operations SET status='COMPLETED',completed_at=?,updated_at=?,
          goal_count=?,objective_count=?,activity_count=?,work_item_count=?,provenance_count=?,
          goal_reused_count=?,objective_reused_count=?,activity_reused_count=?,work_item_reused_count=? WHERE operation_id=?`).run(
          now(), now(), actual.goals, actual.objectives, actual.activities, actual.workItems, actual.provenance,
          actual.goalsReused, actual.objectivesReused, actual.activitiesReused, actual.workItemsReused, command.operationId);
        this.database.prepare(`INSERT INTO audit_log(id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json)
          VALUES (?,?,?,?,?,?,?)`).run(randomUUID(), command.actorUserId, "materialization", command.operationId, "materialization_completed", null, JSON.stringify(actual));
        return { status: "COMPLETED" as const, operation: readOperation(this.database, command.operationId), counts: actual };
      })();
      return result;
    } catch (error) {
      const failed = readOperation(this.database, command.operationId);
      if (failed.status === "EXECUTING" || failed.status === "READY") {
        const reason = error instanceof Error ? error.message : String(error);
        this.database.transaction(() => {
          this.database.prepare("UPDATE materialization_operations SET status='FAILED',completed_at=?,failure_reason=?,updated_at=? WHERE operation_id=?")
            .run(now(), reason, now(), command.operationId);
          this.database.prepare(`INSERT INTO audit_log
            (id,actor_user_id,entity_type,entity_id,event_type,before_json,after_json)
            VALUES (?,?,?,?,?,?,?)`).run(randomUUID(), command.actorUserId, "materialization", command.operationId, "materialization_failed", null, JSON.stringify({ reason }));
        })();
      }
      throw error;
    }
  }
}
