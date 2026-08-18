import type { ImportRecord } from "../../contracts";
import type { CellContract, RowContract, SheetContract, WorkbookContract } from "../contracts";
import { HIERARCHY_SEMANTIC_TYPES, SEMANTIC_DATA_KEYS, type ColumnSemanticType } from "../mapping";
import { HeaderSemanticResolver, type ResolvedSemanticColumn } from "../mapping";
import {
  EVALUATION_FAILURE_CATEGORIES,
  type CellProvenance,
  type EvaluationIssue,
  type EvaluationFailureCategory,
  type RowEvaluation,
  type SemanticCheck,
  type SheetEvaluation,
  type SpreadsheetEvaluationReport
} from "./contracts";

const ASSIGNMENT_TYPES: ColumnSemanticType[] = ["OWNER", "EXECUTOR", "COLLABORATOR", "UNIT", "PERSON"];

export class SpreadsheetEvaluationEngine {
  constructor(private readonly resolver = new HeaderSemanticResolver()) {}

  evaluate(workbook: WorkbookContract, records: ImportRecord[]): SpreadsheetEvaluationReport {
    const sheets = workbook.sheets.map((sheet, sheetIndex) =>
      this.evaluateSheet(workbook, sheet, sheetIndex, records)
    );
    const allChecks = sheets.flatMap((sheet) => sheet.checks);
    const rowIssues = sheets.flatMap((sheet) => sheet.rows.flatMap((row) => row.issues));
    const checkIssues = sheets.flatMap((sheet) =>
      sheet.checks.filter((check) => check.name === "header-detection").flatMap((check) => check.issues)
    );
    const issueCounts = Object.fromEntries(
      EVALUATION_FAILURE_CATEGORIES.map((category) => [
        category,
        rowIssues.concat(checkIssues)
          .filter((issue) => issue.category === category).length
      ])
    ) as Record<EvaluationFailureCategory, number>;
    const passedChecks = allChecks.filter((check) => check.status === "PASS").length;
    const failedChecks = allChecks.length - passedChecks;
    const totalChecks = passedChecks + failedChecks;
    const scorePercent = totalChecks === 0 ? 0 : Math.round((passedChecks / totalChecks) * 100);

    return {
      workbook: { workbookName: workbook.name, sourceType: "EXCEL", sheetCount: workbook.sheets.length },
      sheets,
      summary: {
        totalSheets: workbook.sheets.length,
        totalRows: sheets.reduce((count, sheet) => count + sheet.rows.length, 0),
        mappedRecords: records.length,
        passedChecks,
        failedChecks,
        unknownHeaders: sheets.reduce((count, sheet) => count + sheet.unknownHeaders.length, 0),
        ambiguousHeaders: sheets.reduce((count, sheet) => count + sheet.ambiguousHeaders.length, 0),
        issueCounts,
        scorePercent,
        status: failedChecks === 0 ? "PASS" : "FAIL"
      }
    };
  }

  evaluateMapping(workbook: WorkbookContract, records: ImportRecord[]): SpreadsheetEvaluationReport {
    return this.evaluate(workbook, records);
  }

  format(report: SpreadsheetEvaluationReport): string {
    const { workbook, summary } = report;
    const lines = [
      `Workbook: ${workbook.workbookName}`,
      "",
      ...report.sheets.flatMap((sheet) => [
        `Sheet: ${sheet.provenance.sheetName}`,
        ...sheet.checks.map((check) => `${this.title(check.name)}: ${check.status}`),
        `Unknown: ${sheet.unknownHeaders.length}`,
        `Ambiguous: ${sheet.ambiguousHeaders.length}`,
        ""
      ]),
      `Score: ${summary.scorePercent}%`
    ];
    return lines.join("\n");
  }

  private evaluateSheet(
    workbook: WorkbookContract,
    sheet: SheetContract,
    sheetIndex: number,
    records: ImportRecord[]
  ): SheetEvaluation {
    const headerRowIndex = sheet.metadata.headerRowIndex ?? 0;
    const headerRow = this.findRow(sheet, headerRowIndex);
    const provenance = { workbookName: workbook.name, sheetName: sheet.name, sheetIndex, headerRowIndex };
    const semanticColumns = headerRow ? this.resolver.resolveRow(headerRow) : [];
    const unknownHeaders = headerRow
      ? headerRow.cells
        .filter((cell) => !this.isEmpty(cell.rawValue) && !this.resolver.resolve(cell.rawValue))
        .map((cell) => String(cell.rawValue))
      : [];
    const ambiguousHeaders = this.duplicateSemanticHeaders(semanticColumns);
    const headerIssues: EvaluationIssue[] = [];
    if (!headerRow) {
      headerIssues.push({ category: "UNSUPPORTED_STRUCTURE", message: "Header row was not found.", provenance });
    }
    unknownHeaders.forEach((header) => headerIssues.push({
      category: "UNKNOWN_HEADER", message: `Unknown header "${header}".`, provenance
    }));
    ambiguousHeaders.forEach((header) => headerIssues.push({
      category: "AMBIGUOUS_HEADER", message: `Header "${header}" maps to multiple columns.`, provenance
    }));

    const sheetRecords = records.filter((record) =>
      record.source.metadata.sheetName === sheet.name &&
      record.source.metadata.sheetIndex === sheetIndex
    );
    const rows = sheet.rows
      .filter((row) => row.index > headerRowIndex && row.rowType !== "empty")
      .map((row) => this.evaluateRow(workbook, sheet, row, semanticColumns, sheetRecords));
    const checks: SemanticCheck[] = [
      { name: "header-detection", status: headerIssues.length === 0 ? "PASS" : "FAIL", issues: headerIssues },
      this.checkRows("semantic-values", rows, (issue) => issue.category === "MISSING_VALUE"),
      this.checkRows("hierarchy", rows, (issue) =>
        issue.category === "INVALID_HIERARCHY" || issue.category === "INHERITANCE_FAILURE"
      ),
      this.checkRows("assignments", rows, (issue) => issue.category === "UNRESOLVED_ASSIGNMENT"),
      this.checkRows("source-trace", rows, (issue) => issue.category === "SOURCE_TRACE_FAILURE")
    ];
    return { provenance, checks, rows, unknownHeaders, ambiguousHeaders };
  }

