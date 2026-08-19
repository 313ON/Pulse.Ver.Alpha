import type { Program, ProgramQualityScore } from "../../domain/program";
import {
  assessProgramResponsibilities,
  createGovernanceReport,
  ProgramGovernanceRules,
  ProgramQualityScoreEngine,
  type AssignmentValidationOptions,
  type GovernanceValidationReport,
  type ResponsibilityAssessmentFinding
} from "../../domain/program";
import type {
  ProductionOrganizationalGovernance,
  ProductionOrganizationalGovernanceInput
} from "../organization/governance/ProductionOrganizationalGovernance";
import type { GovernedProgramProjection } from "../organization/governance/ProgramGovernanceGate";

export type GovernedProgramEvaluationInput = {
  program: Program;
  organizationalGovernance: {
    boundary: ProductionOrganizationalGovernance;
    input: ProductionOrganizationalGovernanceInput;
  };
  assignmentValidation?: AssignmentValidationOptions;
  today?: string;
  evaluationGeneratedAt?: string;
};

export type GovernedProgramEvaluationResult = {
  organizationalGovernance: GovernedProgramProjection["governance"];
  program: GovernedProgramProjection;
  governance: GovernanceValidationReport;
  assessment: ResponsibilityAssessmentFinding[];
  qualityScore: ProgramQualityScore;
  eligibleAssignmentIds: ReadonlySet<string>;
  evaluationState: "PASS" | "WARNING" | "BLOCKED";
};

export class GovernedProgramEvaluationService {
  constructor(
    private readonly governanceRules = new ProgramGovernanceRules(),
    private readonly qualityEngine = new ProgramQualityScoreEngine()
  ) {}

  evaluate(input: GovernedProgramEvaluationInput): GovernedProgramEvaluationResult {
    const projection = input.organizationalGovernance.boundary.evaluateProgram(
      input.program,
      input.organizationalGovernance.input
    );
    const safeProjection = structuredClone(projection);
    const governedProgram = safeProjection.program;
    const governance = this.validateAggregate(governedProgram, input.assignmentValidation);
    const assessment = assessProgramResponsibilities(governedProgram);
    const qualityScore = this.qualityEngine.calculate(governedProgram, governance, assessment, {
      today: input.today,
      generatedAt: input.evaluationGeneratedAt
    });

    return {
      organizationalGovernance: safeProjection.governance,
      program: safeProjection,
      governance,
      assessment,
      qualityScore,
      eligibleAssignmentIds: safeProjection.eligibleAssignmentIds,
      evaluationState: safeProjection.governance.status
    };
  }

  private validateAggregate(
    program: Program,
    assignmentValidation?: AssignmentValidationOptions
  ): GovernanceValidationReport {
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
            for (const kpi of action.kpis) {
              violations.push(...this.governanceRules.validateKPI(kpi).violations);
            }
          }
        }
      }
    }
    return createGovernanceReport(violations);
  }
}
