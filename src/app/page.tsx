import { PulseShell } from "../components/PulseShell";
import { StrategicCommandCenter } from "../components/program/StrategicCommandCenter";
import { ensureRuntimeData } from "./api/_lib";
import { requirePagePermission } from "./api/_lib";
import { createProgramServices } from "../server/program";
import { getPlanningContext } from "../domain/planning";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requirePagePermission("goals.view");
  ensureRuntimeData();
  const planning = getPlanningContext();
  const { query } = createProgramServices();
  const program = query.getProgram({
    id: `program-${planning.planYear}`,
    title: `برنامه سالانه تحول دیجیتال ${planning.planYear}`,
    description: `نقشه اجرایی یکپارچه تحول دیجیتال سازمان در چرخه برنامه‌ریزی سالانه ${planning.planYear}`,
    status: "در حال اجرا",
    priority: "بحرانی",
    start: planning.startDate,
    end: planning.endDate
  }).hierarchy;
  return <PulseShell><StrategicCommandCenter program={program} /></PulseShell>;
}
