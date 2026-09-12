import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ContextIndicator } from "./program/ContextIndicator";
import { ManagementPage } from "./ManagementPage";

Object.assign(globalThis, { React });
vi.mock("next/navigation", () => ({
  usePathname: () => "/goals",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

describe("PULSE unified product surfaces", () => {
  it("makes canonical context legible on context-aware surfaces", () => {
    const markup = renderToStaticMarkup(<ContextIndicator context={{ planYear: 1405, organizationalUnitId: "production" }} unitLabel="تولید" />);
    expect(markup).toContain("زمینه فعال");
    expect(markup).toContain("چرخه 1405");
    expect(markup).toContain("تولید");
    expect(markup).toContain("context-indicator");
  });

  it("does not present an empty register while the first request is pending", () => {
    const markup = renderToStaticMarkup(<ManagementPage section="goals" />);
    expect(markup).toContain("در حال دریافت اهداف کلی");
    expect(markup).toContain("surface-state");
    expect(markup).not.toContain("هنوز اهداف کلی ثبت نشده است");
  });
});
