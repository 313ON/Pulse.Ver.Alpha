import type { Action } from "../../domain/program";
import { EntityCard } from "./GoalCard";

export function ActionCard(props: { node: Action; expanded: boolean; onToggle: () => void; onSelect: () => void; onAddChild: () => void }) {
  return <EntityCard {...props} icon="✓" tone="action" childLabel="شاخص" />;
}
