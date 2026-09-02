"use client";

import { useEffect, useState } from "react";
import type { MaterializationReadiness } from "../application/materialization/service";
import type { MaterializationOperation } from "../application/materialization/persistence";

type AuditEvent = { id: string; actorUserId?: string; eventType: string; createdAt: string };

export function materializationStatusLabel(status: MaterializationOperation["status"]): string {
  return ({
    REQUESTED: "درخواست شده", VALIDATING: "در حال اعتبارسنجی", READY: "آماده اجرا",
    EXECUTING: "در حال اجرا", COMPLETED: "تکمیل شده", REJECTED: "رد شده", FAILED: "ناموفق"
  } as Record<MaterializationOperation["status"], string>)[status];
}

export function canRetryMaterialization(operation: Pick<MaterializationOperation, "status"> | undefined): boolean {
  return operation?.status === "FAILED";
}

export function MaterializationControl({ importJobId, sourceName, status }: { importJobId: string; sourceName: string; status: string }) {
  const [readiness, setReadiness] = useState<MaterializationReadiness | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [readinessResponse, auditResponse] = await Promise.all([
      fetch(`/api/imports/${encodeURIComponent(importJobId)}/materialization-readiness`),
      fetch(`/api/imports/${encodeURIComponent(importJobId)}/materialization-audit`)
    ]);
    const body = await readinessResponse.json() as MaterializationReadiness & { error?: string };
    if (!readinessResponse.ok) throw new Error(body.error ?? "دریافت آمادگی materialization ممکن نشد.");
    setReadiness(body);
    if (auditResponse.ok) setAudit(await auditResponse.json() as AuditEvent[]);
  }

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : "دریافت وضعیت materialization ناموفق بود."));
  }, [importJobId]);

  async function materialize(operationId?: string) {
    if (!readiness?.plan || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const csrf = await fetch("/api/auth/csrf").then((response) => response.json() as Promise<{ token?: string }>);
      if (!csrf.token) throw new Error("توکن امنیتی دریافت نشد.");
      const response = await fetch(operationId
        ? `/api/materializations/${encodeURIComponent(operationId)}/retry`
        : `/api/imports/${encodeURIComponent(importJobId)}/materializations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify({
          importJobId,
          approvedAnalysisRevision: readiness.plan.approvedAnalysisRevision,
          sourceSnapshotHash: readiness.plan.sourceSnapshot.sourceSnapshotHash,
          targetPlanYear: readiness.plan.planYear,
          plan: readiness.plan
        })
      });
      const body = await response.json() as { operation?: MaterializationOperation; error?: string };
      if (!response.ok || !body.operation) throw new Error(body.error ?? "درخواست materialization ناموفق بود.");
      setMessage(`${operationId ? "بازتلاش" : "عملیات"} ${body.operation.operationId} با وضعیت ${materializationStatusLabel(body.operation.status)} ثبت شد.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "اجرای materialization ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "APPROVED") return null;
  const operation = readiness?.operations.at(-1);
  return (
    <section className="panel materialization-control" aria-labelledby="materialization-control-title">
      <div className="panel-head">
        <div><span className="program-panel-kicker">DEPARTMENTAL / SUPPORTING</span><h2 id="materialization-control-title">نتیجه materialization واحدی</h2><small>این داده‌ها مشتق‌شده‌اند و بخشی از سلسله‌مراتب راهبردی canonical نیستند.</small></div>
        <span className={`status-pill ${readiness?.status === "READY" ? "green" : "yellow"}`}>
          {readiness ? (readiness.status === "READY" ? "آماده بررسی" : "مسدود") : "در حال بررسی"}
        </span>
      </div>
      <div className="materialization-identity-grid">
        <div><span>دفترکار منبع</span><strong>{sourceName}</strong></div>
        <div><span>شناسه ورود صریح</span><strong>{importJobId}</strong></div>
        <div><span>revision تأییدشده</span><strong>{readiness?.snapshot?.approvedAnalysisRevision ?? "—"}</strong></div>
        <div><span>snapshot منبع</span><strong className="technical-value">{readiness?.snapshot?.sourceSnapshotHash ?? "—"}</strong></div>
        <div><span>رکوردهای pinned</span><strong>{readiness?.snapshot?.sourceRecordCount ?? "—"}</strong></div>
      </div>
      {readiness?.blockers.length ? (
        <div className="materialization-blockers" role="alert"><strong>موانع اجرا</strong><ul>{readiness.blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}>{blocker.message}</li>)}</ul></div>
      ) : <div className="materialization-ready-note">آمادگی از روی import مشخص‌شده ارزیابی شده است؛ هیچ import دیگری انتخاب نمی‌شود.</div>}
      {operation && (
        <div className="materialization-operation">
          <div><span>آخرین عملیات</span><strong>{operation.operationId}</strong></div>
          <div><span>وضعیت</span><strong>{materializationStatusLabel(operation.status)}</strong></div>
          <div><span>نتیجه</span><strong>{operation.counts.goals} هدف · {operation.counts.objectives} هدف جزئی · {operation.counts.activities} فعالیت · {operation.counts.workItems} اقدام</strong></div>
          <div><span>وضعیت تکرار</span><strong>{readiness?.operations.length && readiness.operations.length > 1 ? `${readiness.operations.length} عملیات برای همین ورود` : "اولین عملیات ثبت‌شده برای این ورود"}</strong></div>
          {operation.failureReason && <div className="materialization-error"><span>خطا</span><strong>{operation.failureReason}</strong></div>}
        </div>
      )}
      {audit.length > 0 && <details className="materialization-audit"><summary>مشاهده audit ({audit.length} رویداد)</summary>{audit.map((event) => <div key={event.id}><span>{event.eventType}</span><small>{event.actorUserId ?? "—"} · {event.createdAt}</small></div>)}</details>}
      {message && <div className="import-message success" role="status">{message}</div>}
      {error && <div className="import-message error" role="alert">{error}</div>}
      <div className="form-actions">
        <button className="primary-button" type="button" disabled={busy || readiness?.status !== "READY"} onClick={() => void materialize()}>{busy ? "در حال materialize..." : "درخواست و اجرای صریح"}</button>
        {operation && canRetryMaterialization(operation) && <button className="secondary-button" type="button" disabled={busy || readiness?.status !== "READY"} onClick={() => void materialize(operation.operationId)}>بازتلاش مجاز</button>}
      </div>
    </section>
  );
}
