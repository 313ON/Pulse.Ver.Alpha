import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { closeDatabase, getDatabase } from "../db";
import type { ImportRecord } from "../../application/import/contracts";
import type { ImportJob } from "../../application/import/staging/ImportJob";
import type { ImportAssessmentResult } from "../../application/import/staging/ImportJob";
import type { ImportValidationResult } from "../../application/import/contracts";
import type { ProgramQualityScore } from "../../domain/program";
import type { SpreadsheetEvaluationReport } from "../../application/import/spreadsheet/evaluation/contracts";
import { RepositoryError } from "../repositories";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "./SQLiteImportRepositories";

const source = { type: "MANUAL" as const, name: "transaction-test", metadata: {} };
const record = (id: string): ImportRecord => ({
  id,
  entityType: "action",
  source,
  data: { title: id }
});

const evaluationReport = (): SpreadsheetEvaluationReport => ({
  workbook: { workbookName: "source.xlsx", sourceType: "EXCEL", sheetCount: 0 },
  sheets: [],
  summary: {
    totalSheets: 0,
    totalRows: 0,
    mappedRecords: 0,
    passedChecks: 0,
    failedChecks: 0,
    unknownHeaders: 0,
    ambiguousHeaders: 0,
    issueCounts: {
      UNKNOWN_HEADER: 0,
      AMBIGUOUS_HEADER: 0,
      MISSING_VALUE: 0,
      INVALID_HIERARCHY: 0,
      INHERITANCE_FAILURE: 0,
      UNRESOLVED_ASSIGNMENT: 0,
      UNSUPPORTED_STRUCTURE: 0,
      SOURCE_TRACE_FAILURE: 0
    },
    scorePercent: 100,
    status: "PASS"
  }
});

let databasePath = "";

beforeEach(() => {
  closeDatabase();
  databasePath = path.join(os.tmpdir(), `pulse-import-${Date.now()}-${Math.random()}.sqlite`);
  process.env.PULSE_DB_PATH = databasePath;
});

afterEach(() => {
  closeDatabase();
});

describe("SQLite import persistence", () => {
  it("persists evaluation findings and provenance across job reload", () => {
    const jobs = new SQLiteImportJobRepository();
    const evaluation: SpreadsheetEvaluationReport = {
      workbook: { workbookName: "source.xlsx", sourceType: "EXCEL", sheetCount: 1 },
      sheets: [{
        provenance: { workbookName: "source.xlsx", sheetName: "Sheet1", sheetIndex: 0, headerRowIndex: 0 },
        unknownHeaders: [],
        ambiguousHeaders: [],
        rows: [{
          provenance: {
            workbookName: "source.xlsx",
            sheetName: "Sheet1",
            sheetIndex: 0,
            headerRowIndex: 0,
            rowIndex: 8,
            sourceRowNumber: 9
          },
          recordId: "action-9",
          entityType: "action",
          status: "FAIL",
          cells: [],
          issues: [{
            category: "INHERITANCE_FAILURE",
            message: "Missing inherited activity.",
            recordId: "action-9",
            provenance: {
              workbookName: "source.xlsx",
              sheetName: "Sheet1",
              sheetIndex: 0,
              headerRowIndex: 0,
              rowIndex: 8,
              sourceRowNumber: 9
            }
          }]
        }],
        checks: [{
          name: "hierarchy",
          status: "FAIL",
          issues: []
        }]
      }],
      summary: {
        totalSheets: 1,
        totalRows: 9,
        mappedRecords: 1,
        passedChecks: 4,
        failedChecks: 1,
        unknownHeaders: 0,
        ambiguousHeaders: 0,
        issueCounts: {
          UNKNOWN_HEADER: 0,
          AMBIGUOUS_HEADER: 0,
          MISSING_VALUE: 0,
          INVALID_HIERARCHY: 0,
          INHERITANCE_FAILURE: 1,
          UNRESOLVED_ASSIGNMENT: 0,
          UNSUPPORTED_STRUCTURE: 0,
          SOURCE_TRACE_FAILURE: 0
        },
        scorePercent: 80,
        status: "FAIL"
      }
    };
    const job: ImportJob = {
      id: "job-evaluation",
      source,
      status: "DRAFT",
      records: [],
      evaluationResult: evaluation,
      createdAt: new Date().toISOString()
    };

    jobs.create(job);
    jobs.saveAnalysisResult(
      job.id,
      {} as ImportValidationResult,
      {} as ImportAssessmentResult,
      {} as ProgramQualityScore,
      evaluation
    );

    expect(jobs.get(job.id)?.evaluationResult?.sheets[0].rows[0].issues[0]).toMatchObject({
      category: "INHERITANCE_FAILURE",
      recordId: "action-9",
      provenance: expect.objectContaining({
        sourceRowNumber: 9,
        sheetName: "Sheet1"
      })
    });
  });

  it("keeps legacy jobs without evaluation JSON readable", () => {
    const jobs = new SQLiteImportJobRepository();
    const job: ImportJob = {
      id: "job-legacy-evaluation",
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };

    jobs.create(job);

    expect(jobs.get(job.id)?.evaluationResult).toBeUndefined();
  });

  it("returns a repository error for malformed evaluation JSON", () => {
    const jobs = new SQLiteImportJobRepository();
    const job: ImportJob = {
      id: "job-malformed-evaluation",
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };

    jobs.create(job);
    getDatabase().prepare("UPDATE import_jobs SET evaluation_json = ? WHERE id = ?").run("{not-json", job.id);

    expect(() => jobs.get(job.id)).toThrow(RepositoryError);
    try {
      jobs.get(job.id);
    } catch (error) {
      expect(error).toMatchObject({
        code: "DATABASE",
        message: "Persisted import evaluation is malformed."
      });
    }
  });

  it("preserves an existing evaluation when analysis omits a replacement", () => {
    const jobs = new SQLiteImportJobRepository();
    const evaluation = evaluationReport();
    const job: ImportJob = {
      id: "job-preserve-evaluation",
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };

    jobs.create(job);
    jobs.saveAnalysisResult(
      job.id,
      {} as ImportValidationResult,
      {} as ImportAssessmentResult,
      {} as ProgramQualityScore,
      evaluation
    );
    jobs.saveAnalysisResult(
      job.id,
      {} as ImportValidationResult,
      {} as ImportAssessmentResult,
      {} as ProgramQualityScore
    );

    expect(jobs.get(job.id)?.evaluationResult).toEqual(evaluation);
  });

  it("replaces records atomically on success", () => {
    const jobs = new SQLiteImportJobRepository();
    const records = new SQLiteImportRecordRepository();
    const job: ImportJob = {
      id: "job-atomic",
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };

    jobs.create(job);
    records.attach(job.id, [record("old")]);
    records.attach(job.id, [record("new-1"), record("new-2")]);

    expect(records.getByJobId(job.id).map((item) => item.id)).toEqual(["new-1", "new-2"]);
  });

  it("rolls back deletion and partial inserts when replacement fails", () => {
    const jobs = new SQLiteImportJobRepository();
    const records = new SQLiteImportRecordRepository();
    const job: ImportJob = {
      id: "job-rollback",
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };

    jobs.create(job);
    records.attach(job.id, [record("preserved")]);

    expect(() => records.attach(job.id, [record("new"), record("new")])).toThrow();
    expect(records.getByJobId(job.id).map((item) => item.id)).toEqual(["preserved"]);
    expect(getDatabase().prepare("SELECT id FROM import_jobs WHERE id = ?").get(job.id)).toEqual({ id: job.id });
  });
});
