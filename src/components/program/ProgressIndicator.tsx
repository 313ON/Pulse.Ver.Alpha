export function ProgressIndicator({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <div className={`program-progress ${compact ? "program-progress-compact" : ""}`} aria-label={`پیشرفت ${value} درصد`}>
      <div className="program-progress-track"><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      <strong>{value}٪</strong>
    </div>
  );
}
