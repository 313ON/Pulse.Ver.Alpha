import type { Activity } from "../../domain/program";
import { EntityCard } from "./GoalCard";

export function ActivityCard(props: { node: Activity; expanded: boolean; onToggle: () => void; onSelect: () => void; onAddChild: () => void }) {
  return <EntityCard {...props} icon="▸" tone="activity" childLabel="اقدام" />;
}
