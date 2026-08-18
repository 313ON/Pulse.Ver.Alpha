import type { ProgramNode, ProgramNodeType } from "../../domain/program";
import type { ExternalDataRecord, ImportModel, ImportRecord, ImportSource } from "./contracts";

export type ImportToModelMapper = {
  toImportModel(input: ExternalDataRecord): ImportModel;
};

export type ImportToCanonicalMapper = {
  toCanonical(input: ImportRecord): Partial<ProgramNode> & { type: ProgramNodeType };
};

export type ImportMappingContract = {
  source: ImportSource;
  external: ExternalDataRecord;
  importModel: ImportModel;
  canonical?: Partial<ProgramNode> & { type: ProgramNodeType };
};

export class DefaultImportToModelMapper implements ImportToModelMapper {
  toImportModel(input: ExternalDataRecord): ImportModel {
    return {
      id: input.externalId,
      externalId: input.externalId,
      entityType: input.entityType,
      source: input.source,
      data: input.fields,
      rowNumber: input.rowNumber
    };
  }
}

