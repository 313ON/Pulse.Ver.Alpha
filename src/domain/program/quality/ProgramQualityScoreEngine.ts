import { compareProgramDates, isActionOverdue } from "../rules";
import type { GovernanceValidationReport } from "../governance/GovernanceViolation";
import type { ResponsibilityAssessmentFinding } from "../governance/ResponsibilityAssessment";
import type { Action, Activity, Goal, Objective, Program } from "../types";
import type { ProgramQualityFinding, ProgramQualityScore } from "./ProgramQualityScore";

export type ProgramQualityScoreOptions = {
  today?: string;
  generatedAt?: string;
};

const round = (value: number) => Math.round(Math.max(0, Math.min(100, value)));
const ratioScore = (complete: number, total: number) => total === 0 ? 100 : round((complete / total) * 100);
const finding = (
  dimension: ProgramQualityFinding["dimension"],
  code: string,
  severity: ProgramQualityFinding["severity"],
  message: string,
  entityId?: string
): ProgramQualityFinding => ({ dimension, code, severity, message, entityId });

export class ProgramQualityScoreEngine {
  calculate(
    program: Program,
    governance: GovernanceValidationReport,
    assessment: ResponsibilityAssessmentFinding[],
    options: ProgramQualityScoreOptions = {}
  ): ProgramQualityScore {
    const findings = [
      ...governance.violations.map((violation) => finding(
        "governance",
        violation.rule,
        violation.severity,
        violation.message,
        violation.entityId
      )),
      ...assessment.map((item) => finding(
        "responsibility",
        item.code,
        item.severity,
        item.message,
        item.entityType === "activity" || item.entityType === "action" ? item.entityId : undefined
      ))
    ];
    const hierarchy = this.scoreHierarchy(program, findings);
    const responsibility = this.scoreResponsibility(program, assessment, findings);
    const kpi = this.scoreKpis(program, findings);
    const timeline = this.scoreTimeline(program, findings, options.today);
    const governanceScore = this.scoreGovernance(governance);
    const dimensions = { hierarchy, responsibility, kpi, timeline, governance: governanceScore };

    return {
      overallScore: round(Object.values(dimensions).reduce((sum, score) => sum + score, 0) / Object.values(dimensions).length),
      dimensions,
      findings,
      generatedAt: options.generatedAt ?? new Date().toISOString()
    };
  }

  private scoreHierarchy(program: Program, findings: ProgramQualityFinding[]): number {
    const goals = program.goals;
    const objectives = goals.flatMap((goal) => goal.objectives);
    const activities = objectives.flatMap((objective) => objective.activities);
    const actions = activities.flatMap((activity) => activity.actions);
    const checks: Array<[boolean, string, string]> = [];
    for (const goal of goals) checks.push([goal.programId === program.id, "goal.parent.invalid", "Goal is not attached to the selected Program." ]);
    for (const objective of objectives) checks.push([goals.some((goal) => goal.id === objective.goalId && goal.objectives.includes(objective)), "objective.parent.invalid", "Objective is orphaned from its Goal."]);
    for (const activity of activities) checks.push([objectives.some((objective) => objective.id === activity.objectiveId && objective.activities.includes(activity)), "activity.parent.invalid", "Activity is orphaned from its Objective."]);
    for (const action of actions) checks.push([activities.some((activity) => activity.id === action.activityId && activity.actions.includes(action)), "action.parent.invalid", "Action is orphaned from its Activity."]);
    for (const [valid, code, message] of checks) {
      if (!valid) findings.push(finding("hierarchy", code, "error", message));
    }
    return ratioScore(checks.filter(([valid]) => valid).length, checks.length);
  }

