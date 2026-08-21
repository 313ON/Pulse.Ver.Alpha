import { describe, expect, it } from "vitest";
import { pagePermissions, permissionForPage } from "./pageAuthorization";

describe("server page authorization map", () => {
  it("covers protected page families with their existing API permissions", () => {
    expect(pagePermissions).toMatchObject({
      goals: "goals.view",
      actions: "actions.view",
      reports: "reports.view",
      imports: "imports.manage"
    });
  });

  it("fails closed to a protected permission for unknown sections", () => {
    expect(permissionForPage("unknown")).toBe("goals.view");
  });
});
