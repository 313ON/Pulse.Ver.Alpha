"use client";

import { useEffect, useMemo, useState } from "react";
import type { KPI, Program, ProgramNode, ProgramNodeType } from "../../domain/program";
import { ActionCard } from "./ActionCard";
import { ActivityCard } from "./ActivityCard";
import { GoalCard, EntityCard } from "./GoalCard";
import { ObjectiveCard } from "./ObjectiveCard";

const childTypes: Record<Exclude<ProgramNodeType, "kpi">, ProgramNodeType> = {
  program: "goal", goal: "objective", objective: "activity", activity: "action", action: "kpi"
};

function childrenOf(node: ProgramNode): ProgramNode[] {
  if (node.type === "program") return node.goals;
  if (node.type === "goal") return node.objectives;
  if (node.type === "objective") return node.activities;
  if (node.type === "activity") return node.actions;
  if (node.type === "action") return node.kpis;
  return [];
}

function findNode(node: ProgramNode, id: string): ProgramNode | null {
  if (node.id === id) return node;
  for (const child of childrenOf(node)) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function ProgramTree({ program }: { program: Program }) {
  const [tree, setTree] = useState<Program>(program);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([program.id, program.goals[0]?.id]));
  const [selectedId, setSelectedId] = useState(program.id);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const selected = useMemo(() => findNode(tree, selectedId) ?? tree, [tree, selectedId]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTree(program);
    setSelectedId(program.id);
    setExpanded(new Set([program.id, program.goals[0]?.id].filter(Boolean)));
  }, [program]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function addChild(parent: ProgramNode) {
    if (parent.type === "kpi") return;
    setAddingTo(parent.id);
    setExpanded((current) => new Set(current).add(parent.id));
  }

  async function saveChild(event: React.FormEvent) {
    event.preventDefault();
    if (!addingTo || !draftTitle.trim()) return;
    const parent = findNode(tree, addingTo);
    if (!parent || parent.type === "kpi") return;
    setSaving(true);
    setError(null);
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const { token } = await csrfResponse.json() as { token: string };
      const response = await fetch("/api/program/commands", {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrf-token": token },
        body: JSON.stringify({ type: childTypes[parent.type], parentId: parent.id, title: draftTitle.trim() })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "ثبت گره برنامه انجام نشد.");
      setAddingTo(null);
      setDraftTitle("");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "خطای ناشناخته در ثبت گره برنامه.");
    } finally {
      setSaving(false);
    }
  }

  function renderNode(node: ProgramNode, level = 0): React.ReactNode {
    const children = childrenOf(node);
    const isExpanded = expanded.has(node.id);
    const commonProps = { expanded: isExpanded, onToggle: () => toggle(node.id), onSelect: () => setSelectedId(node.id), onAddChild: () => addChild(node) };
    const card = node.type === "program" ? <EntityCard node={node} {...commonProps} icon="✦" tone="program" childLabel="هدف راهبردی" /> : node.type === "goal" ? <GoalCard node={node} {...commonProps} /> : node.type === "objective" ? <ObjectiveCard node={node} {...commonProps} /> : node.type === "activity" ? <ActivityCard node={node} {...commonProps} /> : node.type === "action" ? <ActionCard node={node} {...commonProps} /> : <EntityCard node={node} {...commonProps} icon="◆" tone="kpi" childLabel="نتیجه" />;
    return <div className={`program-tree-branch level-${level}`} key={node.id}>{card}{isExpanded && children.length > 0 && <div className="program-tree-children">{children.map((child) => renderNode(child, level + 1))}</div>}</div>;
  }

  return (
    <div className="strategic-layout">
      <section className="panel program-tree-panel">
        <div className="panel-head"><div><span className="program-panel-kicker">نقشه هم‌راستایی</span><h2>سلسله‌مراتب برنامه</h2></div><span className="tree-count">{countNodes(tree)} گره فعال</span></div>
        <div className="program-tree">{renderNode(tree)}</div>
      </section>
      <aside className="panel program-inspector">
        <span className="program-panel-kicker">نمایش انتخاب‌شده</span>
        <h2>{selected.title}</h2>
        <p>{selected.description}</p>
        <div className="inspector-progress"><ProgressValue value={selected.progress} /></div>
        <dl className="inspector-meta"><div><dt>نوع</dt><dd>{selected.type === "program" ? "برنامه سالانه" : selected.type}</dd></div><div><dt>مسئول</dt><dd>{selected.owner}</dd></div><div><dt>بازه زمانی</dt><dd>{selected.timeline.start} تا {selected.timeline.end}</dd></div><div><dt>وضعیت</dt><dd>{selected.status}</dd></div></dl>
        <div className="alignment-card"><div><span>هسته شناختی</span><b>آماده اتصال</b></div><p>اعتبارسنجی هم‌راستایی و کامل‌بودن این گره در نسخه بعدی فعال می‌شود.</p></div>
        {error && <p role="alert" className="form-error">{error}</p>}
        {addingTo && <form className="program-add-form" onSubmit={saveChild}><label>عنوان {childTypes[(findNode(tree, addingTo) as Exclude<ProgramNode, KPI>).type]} جدید<input autoFocus value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="عنوان را وارد کنید" /></label><div className="form-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? "در حال ثبت…" : "افزودن به درخت"}</button><button className="secondary-button" type="button" onClick={() => setAddingTo(null)} disabled={saving}>انصراف</button></div></form>}
        <button className="primary-button wide" onClick={() => addChild(selected)} disabled={selected.type === "kpi"}>＋ افزودن فرزند به این گره</button>
      </aside>
    </div>
  );
}

function ProgressValue({ value }: { value: number }) {
  return <div className="inspector-progress-value"><strong>{value}٪</strong><div className="program-progress-track"><span style={{ width: `${value}%` }} /></div></div>;
}

function countNodes(node: ProgramNode): number {
  return 1 + childrenOf(node).reduce((total, child) => total + countNodes(child), 0);
}
