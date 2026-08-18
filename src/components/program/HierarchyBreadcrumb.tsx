import type { ProgramNode } from "../../domain/program";

export function HierarchyBreadcrumb({ nodes }: { nodes: ProgramNode[] }) {
  return (
    <nav className="hierarchy-breadcrumb" aria-label="مسیر سلسله‌مراتب">
      {nodes.map((node, index) => (
        <span key={node.id}>
          {node.title}
          {index < nodes.length - 1 && <i>‹</i>}
        </span>
      ))}
    </nav>
  );
}
