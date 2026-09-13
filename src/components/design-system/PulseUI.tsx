import type { ReactNode } from "react";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral" | "attention";

const statusIcons: Record<StatusTone, string> = {
  success: "✓",
  warning: "!",
  danger: "×",
  info: "i",
  neutral: "–",
  attention: "!"
};

export function StatusBadge({ label, tone = "neutral", compact = false }: { label: string; tone?: StatusTone; compact?: boolean }) {
  return <span className={`pulse-status pulse-status-${tone}${compact ? " pulse-status-compact" : ""}`}><span aria-hidden="true">{statusIcons[tone]}</span><span>{label}</span></span>;
}

export function ProgressBar({ value, label = "پیشرفت", tone = "primary" }: { value: number; label?: string; tone?: "primary" | "success" | "warning" | "danger" }) {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return <div className="pulse-progress" aria-label={`${label} ${bounded} درصد`}><div className="pulse-progress-track"><span className={`pulse-progress-fill pulse-progress-${tone}`} style={{ width: `${bounded}%` }} /></div><strong>{bounded}٪</strong></div>;
}

export function StatCard({ label, value, detail, tone = "neutral", href }: { label: string; value: string | number; detail: string; tone?: StatusTone; href?: string }) {
  const content = <><span className="pulse-stat-label">{label}</span><strong className="pulse-stat-value">{value}</strong><span className="pulse-stat-detail">{detail}</span></>;
  if (href) return <a className={`pulse-stat-card pulse-stat-${tone}`} href={href}>{content}</a>;
  return <div className={`pulse-stat-card pulse-stat-${tone}`}>{content}</div>;
}

export function SurfaceState({ kind, title, description, action }: { kind: "loading" | "empty" | "error" | "success"; title: string; description: string; action?: ReactNode }) {
  return <section className={`pulse-surface-state pulse-surface-${kind}`} role={kind === "error" ? "alert" : undefined}><span className="pulse-state-icon" aria-hidden="true">{kind === "loading" ? "…" : kind === "empty" ? "○" : kind === "error" ? "!" : "✓"}</span><div><h2>{title}</h2><p>{description}</p>{action && <div className="pulse-state-action">{action}</div>}</div></section>;
}

export function DomainSummaryCard({ kind, title, context, status, progress, meta, children }: { kind: "goal" | "objective" | "activity" | "action" | "kpi"; title: string; context?: string; status?: { label: string; tone: StatusTone }; progress?: number; meta?: string; children?: ReactNode }) {
  return <article className={`pulse-domain-card pulse-domain-${kind}`}><div className="pulse-domain-icon" aria-hidden="true">{kind === "goal" ? "◎" : kind === "objective" ? "◉" : kind === "activity" ? "▸" : kind === "action" ? "✓" : "◆"}</div><div className="pulse-domain-content"><div className="pulse-domain-overline"><span>{context ?? kind}</span>{status && <StatusBadge {...status} compact />}</div><h3>{title}</h3>{meta && <p>{meta}</p>}{progress !== undefined && <ProgressBar value={progress} label="پیشرفت" />}{children}</div></article>;
}
