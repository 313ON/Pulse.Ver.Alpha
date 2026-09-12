export type ExecutionState<T> =
  | { kind: "loading" }
  | { kind: "populated"; actions: T[]; activities: T[] }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function classifyExecutionState<T>(actions: T[] | null, activities: T[] | null, error = ""): ExecutionState<T> {
  if (error) return { kind: "error", message: error };
  if (!actions || !activities) return { kind: "loading" };
  return actions.length === 0 && activities.length === 0
    ? { kind: "empty" }
    : { kind: "populated", actions, activities };
}