  private scoreResponsibility(
    program: Program,
    assessment: ResponsibilityAssessmentFinding[],
    findings: ProgramQualityFinding[]
  ): number {
    const entities = this.entities(program);
    const assigned = entities.filter((entity) => entity.assignments.some((item) =>
      item.responsibilityType === "PRIMARY" && (item.role === "EXECUTOR" || item.role === "OWNER")
    ));
    const coverage = ratioScore(assigned.length, entities.length);
    const assignmentQuality = ratioScore(entities.filter((entity) => entity.assignments.every((item) => item.entityId && item.displayName)).length, entities.length);
    const riskCount = assessment.filter((item) =>
      item.code === "OVER_DEPENDENT_INDIVIDUAL"
      || item.code === "OVERLOADED_UNIT"
      || item.code === "MISSING_COLLABORATION_COVERAGE"
      || item.code === "ACTIVITY_WITHOUT_RESPONSIBLE_EXECUTOR"
    ).length;
    const score = round((coverage * 0.6) + (assignmentQuality * 0.4) - (riskCount * 5));
    if (coverage < 100) findings.push(finding("responsibility", "responsibility.coverage.incomplete", "error", "Some activities or actions lack a primary responsible assignment."));
    return score;
  }

  private scoreKpis(program: Program, findings: ProgramQualityFinding[]): number {
    const actions = this.entities(program).filter((entity): entity is Action => entity.type === "action");
    const kpis = actions.flatMap((action) => action.kpis);
    const coverage = ratioScore(actions.filter((action) => action.kpis.length > 0).length, actions.length);
    const measurable = ratioScore(kpis.filter((kpi) => Number.isFinite(kpi.target)).length, kpis.length);
    const units = ratioScore(kpis.filter((kpi) => Boolean(kpi.unit?.trim())).length, kpis.length);
    if (actions.length > 0 && coverage < 100) findings.push(finding("kpi", "kpi.coverage.incomplete", "warning", "Not every action has KPI coverage."));
    if (kpis.some((kpi) => !Number.isFinite(kpi.target))) findings.push(finding("kpi", "kpi.target.invalid", "error", "At least one KPI has a non-measurable target."));
    if (kpis.some((kpi) => !kpi.unit?.trim())) findings.push(finding("kpi", "kpi.unit.missing", "error", "At least one KPI is missing a unit."));
    return round((coverage + measurable + units) / 3);
  }

  private scoreTimeline(program: Program, findings: ProgramQualityFinding[], today?: string): number {
    const entities = this.entities(program);
    const dated = entities.filter((entity) => entity.timeline.start && entity.timeline.end);
    const validSequence = dated.filter((entity) => compareProgramDates(entity.timeline.start, entity.timeline.end) !== 1);
    const overdue = today ? entities.filter((entity): entity is Action => entity.type === "action" && isActionOverdue(entity, today)).length : 0;
    const completeScore = ratioScore(dated.length, entities.length);
    const sequenceScore = ratioScore(validSequence.length, dated.length);
    const overduePenalty = entities.length === 0 ? 0 : (overdue / entities.length) * 100;
    if (dated.length < entities.length) findings.push(finding("timeline", "timeline.dates.missing", "warning", "Some activities or actions are missing timeline dates."));
    if (validSequence.length < dated.length) findings.push(finding("timeline", "timeline.sequence.invalid", "error", "Some timelines have an end date before their start date."));
    if (overdue > 0) findings.push(finding("timeline", "timeline.overdue.risk", "warning", `${overdue} action(s) are overdue.`));
    return round((completeScore * 0.45) + (sequenceScore * 0.45) + (100 - overduePenalty) * 0.1);
  }

  private scoreGovernance(governance: GovernanceValidationReport): number {
    return round(100 - (governance.errors.length * 10) - (governance.warnings.length * 3));
  }

  private entities(program: Program): Array<Activity | Action> {
    return program.goals.flatMap((goal: Goal) => goal.objectives.flatMap((objective: Objective) =>
      objective.activities.flatMap((activity: Activity) => [activity, ...activity.actions])
    ));
  }
}

export function calculateProgramQualityScore(
  program: Program,
  governance: GovernanceValidationReport,
  assessment: ResponsibilityAssessmentFinding[],
  options?: ProgramQualityScoreOptions
): ProgramQualityScore {
  return new ProgramQualityScoreEngine().calculate(program, governance, assessment, options);
}
