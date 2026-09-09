import path from "node:path";
import os from "node:os";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeDatabase } from "../../server/db";
import { seedBaseline } from "../../server/seed";
import { createProgramServices } from "../../server/program";
import { programDateDistance } from "../../domain/program/rules";
import { attentionWeight, managementState, StrategicCommandCenter } from "./StrategicCommandCenter";
import { classifyDashboardData } from "./dashboard-state";
import { DashboardStateView } from "./DashboardStateView";

Object.assign(globalThis, { React });
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() })
}));

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
  it("uses canonical status/date semantics for management states", () => {
    const item = (status: string, progress: number, end: string) => ({
      status,
      progress,
      timeline: { end }
    });

    expect(managementState(item("در حال اجرا", 20, "۱۴۰۵/۰۶/۱۴"), "۱۴۰۵/۰۶/۱۵")).toBe("overdue");
    expect(managementState(item("در حال اجرا", 20, "۱۴۰۵/۰۶/۱۵"), "۱۴۰۵/۰۶/۱۵")).toBe("due-soon");
    expect(managementState(item("در حال اجرا", 20, "۱۴۰۵/۰۶/۲۹"), "۱۴۰۵/۰۶/۱۵")).toBe("due-soon");
    expect(managementState(item("در حال اجرا", 20, "۱۴۰۵/۰۶/۳۰"), "۱۴۰۵/۰۶/۱۵")).toBe("risk");
    expect(managementState(item("مسدود", 100, "۱۴۰۵/۰۶/۱۵"), "۱۴۰۵/۰۶/۱۵")).toBe("blocked");
    expect(managementState(item("تکمیل شده", 20, "۱۴۰۵/۰۶/۱۴"), "۱۴۰۵/۰۶/۱۵")).toBe("completed");
    expect(managementState(item("لغو شده", 20, "۱۴۰۵/۰۶/۱۴"), "۱۴۰۵/۰۶/۱۵")).toBe("on-track");
    expect(managementState(item("در حال اجرا", 20, ""), "۱۴۰۵/۰۶/۱۵")).toBe("risk");
  });

  it("calculates due-soon distance across Jalali month and year boundaries", () => {
    expect(programDateDistance("۱۴۰۵/۰۶/۲۵", "۱۴۰۵/۰۶/۲۰")).toBe(5);
    expect(programDateDistance("۱۴۰۵/۰۷/۰۵", "۱۴۰۵/۰۶/۲۵")).toBe(11);
    expect(programDateDistance("۱۴۰۵/۰۷/۰۹", "۱۴۰۵/۰۶/۲۶")).toBe(14);
    expect(programDateDistance("۱۴۰۵/۰۷/۱۰", "۱۴۰۵/۰۶/۲۶")).toBe(15);
    expect(programDateDistance("۱۴۰۶/۰۱/۰۵", "۱۴۰۵/۱۲/۲۵")).toBe(9);
  });

  it("applies due-soon boundaries and exclusions using actual day distance", () => {
    const item = (status: string, progress: number, end: string) => ({
      status,
      progress,
      timeline: { end }
    });

    expect(managementState(item("در حال اجرا", 80, "۱۴۰۵/۰۷/۰۵"), "۱۴۰۵/۰۶/۲۵")).toBe("due-soon");
    expect(managementState(item("در حال اجرا", 80, "۱۴۰۵/۰۷/۰۹"), "۱۴۰۵/۰۶/۲۶")).toBe("due-soon");
    expect(managementState(item("در حال اجرا", 80, "۱۴۰۵/۰۷/۱۰"), "۱۴۰۵/۰۶/۲۶")).toBe("on-track");
    expect(managementState(item("در حال اجرا", 80, "۱۴۰۵/۰۶/۲۴"), "۱۴۰۵/۰۶/۲۵")).toBe("overdue");
    expect(managementState(item("تکمیل شده", 100, "۱۴۰۵/۰۷/۰۵"), "۱۴۰۵/۰۶/۲۵")).toBe("completed");
    expect(managementState(item("مسدود", 80, "۱۴۰۵/۰۷/۰۵"), "۱۴۰۵/۰۶/۲۵")).toBe("blocked");
    expect(managementState(item("لغو شده", 80, "۱۴۰۵/۰۷/۰۵"), "۱۴۰۵/۰۶/۲۵")).toBe("on-track");
  });

  it("orders attention states deterministically by the established priority", () => {
    const item = (status: string, progress: number, end: string) => ({
      status,
      progress,
      timeline: { end }
    });

    expect(attentionWeight(item("مسدود", 0, "۱۴۰۵/۰۶/۳۰"), "۱۴۰۵/۰۶/۱۵")).toBeGreaterThan(
      attentionWeight(item("در حال اجرا", 20, "۱۴۰۵/۰۶/۱۴"), "۱۴۰۵/۰۶/۱۵")
    );
    expect(attentionWeight(item("در حال اجرا", 20, "۱۴۰۵/۰۶/۱۴"), "۱۴۰۵/۰۶/۱۵")).toBeGreaterThan(
      attentionWeight(item("در حال اجرا", 20, "۱۴۰۵/۰۶/۳۰"), "۱۴۰۵/۰۶/۱۵")
    );
    expect(attentionWeight(item("در حال اجرا", 80, "۱۴۰۵/۰۷/۰۱"), "۱۴۰۵/۰۶/۱۵")).toBe(1);
  });

  it("renders persisted program data instead of fixture labels", () => {
    const markup = renderToStaticMarkup(<StrategicCommandCenter program={liveProgram()} />);

    expect(markup).toContain("برنامه سالانه تحول دیجیتال ۱۴۰۵");
    expect(markup).toContain("اهداف راهبردی");
    expect(markup).not.toContain("ارتقای زیرساخت فناوری اطلاعات");
  });

  it("models empty, partial, and ready dashboard data explicitly", () => {
    const program = liveProgram();
    expect(classifyDashboardData({ ...program, goals: [] }).kind).toBe("empty");
    expect(classifyDashboardData({ ...program, goals: [{ ...program.goals[0], objectives: [] }] }).kind).toBe("partial");
    expect(classifyDashboardData(program).kind).toBe("partial");
    expect(renderToStaticMarkup(<StrategicCommandCenter state={{ kind: "ready", program }} />)).toContain("امتیاز سلامت برنامه");
    expect(renderToStaticMarkup(<DashboardStateView state={{ kind: "empty", planYear: "۱۴۰۵" }} />)).toContain("هنوز داده قابل استفاده‌ای");
    expect(renderToStaticMarkup(<DashboardStateView state={{ kind: "partial", program, missing: ["اقدام‌های متصل"] }} />)).toContain("نمای ناقص برنامه");
  });

  it("exposes retry for recoverable failures without exposing internals", () => {
    const markup = renderToStaticMarkup(<DashboardStateView state={{ kind: "recoverable-error", message: "دریافت داده‌های داشبورد با مشکل روبه‌رو شد." }} />);
    expect(markup).toContain("تلاش دوباره");
    expect(markup).toContain("اگر مشکل ادامه داشت");
    expect(markup).not.toContain("stack");
  });

  it("does not render fabricated metrics for a blocking dashboard failure", () => {
    const markup = renderToStaticMarkup(<StrategicCommandCenter state={{ kind: "blocking-error", message: "داده پایدار برنامه در دسترس نیست.", guidance: "اتصال پایگاه داده را بررسی کنید." }} />);
    expect(markup).toContain("داشبورد فعلاً قابل استفاده نیست");
    expect(markup).toContain("اتصال پایگاه داده را بررسی کنید");
    expect(markup).not.toContain("امتیاز سلامت برنامه");
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
