import { ThemeTokens } from "../ThemeTokens";

type CognitionStatusProps = {
  label: string;
  value: string;
  tone?: "active" | "processing" | "ready" | "muted";
};

const tones = {
  active: ThemeTokens.colors.green,
  processing: ThemeTokens.colors.cyan,
  ready: ThemeTokens.colors.amber,
  muted: ThemeTokens.colors.textDim
} as const;

export function CognitionStatus({ label, value, tone = "active" }: CognitionStatusProps) {
  return (
    <div className="cognition-status">
      <span className="cognition-status-label">{label}</span>
      <span className="cognition-status-value">
        <i className="cognition-led" style={{ backgroundColor: tones[tone] }} />
        {value}
      </span>
    </div>
  );
}
