import { ThemeTokens } from "../ThemeTokens";

export function ContextMeter({ value = 94 }: { value?: number }) {
  const boundedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="context-meter">
      <div className="context-meter-head"><span>زمینه جاری</span><strong>{boundedValue}٪</strong></div>
      <div className="context-meter-track" role="progressbar" aria-valuenow={boundedValue} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${boundedValue}%`, background: ThemeTokens.colors.cyan }} />
      </div>
      <small>سیگنال‌های فضای کاری برای استدلال نگهداری می‌شوند</small>
    </div>
  );
}
