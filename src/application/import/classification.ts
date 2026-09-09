import type { ImportSource } from "./contracts";

export type GovernedImportClassification = {
  classification: "CANONICAL" | "DERIVED" | "SUPPORTING" | "REFERENCE" | "AMBIGUOUS" | "UNRESOLVED";
  domain?: string;
  authority: "GOVERNED_SOURCE_CATALOG" | "UNRESOLVED_SOURCE";
};

const governedSources: Record<string, GovernedImportClassification> = {
  "Annual program supplies - برنامه سال 1405 - تدارکات -اصلاحی (1).xlsx": {
    classification: "SUPPORTING",
    domain: "procurement",
    authority: "GOVERNED_SOURCE_CATALOG"
  },
  "برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx": {
    classification: "DERIVED",
    domain: "maintenance",
    authority: "GOVERNED_SOURCE_CATALOG"
  },
  "برنامه سال 1405 آقای عبودی.xlsx": {
    classification: "DERIVED",
    domain: "production",
    authority: "GOVERNED_SOURCE_CATALOG"
  },
  "پیش نویس برنامه سالیانه 1405 واحد اداری (1).xlsx": {
    classification: "DERIVED",
    domain: "administration",
    authority: "GOVERNED_SOURCE_CATALOG"
  }
};

function sourceName(value: string): string {
  return value.replace(/[\\/]/g, "_").trim().slice(-160);
}

export function classifyImportSource(name: string): GovernedImportClassification {
  return governedSources[sourceName(name)] ?? {
    classification: "UNRESOLVED",
    authority: "UNRESOLVED_SOURCE"
  };
}

export function applyGovernedClassification(source: ImportSource): ImportSource {
  const classification = classifyImportSource(source.name);
  return {
    ...source,
    metadata: {
      ...source.metadata,
      classification: classification.classification,
      ...(classification.domain ? { domain: classification.domain } : {}),
      classificationAuthority: classification.authority
    }
  };
}
