import path from "node:path";
import os from "node:os";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { closeDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { createProgramServices } from "../../server/program";
import { StrategicCommandCenter } from "./StrategicCommandCenter";

Object.assign(globalThis, { React });

beforeEach(() => {
  closeDatabase();
  process.env.PULSE_DB_PATH = path.join(os.tmpdir(), `pulse-command-center-${Date.now()}-${Math.random()}.sqlite`);
  seedBaseline();
});

function liveProgram() {
  return createProgramServices().query.getProgram({
    id: "program-1405",
    title: "برنامه سالانه تحول دیجیتال ۱۴۰۵",
    description: "داده زنده برنامه",
    status: "در حال اجرا"
  }).hierarchy;
}

describe("live strategic command center", () => {
  it("renders persisted program data instead of fixture labels", () => {
    const markup = renderToStaticMarkup(<StrategicCommandCenter program={liveProgram()} />);

    expect(markup).toContain("برنامه سالانه تحول دیجیتال ۱۴۰۵");
    expect(markup).toContain("اهداف راهبردی");
    expect(markup).not.toContain("ارتقای زیرساخت فناوری اطلاعات");
  });

  it("persists a hierarchy command and renders it after refresh", () => {
    const services = createProgramServices();
    services.commands.createGoal({ id: "G98", title: "هدف زنده آزمون" });
    services.commands.createObjective({ id: "O98", goalId: "G98", title: "هدف جزئی زنده" });
    services.commands.createActivity({ id: "A98", objectiveId: "O98", title: "فعالیت زنده" });

    const refreshed = liveProgram();
    const goal = refreshed.goals.find((item) => item.id === "G98");
    expect(goal?.objectives[0].activities[0].title).toBe("فعالیت زنده");
    expect(renderToStaticMarkup(<StrategicCommandCenter program={refreshed} />)).toContain("هدف زنده آزمون");
  });
});
