import type { Objective } from "../../domain/program";
import { EntityCard } from "./GoalCard";

export function ObjectiveCard(props: { node: Objective; expanded: boolean; onToggle: () => void; onSelect: () => void; onAddChild: () => void }) {
  return <EntityCard {...props} icon="◉" tone="objective" childLabel="فعالیت" />;
}
