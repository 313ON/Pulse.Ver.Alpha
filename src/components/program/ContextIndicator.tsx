import type { DashboardContext } from "./dashboard-context";

export function ContextIndicator({ context, unitLabel }: { context: DashboardContext; unitLabel?: string }) {
  return (
    <div className="context-indicator" role="status" aria-label="زمینه فعال برنامه">
      <span className="context-indicator-dot" aria-hidden="true" />
      <span className="context-indicator-label">زمینه فعال</span>
      <strong>چرخه {context.planYear}</strong>
      <span className="context-indicator-divider" aria-hidden="true">/</span>
      <span>{unitLabel ?? (context.organizationalUnitId === "ALL" ? "همه واحدها" : context.organizationalUnitId)}</span>
    </div>
  );
}
