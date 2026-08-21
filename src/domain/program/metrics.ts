import type { Action, KPI } from "./types";
import type { RiskRecord } from "../../lib/domain";
import { getKpiHealth, isActionOverdue } from "./rules";
import { DEFAULT_PLANNING_CONTEXT } from "../planning";

export type PulseScoreBreakdown = {
  goalProgress: number;
  executionControl: number;
  overdueControl: number;
  blockedControl: number;
  kpiHealth: number;
  criticalRiskControl: number;
  total: number;
};

function riskSeverity(probability: number, impact: number): number {
  return Math.max(1, Math.min(5, probability)) * Math.max(1, Math.min(5, impact));
}

export function calculatePulseScore(
  goalProgress: number[],
  actions: Action[],
  kpis: KPI[],
  risks: RiskRecord[],
  today = DEFAULT_PLANNING_CONTEXT.today
): PulseScoreBreakdown {
  const boundedAverage = (values: number[]) => values.length
    ? values.reduce((sum, value) => sum + Math.max(0, Math.min(100, value)), 0) / values.length
    : 0;
  const overdue = actions.filter((action) => isActionOverdue(action, today)).length;
  const blocked = actions.filter((action) => action.status === "مسدود").length;
  const active = actions.filter((action) => action.status !== "لغو شده").length;
  const healthyKpis = kpis.filter((kpi) => getKpiHealth(kpi) === "سبز").length;
  const criticalRisks = risks.filter((risk) => riskSeverity(risk.probability, risk.impact) >= 15 && risk.status !== "بسته").length;
  const goalComponent = boundedAverage(goalProgress);
  const executionControl = active ? (actions.filter((action) => action.status === "تکمیل شده").length / active) * 100 : 0;
  const overdueControl = active ? (1 - overdue / active) * 100 : 100;
  const blockedControl = active ? (1 - blocked / active) * 100 : 100;
  const kpiHealth = kpis.length ? (healthyKpis / kpis.length) * 100 : 0;
  const criticalRiskControl = risks.length ? (1 - criticalRisks / risks.length) * 100 : 100;
  const total = Math.round(goalComponent * 0.3 + executionControl * 0.25 + overdueControl * 0.15 + blockedControl * 0.1 + kpiHealth * 0.15 + criticalRiskControl * 0.05);
  return {
    goalProgress: Math.round(goalComponent),
    executionControl: Math.round(executionControl),
    overdueControl: Math.round(overdueControl),
    blockedControl: Math.round(blockedControl),
    kpiHealth: Math.round(kpiHealth),
    criticalRiskControl: Math.round(criticalRiskControl),
    total
  };
}
