import { MotionTokens } from "../MotionTokens";
import { ThemeTokens } from "../ThemeTokens";

export function ReasoningIndicator({ state = "Processing" }: { state?: string }) {
  return (
    <div className="reasoning-indicator" aria-label={`وضعیت استدلال: ${state}`}>
      <span className="reasoning-mark" style={{ color: ThemeTokens.colors.cyan, transitionDuration: MotionTokens.standard }}>
        <i /><i /><i />
      </span>
      <span><small>وضعیت استدلال</small><strong>{state === "Processing" ? "در حال پردازش" : state}</strong></span>
    </div>
  );
}
