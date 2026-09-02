import type { ImportEntityType, ImportRecord } from "../import/contracts";

export type MaterializableEntityType = Extract<ImportEntityType, "goal" | "departmental_goal" | "objective" | "activity" | "action">;

export type MaterializationIdentity = {
  importJobId: string;
  approvedAnalysisRevision: number;
  sourceSnapshotHash: string;
  actorId: string;
  targetPlanYear: number;
};

export type ImportSnapshotReference = {
  importJobId: string;
  approvedAnalysisRevision: number;
  sourceSnapshotHash: string;
  targetPlanYear: number;
  sourceRecordCount: number;
};

export type LogicalEntityIdentity = {
  entityType: MaterializableEntityType;
  planYear: number;
  title: string;
  key: string;
  parentKey?: string;
};

export type MaterializationRequest = MaterializationIdentity;

export type MaterializationResult = {
  operationId: string;
  status: "COMPLETED" | "NO_OP" | "REJECTED" | "FAILED";
  source: ImportSnapshotReference;
  counts: {
    goals: number;
    objectives: number;
    activities: number;
    workItems: number;
  };
  conflicts: MaterializationConflict[];
};

export type MaterializationConflict = {
  code:
    | "NOT_APPROVED"
    | "REVISION_MISMATCH"
    | "SNAPSHOT_MISMATCH"
    | "IDENTITY_COLLISION"
    | "CANONICAL_CONFLICT"
    | "MISSING_PARENT"
    | "INVALID_SOURCE";
  entityType?: MaterializableEntityType;
  identityKey?: string;
  recordIds?: string[];
  message: string;
};

export type ProvenanceRelation = {
  relation: "CREATED_FROM" | "CONTRIBUTED_TO" | "REUSED_FROM";
  importJobId: string;
  sourceRecordId: string;
  canonicalEntityType: MaterializableEntityType;
  canonicalEntityId: string;
  source?: ImportRecord["provenance"];
};
