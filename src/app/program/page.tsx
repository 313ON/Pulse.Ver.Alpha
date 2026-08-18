import { PulseShell } from "../../components/PulseShell";
import { StrategicCommandCenter } from "../../components/program/StrategicCommandCenter";
import { ensureRuntimeData } from "../api/_lib";
import { createProgramServices } from "../../server/program";

export const dynamic = "force-dynamic";

export default function ProgramPage() {
  ensureRuntimeData();
  const { query } = createProgramServices();
  const program = query.getProgram({
    id: "program-1405",
    title: "برنامه سالانه تحول دیجیتال ۱۴۰۵",
    description: "نقشه اجرایی یکپارچه تحول دیجیتال سازمان در چرخه برنامه‌ریزی سالانه",
    status: "در حال اجرا",
    priority: "بحرانی",
    start: "۱۴۰۵/۰۱/۰۱",
    end: "۱۴۰۵/۱۲/۲۹"
  }).hierarchy;
  return <PulseShell><StrategicCommandCenter program={program} /></PulseShell>;
}
