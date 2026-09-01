import type {
  MaterializableEntityType,
  ProvenanceRelation
} from "./contracts";

export type MaterializationStatus =
  | "REQUESTED"
  | "VALIDATING"
  | "READY"
  | "EXECUTING"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export type MaterializationCounts = {
  goals: number;
  objectives: number;
  activities: number;
  workItems: number;
  provenance: number;
  goalsReused: number;
  objectivesReused: number;
  activitiesReused: number;
  workItemsReused: number;
};

export type MaterializationOperation = {
  operationId: string;
  importJobId: string;
  approvedAnalysisRevision: number;
  sourceSnapshotHash: string;
  actorUserId: string;
  targetPlanYear: number;
  status: MaterializationStatus;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  failureReason?: string;
  counts: MaterializationCounts;
  createdAt: string;
  updatedAt: string;
};

export type MaterializationOperationInput = {
  operationId: string;
  importJobId: string;
  approvedAnalysisRevision: number;
  sourceSnapshotHash: string;
  actorUserId: string;
  targetPlanYear: number;
  requestedAt: string;
};

export type MaterializationMapping = {
  operationId: string;
  importJobId: string;
  sourceRecordId: string;
  canonicalEntityType: MaterializableEntityType;
  canonicalEntityId: string;
  logicalIdentityKey: string;
  mappingStatus: "CREATED" | "REUSED";
  createdAt?: string;
};

export type MaterializationOperationResult = {
  operation: MaterializationOperation;
};

export type MaterializationRepository = {
  createOperation(input: MaterializationOperationInput): MaterializationOperationResult;
  findByIdempotencyKey(input: Pick<MaterializationOperationInput, "importJobId" | "approvedAnalysisRevision" | "sourceSnapshotHash">): MaterializationOperation | undefined;
  getOperation(operationId: string): MaterializationOperation | undefined;
  listOperationsByImport(importJobId: string): MaterializationOperation[];
  transition(operationId: string, to: MaterializationStatus, at?: string, failureReason?: string): MaterializationOperation;
  updateTerminal(operationId: string, status: "COMPLETED" | "FAILED" | "REJECTED", counts: MaterializationCounts, failureReason?: string, at?: string): MaterializationOperation;
  recordMapping(mapping: MaterializationMapping): MaterializationMapping;
  listMappingsBySource(importJobId: string, sourceRecordId: string): MaterializationMapping[];
  listMappingsByCanonical(entityType: MaterializableEntityType, canonicalEntityId: string): MaterializationMapping[];
  recordProvenance(relation: ProvenanceRelation & { provenanceId: string; sourceWorkbook: string; sourceSheet?: string; sourceRow?: number; sourceCell?: string; semanticType?: string; operationId: string; provenanceJson: string }): void;
  listProvenanceBySource(importJobId: string, sourceRecordId: string): Array<ProvenanceRelation & { provenanceId: string }>;
  listProvenanceByCanonical(entityType: MaterializableEntityType, canonicalEntityId: string): Array<ProvenanceRelation & { provenanceId: string }>;
};

export const legalMaterializationTransitions: Readonly<Record<MaterializationStatus, readonly MaterializationStatus[]>> = {
  REQUESTED: ["VALIDATING"],
  VALIDATING: ["READY", "REJECTED"],
  READY: ["EXECUTING"],
  EXECUTING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  REJECTED: [],
  FAILED: ["REQUESTED"]
};

export function assertLegalMaterializationTransition(from: MaterializationStatus, to: MaterializationStatus): void {
  if (!legalMaterializationTransitions[from].includes(to)) {
    throw new Error(`Illegal materialization transition: ${from} -> ${to}.`);
  }
}
