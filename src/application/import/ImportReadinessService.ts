import {
  assessProgramResponsibilities,
  createGovernanceReport,
  ProgramGovernanceRules,
  ProgramQualityScoreEngine,
  type AssignmentValidationOptions,
  type GovernanceValidationReport,
  type ResponsibilityAssessmentFinding,
  type Program,
  type ProgramQualityScore
} from "../../domain/program";
import type { ImportRecord, ImportValidationResult } from "./contracts";
import { ImportNormalizer, type ImportNormalizationHooks } from "./normalization";
import type { ProductionOrganizationalGovernance, ProductionOrganizationalGovernanceInput } from "../organization/governance/ProductionOrganizationalGovernance";

export type ImportReadinessOptions = {
  normalizationHooks?: ImportNormalizationHooks;
  assignmentValidation?: AssignmentValidationOptions;
  today?: string;
  evaluationGeneratedAt?: string;
  organizationalGovernance?: {
    boundary: ProductionOrganizationalGovernance;
    input: ProductionOrganizationalGovernanceInput;
  };
};

export type ProgramReadinessEvaluation = {
  governance: GovernanceValidationReport;
  assessment: ResponsibilityAssessmentFinding[];
  qualityScore: ProgramQualityScore;
};

export class ImportReadinessService {
  constructor(
    private readonly normalizer = new ImportNormalizer(),
    private readonly governanceRules = new ProgramGovernanceRules(),
    private readonly qualityEngine = new ProgramQualityScoreEngine()
  ) {}

  normalize(records: ImportRecord[], options: ImportReadinessOptions = {}): ImportValidationResult {
    return this.normalizer.normalize(records, options.normalizationHooks);
  }

  validate(records: ImportRecord[], options: ImportReadinessOptions = {}): ImportValidationResult {
    return this.normalize(records, options);
  }

  evaluateProgram(program: Program, options: ImportReadinessOptions = {}): ProgramReadinessEvaluation {
    if (options.organizationalGovernance) {
      throw new Error("Governed 10D evaluation must use ImportReviewService.evaluateGoverned.");
    }
    const governance = this.validateAggregate(program, options.assignmentValidation);
    const assessment = assessProgramResponsibilities(program);
    const qualityScore = this.qualityEngine.calculate(program, governance, assessment, { today: options.today });
    return { governance, assessment, qualityScore };
  }

  private validateAggregate(program: Program, assignmentValidation?: AssignmentValidationOptions): GovernanceValidationReport {
    const violations = [
      ...this.governanceRules.validateProgram(program).violations,
      ...this.governanceRules.validateHierarchy(program).violations
    ];
    for (const goal of program.goals) {
      violations.push(...this.governanceRules.validateGoal(goal).violations);
      for (const objective of goal.objectives) {
        violations.push(...this.governanceRules.validateObjective(objective).violations);
        for (const activity of objective.activities) {
          violations.push(...this.governanceRules.validateActivity(activity, assignmentValidation).violations);
          for (const action of activity.actions) {
            violations.push(...this.governanceRules.validateAction(action, assignmentValidation).violations);
            for (const kpi of action.kpis) violations.push(...this.governanceRules.validateKPI(kpi).violations);
          }
        }
      }
    }
    return createGovernanceReport(violations);
  }
}
