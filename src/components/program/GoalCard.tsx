import type { Goal } from "../../domain/program";
import { PROGRAM_STATUS_LABELS } from "../../domain/program";
import { ProgressIndicator } from "./ProgressIndicator";
import { StatusBadge, type StatusTone } from "../design-system/PulseUI";

export function GoalCard({ node, expanded, onToggle, onSelect, onAddChild }: CardProps<Goal>) {
  return <EntityCard node={node} expanded={expanded} onToggle={onToggle} onSelect={onSelect} onAddChild={onAddChild} icon="◎" tone="goal" childLabel="هدف جزئی" />;
}

type CardProps<T> = { node: T; expanded: boolean; onToggle: () => void; onSelect: () => void; onAddChild: () => void };

export function EntityCard<T extends { title: string; description: string; status: string; owner: string; priority: string; progress: number; timeline: { end: string } }>({
  node, expanded, onToggle, onSelect, onAddChild, icon, tone, childLabel
}: CardProps<T> & { icon: string; tone: string; childLabel: string }) {
  return (
    <article className={`program-node-card ${tone} ${expanded ? "is-expanded" : ""}`} onClick={onSelect}>
      <button className="program-node-toggle" onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label={expanded ? "بستن شاخه" : "باز کردن شاخه"}>
        {expanded ? "⌄" : "‹"}
      </button>
      <div className="program-node-icon">{icon}</div>
      <div className="program-node-main">
        <div className="program-node-kicker"><StatusBadge label={PROGRAM_STATUS_LABELS[node.status as keyof typeof PROGRAM_STATUS_LABELS] ?? node.status} tone={statusTone(node.status)} compact /> <span>·</span> اولویت {node.priority}</div>
        <h3>{node.title}</h3>
        <p>{node.description}</p>
        <div className="program-node-meta"><span>مسئول: {node.owner}</span><span>تا {node.timeline.end}</span></div>
      </div>
      <div className="program-node-progress"><ProgressIndicator value={node.progress} compact /></div>
      <button className="program-add-child" onClick={(event) => { event.stopPropagation(); onAddChild(); }}>＋ {childLabel}</button>
    </article>
  );
}

function statusTone(status: string): StatusTone {
  if (status === "تکمیل شده") return "success";
  if (status === "مسدود" || status === "لغو شده") return "danger";
  if (status === "در انتظار تأیید" || status === "نیازمند تکمیل" || status === "متوقف شده") return "warning";
  if (status === "در حال اجرا") return "info";
  return "neutral";
}
