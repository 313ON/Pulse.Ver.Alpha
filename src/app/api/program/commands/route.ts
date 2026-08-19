import { ensureRuntimeData, handleApiError, json, readJson, requirePermission } from "../../_lib";
import { createProgramServices } from "../../../../server/program";
import type { ProgramNodeType } from "../../../../domain/program";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    ensureRuntimeData();
    const body = await readJson(request);
    const type = String(body.type) as Exclude<ProgramNodeType, "program" | "kpi">;
    const parentId = String(body.parentId ?? "");
    const title = String(body.title ?? "").trim();
    if (!title || !parentId || !["goal", "objective", "activity", "action"].includes(type)) {
      return json({ error: "نوع، والد و عنوان گره الزامی است.", code: "VALIDATION" }, { status: 400 });
    }

    const { commands, query } = createProgramServices();
    if (type === "goal") {
      await requirePermission("goals.edit");
      const program = query.getProgram({ id: "program-1405", title: "برنامه ۱۴۰۵" }).hierarchy;
      const nextId = nextIdentifier("G", program.goals.map((goal) => goal.id));
      return json(commands.createGoal({ id: nextId, title, programId: parentId }), { status: 201 });
    }
    if (type === "objective") {
      await requirePermission("goals.edit");
      const goal = findGoal(query.getProgram({ id: "program-1405", title: "برنامه ۱۴۰۵" }).hierarchy, parentId);
      if (!goal) return json({ error: "هدف والد پیدا نشد.", code: "NOT_FOUND" }, { status: 404 });
      return json(commands.createObjective({ id: nextIdentifier("O", goal.objectives.map((item) => item.id)), goalId: goal.id, title }), { status: 201 });
    }
    if (type === "activity") {
      await requirePermission("activities.create");
      return json(commands.createActivity({ objectiveId: parentId, title }), { status: 201 });
    }
    await requirePermission("actions.create");
    const activity = findActivity(query.getProgram({ id: "program-1405", title: "برنامه ۱۴۰۵" }).hierarchy, parentId);
    if (!activity) return json({ error: "فعالیت والد پیدا نشد.", code: "NOT_FOUND" }, { status: 404 });
    const objective = findObjective(query.getProgram({ id: "program-1405", title: "برنامه ۱۴۰۵" }).hierarchy, activity.objectiveId);
    const goal = objective ? findGoal(query.getProgram({ id: "program-1405", title: "برنامه ۱۴۰۵" }).hierarchy, objective.goalId) : undefined;
    if (!objective || !goal) return json({ error: "زنجیره والد اقدام کامل نیست.", code: "VALIDATION" }, { status: 400 });
    return json(commands.createAction({
      publicId: `${goal.id}-${objective.id}-${activity.id}-T${Date.now().toString().slice(-3)}`,
      goalId: goal.id,
      objectiveId: objective.id,
      activityId: activity.id,
      title,
      workType: "اقدام",
      departmentId: "it",
      ownerPersonId: "it-engineer",
      deliverable: title,
      deadline: "۱۴۰۵/۱۲/۲۹",
      plannedStart: "۱۴۰۵/۰۶/۰۱",
      status: "پیش‌نویس",
      progress: 0
    }), { status: 201 });
  } catch (error) { return handleApiError(error); }
}

function nextIdentifier(prefix: string, ids: string[]) {
  const max = ids.reduce((value, id) => Math.max(value, Number(id.match(new RegExp(`^${prefix}(\\d+)$`))?.[1] ?? 0)), 0);
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

function findGoal(program: ReturnType<ReturnType<typeof createProgramServices>["query"]["getProgram"]>["hierarchy"], id: string) {
  return program.goals.find((goal) => goal.id === id);
}
function findObjective(program: ReturnType<ReturnType<typeof createProgramServices>["query"]["getProgram"]>["hierarchy"], id: string) {
  return program.goals.flatMap((goal) => goal.objectives).find((objective) => objective.id === id);
}
function findActivity(program: ReturnType<ReturnType<typeof createProgramServices>["query"]["getProgram"]>["hierarchy"], id: string) {
  return program.goals.flatMap((goal) => goal.objectives).flatMap((objective) => objective.activities).find((activity) => activity.id === id);
}
