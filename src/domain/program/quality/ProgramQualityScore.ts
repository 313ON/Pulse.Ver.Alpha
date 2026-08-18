export type ProgramQualityDimension = "hierarchy" | "responsibility" | "kpi" | "timeline" | "governance";

export type ProgramQualityFinding = {
  dimension: ProgramQualityDimension;
  code: string;
  severity: "warning" | "error";
  message: string;
  entityId?: string;
};

export type ProgramQualityScore = {
  overallScore: number;
  dimensions: {
    hierarchy: number;
    responsibility: number;
    kpi: number;
    timeline: number;
    governance: number;
  };
  findings: ProgramQualityFinding[];
  generatedAt: string;
};
