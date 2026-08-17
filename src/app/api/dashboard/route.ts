import { currentPlanDate } from "../../../lib/data";
import { calculatePulseScore, getKpiHealth, inspectProgramQuality, riskSeverity, type KpiRecord, type RiskRecord, type WorkItem } from "../../../lib/domain";
import { ensureRuntimeData, handleApiError, json } from "../_lib";
import { ActionRepository, DependencyRepository, DepartmentRepository, GoalRepository, KPIRepository, RiskRepository } from "../../../server/repositories";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    ensureRuntimeData();
    const goalRows = new GoalRepository().list() as Array<{ id: string; title: string }>;
    const actionRows = new ActionRepository().list() as Array<Record<string, unknown>>;
    const kpiRows = new KPIRepository().list() as Array<Record<string, unknown>>;
    const riskRows = new RiskRepository().list() as Array<Record<string, unknown>>;
    const dependencyRows = new DependencyRepository().list() as Array<Record<string, unknown>>;
    const items = actionRows.map((row) => ({
      publicId: String(row.public_id),
      goalId: String(row.goal_id),
      title: String(row.title),
      workType: row.work_type as WorkItem["workType"],
      ownerPersonId: String(row.owner_person_id),
      deliverable: String(row.deliverable),
      deadline: String(row.planned_end),
      status: row.status as WorkItem["status"],
      progress: Number(row.progress)
    }));
    const kpis = kpiRows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      actual: Number(row.actual),
      target: Number(row.target),
      direction: row.direction as KpiRecord["direction"]
    }));
    const risks = riskRows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      probability: Number(row.probability),
      impact: Number(row.impact),
      status: row.status as RiskRecord["status"]
    }));
    const goals = goalRows.map((goal) => {
      const related = items.filter((item) => item.goalId === goal.id);
      const progress = related.length ? Math.round(related.reduce((sum, item) => sum + item.progress, 0) / related.length) : 0;
      const health = progress >= 70 ? "سبز" : progress >= 45 ? "زرد" : related.length ? "قرمز" : "خاکستری";
      return { ...goal, progress, health, actionCount: related.length };
    });
    const score = calculatePulseScore(goals.map((goal) => goal.progress), items, kpis, risks, currentPlanDate);
    const quality = inspectProgramQuality(items, new Set(goalRows.map((goal) => goal.id)), new Set(kpiRows.map((row) => String(row.work_item_id ?? row.id))), dependencyRows.map((row) => ({
      sourceWorkItemId: String(row.source_work_item_id),
      targetWorkItemId: String(row.target_work_item_id),
      status: row.status as "باز" | "حل‌شده",
      delayDays: Number(row.delay_days)
    })), currentPlanDate);
    const departmentRows = new DepartmentRepository().list() as Array<{ id: string; name: string }>;
    const departments = departmentRows.map((department) => {
      const related = actionRows.filter((row) => row.department_id === department.id);
      const progress = related.length ? Math.round(related.reduce((sum, row) => sum + Number(row.progress), 0) / related.length) : 0;
      const attentionCount = related.filter((row) => row.status === "مسدود" || String(row.planned_end) < currentPlanDate).length;
      return { ...department, actionCount: related.length, progress, attentionCount, health: progress >= 70 ? "سبز" : progress >= 45 ? "زرد" : related.length ? "قرمز" : "خاکستری" };
    });
    return json({
      goals,
      departments,
      actions: actionRows,
      kpis: kpiRows.map((row) => ({ ...row, health: getKpiHealth({ id: String(row.id), name: String(row.name), actual: Number(row.actual), target: Number(row.target), direction: row.direction as KpiRecord["direction"] }) })),
      risks: riskRows.map((row) => ({ ...row, severity: riskSeverity(Number(row.probability), Number(row.impact)) })),
      dependencies: dependencyRows,
      score,
      quality
    });
  } catch (error) {
    return handleApiError(error);
  }
}
