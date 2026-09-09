import { describe, expect, it } from "vitest";
import { applyGovernedClassification, classifyImportSource } from "./classification";

describe("governed import classification", () => {
  it("classifies known departmental sources from the server-owned catalog", () => {
    expect(classifyImportSource("برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx")).toEqual({
      classification: "DERIVED",
      domain: "maintenance",
      authority: "GOVERNED_SOURCE_CATALOG"
    });
  });

  it("does not invent classification for an unknown workbook", () => {
    expect(classifyImportSource("unknown.xlsx")).toEqual({
      classification: "UNRESOLVED",
      authority: "UNRESOLVED_SOURCE"
    });
  });

  it("persists classification as part of the import source state", () => {
    expect(applyGovernedClassification({ type: "EXCEL", name: "unknown.xlsx", metadata: { planYear: 1405 } })).toEqual({
      type: "EXCEL",
      name: "unknown.xlsx",
      metadata: {
        planYear: 1405,
        classification: "UNRESOLVED",
        classificationAuthority: "UNRESOLVED_SOURCE"
      }
    });
  });
});
