import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommandHeader, searchResultHref } from "./CommandHeader";

Object.assign(globalThis, { React });
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() })
}));

describe("command header global search", () => {
  it("maps existing search result types to their application routes", () => {
    expect(searchResultHref({ id: "G01", label: "هدف", type: "هدف" })).toBe("/goals/G01");
    expect(searchResultHref({ id: "G01-O01-A01-T001", label: "اقدام", type: "اقدام" })).toBe("/actions/G01-O01-A01-T001");
    expect(searchResultHref({ id: "person-1", label: "شخص", type: "پرسنل" })).toBe("/persons/person-1");
  });

  it("renders an accessible global search control backed by the existing API boundary", () => {
    const markup = renderToStaticMarkup(<CommandHeader />);

    expect(markup).toContain('aria-label="جستجوی سراسری"');
    expect(markup).toContain('placeholder="جستجوی سراسری..."');
    expect(markup).toContain('aria-controls="global-search-results"');
  });
});