  private evaluateRow(
    workbook: WorkbookContract,
    sheet: SheetContract,
    row: RowContract,
    semanticColumns: ResolvedSemanticColumn[],
    records: ImportRecord[]
  ): RowEvaluation {
    const record = records.find((candidate) => candidate.rowNumber === row.index);
    const rowProvenance = {
      workbookName: workbook.name, sheetName: sheet.name,
      sheetIndex: Number(sheet.metadata.sheetIndex ?? 0), headerRowIndex: sheet.metadata.headerRowIndex ?? 0,
      rowIndex: row.index, sourceRowNumber: row.index + 1
    };
    const cells = row.cells.map((cell) => this.cellProvenance(row, cell, semanticColumns, rowProvenance));
    const issues: EvaluationIssue[] = [];
    if (!record) {
      if (row.cells.some((cell) => semanticColumns.some((column) => column.column === cell.column) && !this.isEmpty(cell.rawValue))) {
        issues.push({ category: "SOURCE_TRACE_FAILURE", message: "Semantic row did not produce an import record.", provenance: rowProvenance });
      }
    } else {
      this.checkHierarchy(record, rowProvenance, issues);
      this.checkAssignments(record, rowProvenance, issues);
      this.checkRecordTrace(record, rowProvenance, issues);
    }
    return { provenance: rowProvenance, recordId: record?.id, entityType: record?.entityType, status: issues.length === 0 ? "PASS" : "FAIL", cells, issues };
  }

  private checkHierarchy(record: ImportRecord, provenance: RowEvaluation["provenance"], issues: EvaluationIssue[]): void {
    const entityKey = record.entityType === "assignment" ? undefined : record.entityType;
    if (!entityKey) return;
    if (this.isEmpty(record.data[entityKey])) {
      issues.push({ category: "INVALID_HIERARCHY", message: `Mapped ${entityKey} record has no value.`, provenance, recordId: record.id });
    }
    const level = HIERARCHY_SEMANTIC_TYPES.findIndex((type) => SEMANTIC_DATA_KEYS[type] === entityKey);
    if (level < 0) return;
    HIERARCHY_SEMANTIC_TYPES.slice(0, level).forEach((type) => {
      if (this.isEmpty(record.data[SEMANTIC_DATA_KEYS[type]])) {
        issues.push({ category: "INHERITANCE_FAILURE", message: `Missing inherited ${SEMANTIC_DATA_KEYS[type]}.`, provenance, recordId: record.id });
      }
    });
  }

  private checkAssignments(record: ImportRecord, provenance: RowEvaluation["provenance"], issues: EvaluationIssue[]): void {
    ASSIGNMENT_TYPES.forEach((type) => {
      const key = SEMANTIC_DATA_KEYS[type];
      if (Object.prototype.hasOwnProperty.call(record.data, key) && this.isEmpty(record.data[key])) {
        issues.push({ category: "UNRESOLVED_ASSIGNMENT", message: `Assignment "${key}" is empty.`, provenance, recordId: record.id });
      }
    });
  }

  private checkRecordTrace(record: ImportRecord, provenance: RowEvaluation["provenance"], issues: EvaluationIssue[]): void {
    if (record.source.name !== provenance.workbookName || record.source.metadata.sheetName !== provenance.sheetName || record.rowNumber !== provenance.rowIndex) {
      issues.push({ category: "SOURCE_TRACE_FAILURE", message: "Record provenance does not match the source row.", provenance, recordId: record.id });
    }
  }

  private cellProvenance(
    row: RowContract,
    cell: CellContract,
    semanticColumns: ResolvedSemanticColumn[],
    provenance: RowEvaluation["provenance"]
  ): CellProvenance {
    const semantic = semanticColumns.find((column) => column.column === cell.column);
    return {
      ...provenance, column: cell.column, address: `${cell.column}${row.index + 1}`,
      header: semantic?.header, semanticType: semantic?.semanticType, rawValue: cell.rawValue
    };
  }

  private checkRows(name: SemanticCheck["name"], rows: RowEvaluation[], matches: (issue: EvaluationIssue) => boolean): SemanticCheck {
    const issues = rows.flatMap((row) => row.issues.filter(matches));
    return { name, status: issues.length === 0 ? "PASS" : "FAIL", issues };
  }

  private duplicateSemanticHeaders(columns: ResolvedSemanticColumn[]): string[] {
    const seen = new Map<ColumnSemanticType, string>();
    return columns.flatMap((column) => {
      const previous = seen.get(column.semanticType);
      seen.set(column.semanticType, column.header);
      return previous ? [column.header] : [];
    });
  }

  private findRow(sheet: SheetContract, index: number): RowContract | undefined {
    return sheet.rows.find((row) => row.index === index) ?? sheet.rows[index];
  }

  private isEmpty(value: unknown): boolean {
    return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
  }

  private title(value: string): string {
    return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  }
}
