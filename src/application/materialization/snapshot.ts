import { createHash } from "node:crypto";
import type { ImportJob } from "../import/staging/ImportJob";
import type { ImportRecord } from "../import/contracts";
import type { ImportSnapshotReference, MaterializationConflict, MaterializationRequest } from "./contracts";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stable).sort().join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`);
  return `{${entries.join(",")}}`;
}

export function sourceSnapshotHash(source: ImportJob["source"], records: ImportRecord[]): string {
  const orderedRecords = [...records].sort((left, right) => left.id.localeCompare(right.id));
  return createHash("sha256").update(stable({ source, records: orderedRecords })).digest("hex");
}

/**
 * Stable identity for a logical workbook across separate import jobs. Volatile
 * upload metadata (timestamps, job IDs, etc.) is intentionally excluded.
 */
export function sourceWorkbookFingerprint(source: ImportJob["source"], records: ImportRecord[]): string {
  const stableSource = { type: source.type, name: source.name.trim() };
  const stableRecords = records.map((record) => ({
    id: record.id,
    entityType: record.entityType,
    data: record.data,
    rowNumber: record.rowNumber,
    provenance: record.provenance
  }));
  return createHash("sha256").update(stable({ source: stableSource, records: stableRecords })).digest("hex");
}

export function createImportSnapshotReference(job: ImportJob, targetPlanYear: number): ImportSnapshotReference {
  if (job.status !== "APPROVED") {
    throw new Error("Only an approved import can produce a materialization snapshot.");
  }
  const approvedAnalysisRevision = job.analysisRevision;
  if (typeof approvedAnalysisRevision !== "number" || !Number.isInteger(approvedAnalysisRevision) || approvedAnalysisRevision < 1) {
    throw new Error("An approved import must have a pinned analysis revision.");
  }
  return {
    importJobId: job.id,
    approvedAnalysisRevision,
    sourceSnapshotHash: sourceSnapshotHash(job.source, job.records),
    targetPlanYear,
    sourceRecordCount: job.records.length
  };
}

export function verifyMaterializationRequest(
  job: ImportJob,
  request: Pick<MaterializationRequest, "importJobId" | "approvedAnalysisRevision" | "sourceSnapshotHash" | "targetPlanYear">,
  expected: ImportSnapshotReference
): MaterializationConflict[] {
  const conflicts: MaterializationConflict[] = [];
  if (job.status !== "APPROVED") conflicts.push({ code: "NOT_APPROVED", message: "The import must be approved before materialization." });
  if (job.id !== request.importJobId || job.id !== expected.importJobId) conflicts.push({ code: "INVALID_SOURCE", message: "The materialization import identity does not match the snapshot." });
  if (job.analysisRevision !== request.approvedAnalysisRevision || expected.approvedAnalysisRevision !== request.approvedAnalysisRevision) {
    conflicts.push({ code: "REVISION_MISMATCH", message: "The approved analysis revision is stale or does not match the request." });
  }
  const actualHash = sourceSnapshotHash(job.source, job.records);
  if (actualHash !== request.sourceSnapshotHash || actualHash !== expected.sourceSnapshotHash) {
    conflicts.push({ code: "SNAPSHOT_MISMATCH", message: "The import source records no longer match the approved snapshot." });
  }
  if (request.targetPlanYear !== expected.targetPlanYear) conflicts.push({ code: "INVALID_SOURCE", message: "The target plan year does not match the snapshot." });
  return conflicts;
}

export function stableSnapshotPayload(source: ImportJob["source"], records: ImportRecord[]): string {
  return stable({ source, records: [...records].sort((left, right) => left.id.localeCompare(right.id)) });
}
