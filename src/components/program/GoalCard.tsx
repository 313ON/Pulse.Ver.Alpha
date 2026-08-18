import type { Goal } from "../../domain/program";
import { ProgressIndicator } from "./ProgressIndicator";

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
        <div className="program-node-kicker">{node.status} <span>·</span> اولویت {node.priority}</div>
        <h3>{node.title}</h3>
        <p>{node.description}</p>
        <div className="program-node-meta"><span>مسئول: {node.owner}</span><span>تا {node.timeline.end}</span></div>
      </div>
      <div className="program-node-progress"><ProgressIndicator value={node.progress} compact /></div>
      <button className="program-add-child" onClick={(event) => { event.stopPropagation(); onAddChild(); }}>＋ {childLabel}</button>
    </article>
  );
}
