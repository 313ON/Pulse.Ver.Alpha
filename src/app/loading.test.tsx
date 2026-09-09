import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Loading from "./loading";

Object.assign(globalThis, { React });

describe("dashboard loading state", () => {
  it("reserves dashboard geometry with a meaningful busy label", () => {
    const markup = renderToStaticMarkup(<Loading />);
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-label="در حال بارگذاری داشبورد"');
    expect(markup).toContain("dashboard-skeleton-grid");
    expect(markup).not.toContain("امتیاز سلامت برنامه");
  });
});
