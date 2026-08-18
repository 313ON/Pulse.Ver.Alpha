import { ThemeTokens } from "../ThemeTokens";
import { CognitionStatus } from "./CognitionStatus";
import { ContextMeter } from "./ContextMeter";
import { IntelligenceTimeline } from "./IntelligenceTimeline";
import { ReasoningIndicator } from "./ReasoningIndicator";

export function CognitionPanel() {
  return (
    <section className="cognition-panel" aria-labelledby="cognition-core-title">
      <div className="cognition-panel-head">
        <div>
          <div className="eyebrow">لایه هوشمندی / ۰۱</div>
          <h2 id="cognition-core-title">هسته شناختی پالس</h2>
          <p>درک عملیاتی از فضای کاری فعال</p>
        </div>
        <span className="cognition-core-badge" style={{ color: ThemeTokens.colors.cyan }}>
          <i /> هسته فعال
        </span>
      </div>
      <div className="cognition-grid">
        <div className="cognition-context">
          <ContextMeter value={94} />
          <div className="confidence-readout"><span>اطمینان</span><strong>۸۹٪</strong><small>قطعیت مدل</small></div>
        </div>
        <div className="cognition-state">
          <CognitionStatus label="درک سیستم" value="فعال" tone="active" />
          <ReasoningIndicator />
        </div>
        <IntelligenceTimeline />
      </div>
    </section>
  );
}
