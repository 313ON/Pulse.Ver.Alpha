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
          <div className="eyebrow">INTELLIGENCE LAYER / 01</div>
          <h2 id="cognition-core-title">PULSE COGNITION CORE</h2>
          <p>Operational understanding across the active workspace</p>
        </div>
        <span className="cognition-core-badge" style={{ color: ThemeTokens.colors.cyan }}>
          <i /> CORE ONLINE
        </span>
      </div>
      <div className="cognition-grid">
        <div className="cognition-context">
          <ContextMeter value={94} />
          <div className="confidence-readout"><span>Confidence</span><strong>89%</strong><small>Model certainty</small></div>
        </div>
        <div className="cognition-state">
          <CognitionStatus label="System Understanding" value="Active" tone="active" />
          <ReasoningIndicator />
        </div>
        <IntelligenceTimeline />
      </div>
    </section>
  );
}
