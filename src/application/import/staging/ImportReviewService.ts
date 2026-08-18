import type { Program } from "../../../domain/program";
import { ImportReadinessService, type ImportReadinessOptions, type ProgramReadinessEvaluation } from "../ImportReadinessService";
import type { ImportRecord, ImportSource } from "../contracts";
import type { ImportJob, ImportJobStatus } from "./ImportJob";

export type ImportApprovalResult = {
  ready: boolean;
  blockers: string[];
};

export class ImportReviewService {
  private readonly jobs = new Map<string, ImportJob>();

  constructor(
    private readonly readiness: ImportReadinessService = new ImportReadinessService()
  ) {}

  createJob(source: ImportSource, id = `import-${Date.now()}`): ImportJob {
    if (this.jobs.has(id)) throw new Error(`Import job "${id}" already exists.`);
    const job: ImportJob = {
      id,
      source,
      status: "DRAFT",
      records: [],
      createdAt: new Date().toISOString()
    };
    this.jobs.set(id, job);
    return job;
  }

  getJob(id: string): ImportJob {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Import job "${id}" was not found.`);
    return job;
  }

  attachRecords(id: string, records: ImportRecord[]): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "DRAFT");
    job.records = [...records];
    return job;
  }

  analyze(id: string, program: Program, options: ImportReadinessOptions = {}): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "DRAFT", "REVIEW_REQUIRED");
    job.status = "ANALYZING";
    job.validationResult = this.readiness.validate(job.records, options);
    const evaluation = this.readiness.evaluateProgram(program, options);
    this.storeEvaluation(job, evaluation);
    job.status = "REVIEW_REQUIRED";
    return job;
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
    job.status = "APPROVED";
    job.approvedAt = new Date().toISOString();
    return job;
  }

  reject(id: string): ImportJob {
    const job = this.getJob(id);
    this.requireStatus(job, "REVIEW_REQUIRED", "ANALYZING");
    job.status = "REJECTED";
    return job;
  }

  private storeEvaluation(job: ImportJob, evaluation: ProgramReadinessEvaluation) {
    job.assessmentResult = {
      governance: evaluation.governance,
      findings: evaluation.assessment
    };
    job.qualityScore = evaluation.qualityScore;
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
