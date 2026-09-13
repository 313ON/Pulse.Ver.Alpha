import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DomainSummaryCard, StatusBadge, SurfaceState } from "./PulseUI";

Object.assign(globalThis, { React });

describe("PULSE design system primitives", () => {
  it("communicates status with text and a non-color icon", () => {
    const markup = renderToStaticMarkup(<StatusBadge label="نیازمند توجه" tone="warning" />);
    expect(markup).toContain("نیازمند توجه");
    expect(markup).toContain('aria-hidden="true"');
  });

  it("keeps empty and error states actionable and human-readable", () => {
    const markup = renderToStaticMarkup(<SurfaceState kind="error" title="دریافت داده انجام نشد" description="اتصال را بررسی کنید و دوباره تلاش کنید." />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("اتصال را بررسی کنید");
  });

  it("represents a core domain concept without exposing technical identifiers", () => {
    const markup = renderToStaticMarkup(<DomainSummaryCard kind="goal" title="بهبود بهره‌وری تولید" context="هدف راهبردی" progress={64} />);
    expect(markup).toContain("بهبود بهره‌وری تولید");
    expect(markup).toContain("64٪");
    expect(markup).not.toContain("parent_id");
  });
});
