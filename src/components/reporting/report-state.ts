export type ReportState<T> =
  | { kind: "loading" }
  | { kind: "success"; report: T }
  | { kind: "empty"; report: T }
  | { kind: "error"; message: string };

export function classifyReportState<T extends { rows: unknown[] }>(report: T | null, error = ""): ReportState<T> {
  if (error) return { kind: "error", message: error };
  if (!report) return { kind: "loading" };
  return report.rows.length === 0 ? { kind: "empty", report } : { kind: "success", report };
}
