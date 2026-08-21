import { getPlanningContext, type PlanningContext } from "../../domain/planning";
import { SQLiteOperationalProgramReadRepository } from "../../server/reporting/OperationalProgramReadRepository";
import { ReadOnlyProgramQueryService } from "./ReadOnlyProgramQueryService";

export function getCanonicalProgram(planning: PlanningContext = getPlanningContext()) {
  return new ReadOnlyProgramQueryService(
    new SQLiteOperationalProgramReadRepository(),
    undefined,
    planning
  ).getProgram({
    id: `program-${planning.planYear}`,
    title: `برنامه سالانه تحول دیجیتال ${planning.planYear}`,
    description: `گزارش برنامه canonical سال ${planning.planYear}`,
    status: "در حال اجرا",
    priority: "بحرانی",
    start: planning.startDate,
    end: planning.endDate
  }).hierarchy;
}
