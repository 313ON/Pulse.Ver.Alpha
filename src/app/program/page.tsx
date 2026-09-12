import { ExecutionCommandCenter } from "../../components/program/ExecutionCommandCenter";
import { requirePageSession } from "../api/_lib";
import { getDashboardContextOptions, resolveDashboardContext } from "../../server/dashboard";
import { redirect } from "next/navigation";

export default async function ProgramPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePageSession();
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const options = getDashboardContextOptions();
  const context = resolveDashboardContext(options, { planCycle: first(params.planCycle), unit: first(params.unit) }, user);
  const requestedPlanCycle = first(params.planCycle);
  const requestedUnit = first(params.unit);
  if (requestedPlanCycle || requestedUnit) {
    if (requestedPlanCycle !== String(context.planYear) || requestedUnit !== context.organizationalUnitId) {
      redirect(`/program?planCycle=${encodeURIComponent(context.planYear)}&unit=${encodeURIComponent(context.organizationalUnitId)}`);
    }
  }
  const unitLabel = context.organizationalUnitId === "ALL"
    ? "همه واحدها"
    : options.organizationalUnits.find((unit) => unit.id === context.organizationalUnitId)?.name ?? context.organizationalUnitId;
  return <ExecutionCommandCenter context={context} unitLabel={unitLabel} />;
}
