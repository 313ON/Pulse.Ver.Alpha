import { MotionTokens } from "../MotionTokens";
import { ThemeTokens } from "../ThemeTokens";

export function ReasoningIndicator({ state = "Processing" }: { state?: string }) {
  return (
    <div className="reasoning-indicator" aria-label={`Reasoning state: ${state}`}>
      <span className="reasoning-mark" style={{ color: ThemeTokens.colors.cyan, transitionDuration: MotionTokens.standard }}>
        <i /><i /><i />
      </span>
      <span><small>REASONING STATE</small><strong>{state}</strong></span>
    </div>
  );
}
