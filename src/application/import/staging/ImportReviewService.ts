import type { Program } from "../../../domain/program";
import { ImportReadinessService, type ImportReadinessOptions } from "../ImportReadinessService";
import type { ImportRecord, ImportSource } from "../contracts";
import { InMemoryImportJobRepository, InMemoryImportRecordRepository } from "../adapters";
import type { ImportJobRepository, ImportRecordRepository } from "../ports";
import type { ImportJob, ImportJobStatus } from "./ImportJob";

export type ImportApprovalResult = {
  ready: boolean;
  blockers: string[];
};

export class ImportReviewService {
  constructor(
    private readonly readiness: ImportReadinessService = new ImportReadinessService(),
    private readonly jobs: ImportJobRepository = new InMemoryImportJobRepository(),
    private readonly records: ImportRecordRepository = new InMemoryImportRecordRepository()
  ) {}

  createJob(source: ImportSource, id = `import-${Date.now()}`): ImportJob {
    const job: ImportJob = {
      id,
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };
    return this.jobs.create(job);
  }

  getJob(id: string): ImportJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Import job "${id}" was not found.`);
    return this.withRecords(job);
  }

  attachRecords(id: string, records: ImportRecord[]): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "DRAFT");
    this.records.attach(id, records);
    return this.getJob(id);
  }

  analyze(id: string, program: Program, options: ImportReadinessOptions = {}): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "DRAFT", "REVIEW_REQUIRED");
    this.jobs.updateStatus(id, "ANALYZING");
    const normalizedRecords = this.records.getByJobId(id);
    const validationResult = this.readiness.validate(normalizedRecords, options);
    const evaluation = this.readiness.evaluateProgram(program, options);
    this.jobs.saveAnalysisResult(id, validationResult, {
      governance: evaluation.governance,
      findings: evaluation.assessment
    }, evaluation.qualityScore);
    this.jobs.updateStatus(id, "REVIEW_REQUIRED");
    return this.getJob(id);
  }

  approvalReadiness(id: string): ImportApprovalResult {
    const job = this.getJob(id);
    const blockers: string[] = [];
    if (!job.validationResult || !job.assessmentResult || !job.qualityScore) {
      blockers.push("Import job must be analyzed before approval.");
      return { ready: false, blockers };
    }
    if (job.validationResult.errors.some((error) => error.code === "INVALID_DATE")) {
      blockers.push("Invalid dates must be corrected before approval.");
    }
    if (job.assessmentResult.governance.errors.some((violation) => this.isCriticalGovernanceViolation(violation.rule))) {
      blockers.push("Critical governance violations must be resolved before approval.");
    }
    if (job.qualityScore.dimensions.hierarchy < 100 || job.qualityScore.findings.some((finding) => finding.dimension === "hierarchy" && finding.severity === "error")) {
      blockers.push("Broken hierarchy must be resolved before approval.");
    }
    if (job.assessmentResult.findings.some((finding) =>
      finding.code === "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR"
      || finding.code === "MISSING_COLLABORATION_COVERAGE" && finding.severity === "error"
    )) {
      blockers.push("Mandatory responsibility requirements must be resolved before approval.");
    }
    return { ready: blockers.length === 0, blockers };
  }

  approve(id: string): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "REVIEW_REQUIRED");
    const readiness = this.approvalReadiness(id);
    if (!readiness.ready) throw new Error(readiness.blockers.join(" "));
    return this.getJob(this.jobs.updateStatus(id, "APPROVED", new Date().toISOString()).id);
  }

  reject(id: string): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "REVIEW_REQUIRED", "ANALYZING");
    return this.getJob(this.jobs.updateStatus(id, "REJECTED").id);
  }

  private withRecords(job: ImportJob): ImportJob {
    return { ...job, records: this.records.getByJobId(job.id) };
  }

  private isCriticalGovernanceViolation(rule: string): boolean {
    return rule.startsWith("program.")
      || rule.startsWith("goal.")
      || rule.startsWith("objective.")
      || rule.startsWith("activity.")
      || rule.startsWith("action.")
      || rule.startsWith("kpi.")
      || rule.startsWith("assignment.")
      || rule.startsWith("status.");
  }

  private requireStatus(job: ImportJob, ...statuses: ImportJobStatus[]) {
    if (!statuses.includes(job.status)) {
      throw new Error(`Import job "${job.id}" must be in ${statuses.join(" or ")} status.`);
    }
  }
}
