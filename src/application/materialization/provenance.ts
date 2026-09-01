import type { ImportRecord } from "../import/contracts";
import type { MaterializableEntityType, ProvenanceRelation } from "./contracts";

export function provenanceRelation(input: {
  relation: ProvenanceRelation["relation"];
  importJobId: string;
  sourceRecord: ImportRecord;
  canonicalEntityType: MaterializableEntityType;
  canonicalEntityId: string;
}): ProvenanceRelation {
  if (!input.importJobId.trim()) throw new Error("An import job ID is required for provenance.");
  if (!input.sourceRecord.id.trim()) throw new Error("A source record ID is required for provenance.");
  if (!input.canonicalEntityId.trim()) throw new Error("A canonical entity ID is required for provenance.");
  return {
    relation: input.relation,
    importJobId: input.importJobId,
    sourceRecordId: input.sourceRecord.id,
    canonicalEntityType: input.canonicalEntityType,
    canonicalEntityId: input.canonicalEntityId,
    source: input.sourceRecord.provenance
  };
}
