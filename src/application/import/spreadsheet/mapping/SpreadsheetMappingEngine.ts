import type { ImportRecord, ImportSource } from "../../contracts";
import type { CellContract, RowContract, SheetContract, WorkbookContract } from "../contracts";
import type { CellProvenance } from "../evaluation/contracts";
import {
  HIERARCHY_SEMANTIC_TYPES,
  SEMANTIC_DATA_KEYS,
  type ColumnSemanticType
} from "./ColumnSemanticType";
import { HeaderSemanticResolver } from "./HeaderSemanticResolver";

const ENTITY_TYPE_BY_SEMANTIC_TYPE: Record<ColumnSemanticType, ImportRecord["entityType"] | undefined> = {
  GOAL: "goal",
  OBJECTIVE: "objective",
  ACTIVITY: "activity",
  ACTION: "action",
  KPI: "kpi",
  KPI_TARGET: undefined,
  KPI_VALUE: undefined,
  KPI_UNIT: undefined,
  OWNER: undefined,
  EXECUTOR: undefined,
  COLLABORATOR: undefined,
  UNIT: undefined,
  PERSON: undefined,
  START_DATE: undefined,
  END_DATE: undefined,
  DURATION: undefined,
  WORKING_DAYS: undefined,
  PERSON_HOURS: undefined,
  PROGRESS: undefined
};

export type SpreadsheetMappingEngineOptions = {
  sourceName?: string;
  resolver?: HeaderSemanticResolver;
};

type SemanticValue = {
  semanticType: ColumnSemanticType;
  value: string | number | boolean | Date;
  provenance: CellProvenance;
};

export class SpreadsheetMappingEngine {
  private readonly resolver: HeaderSemanticResolver;

  constructor(private readonly options: SpreadsheetMappingEngineOptions = {}) {
    this.resolver = options.resolver ?? new HeaderSemanticResolver();
  }

  map(workbook: WorkbookContract): ImportRecord[] {
    return workbook.sheets.flatMap((sheet, sheetIndex) =>
      this.mapSheet(workbook, sheet, sheetIndex)
    );
  }

  mapWorkbook(workbook: WorkbookContract): ImportRecord[] {
    return this.map(workbook);
  }

  private mapSheet(workbook: WorkbookContract, sheet: SheetContract, sheetIndex: number): ImportRecord[] {
    const headerRowIndex = sheet.metadata.headerRowIndex ?? 0;
    const headerRow = sheet.rows.find((row) => row.index === headerRowIndex)
      ?? sheet.rows[headerRowIndex];
    if (!headerRow) return [];

    const semanticColumns = this.resolver.resolveRow(headerRow);
    if (semanticColumns.length === 0) return [];

    const source: ImportSource = {
      type: "EXCEL",
      name: this.options.sourceName ?? workbook.name,
      metadata: { sheetName: sheet.name, sheetIndex }
    };
    const inherited = new Map<ColumnSemanticType, SemanticValue>();
    const records: ImportRecord[] = [];

    for (const row of sheet.rows) {
      if (row.index <= headerRow.index || row.rowType === "empty") continue;

      const values = this.readRowValues(workbook, sheet, row, semanticColumns, sheetIndex);
      this.updateHierarchy(values, inherited);
      const entityType = this.entityTypeFor(values, inherited);
      if (!entityType) continue;

      const data: Record<string, unknown> = {};
      const provenance = new Map<ColumnSemanticType, CellProvenance>();
      for (const semanticType of HIERARCHY_SEMANTIC_TYPES) {
        const value = inherited.get(semanticType);
        if (value) {
          data[SEMANTIC_DATA_KEYS[semanticType]] = value.value;
          provenance.set(semanticType, value.provenance);
        }
      }
      for (const value of values) {
        if (!HIERARCHY_SEMANTIC_TYPES.includes(value.semanticType)) {
          data[SEMANTIC_DATA_KEYS[value.semanticType]] = value.value;
          provenance.set(value.semanticType, value.provenance);
        }
      }

      const id = `${sheet.name}:${row.index}:${entityType}`;
      records.push({
        id,
        externalId: id,
        entityType,
        source,
        data,
        rowNumber: row.index,
        provenance: [...provenance.values()]
      });
    }

    return records;
  }

  private readRowValues(
    workbook: WorkbookContract,
    sheet: SheetContract,
    row: RowContract,
    semanticColumns: ReturnType<HeaderSemanticResolver["resolveRow"]>,
    sheetIndex: number
  ): SemanticValue[] {
    const cellsByColumn = new Map(row.cells.map((cell) => [cell.column, cell]));
    return semanticColumns.flatMap(({ column, semanticType }) => {
      const cell = cellsByColumn.get(column);
      const value = this.cellValue(cell);
      if (value === undefined || this.isEmpty(value)) return [];
      return [{
        semanticType,
        value,
        provenance: {
          workbookName: workbook.name,
          sourceType: "EXCEL",
          sheetName: sheet.name,
          sheetIndex,
          headerRowIndex: sheet.metadata.headerRowIndex ?? 0,
          rowIndex: row.index,
          sourceRowNumber: row.index + 1,
          column: cell?.column ?? column,
          address: `${cell?.column ?? column}${row.index + 1}`,
          header: semanticColumns.find((candidate) => candidate.column === column)?.header,
          semanticType,
          rawValue: cell?.rawValue
        }
      }];
    });
  }

  private updateHierarchy(
    values: SemanticValue[],
    inherited: Map<ColumnSemanticType, SemanticValue>
  ): void {
    for (const semanticType of HIERARCHY_SEMANTIC_TYPES) {
      const value = values.find((candidate) => candidate.semanticType === semanticType);
      if (!value) continue;
      inherited.set(semanticType, value);
      const semanticIndex = HIERARCHY_SEMANTIC_TYPES.indexOf(semanticType);
      for (const descendant of HIERARCHY_SEMANTIC_TYPES.slice(semanticIndex + 1)) {
        inherited.delete(descendant);
      }
    }
  }

  private entityTypeFor(
    values: SemanticValue[],
    inherited: Map<ColumnSemanticType, SemanticValue>
  ): ImportRecord["entityType"] | undefined {
    for (const semanticType of [...HIERARCHY_SEMANTIC_TYPES].reverse()) {
      if (values.some((value) => value.semanticType === semanticType)) {
        return ENTITY_TYPE_BY_SEMANTIC_TYPE[semanticType];
      }
    }
    return inherited.size > 0
      ? ENTITY_TYPE_BY_SEMANTIC_TYPE[
        [...HIERARCHY_SEMANTIC_TYPES].reverse().find((type) => inherited.has(type)) as ColumnSemanticType
      ]
      : undefined;
  }

  private cellValue(cell: CellContract | undefined): SemanticValue["value"] | undefined {
    if (!cell || this.isEmpty(cell.rawValue)) return undefined;
    return cell.rawValue as SemanticValue["value"];
  }

  private isEmpty(value: unknown): boolean {
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  }
}
