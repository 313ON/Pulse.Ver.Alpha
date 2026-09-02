import { describe, expect, it } from "vitest";
import { detailIdForRow } from "./ManagementPage";

describe("management detail links", () => {
  it("uses the action public ID that the detail API resolves", () => {
    expect(detailIdForRow("actions", { id: "internal-work-item-id", public_id: "G01-O01-A01-T001" }))
      .toBe("G01-O01-A01-T001");
  });

  it("keeps non-action detail identity unchanged", () => {
    expect(detailIdForRow("goals", { id: "G01", public_id: "legacy-goal-id" })).toBe("G01");
  });
});
