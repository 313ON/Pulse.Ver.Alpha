import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ThemeTokens } from "./ThemeTokens";

const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("UI foundation hardening", () => {
  it("gives the sidebar and workspace independent scroll ownership", () => {
    expect(globalStyles).toMatch(/\.pulse-shell \.sidebar[\s\S]*?overflow-y:\s*auto/);
    expect(globalStyles).toMatch(/\.workspace-layout[\s\S]*?overflow-y:\s*auto/);
    expect(globalStyles).toMatch(/body\s*\{\s*overflow:\s*hidden/);
    expect(globalStyles).toMatch(/overscroll-behavior:\s*contain/);
  });

  it("defines semantic theme tokens for both explicit themes", () => {
    expect(globalStyles).toContain("--color-background:");
    expect(globalStyles).toContain("--color-card-foreground:");
    expect(globalStyles).toContain('html[data-theme="light"]');
    expect(globalStyles).toContain('html:not([data-theme="dark"])');
    expect(ThemeTokens.semantic.sidebar).toBe("var(--color-sidebar)");
    expect(ThemeTokens.semantic.cardForeground).toBe("var(--color-card-foreground)");
  });
});
