"use client";

import { useEffect, useRef, useState } from "react";
import { PulseShell } from "./PulseShell";
import { MaterializationControl } from "./MaterializationControl";
import type { EvaluationIssue, SpreadsheetEvaluationReport } from "../application/import/spreadsheet/evaluation/contracts";

type ImportStatus = "DRAFT" | "ANALYZING" | "REVIEW_REQUIRED" | "APPROVED" | "REJECTED" | "FAILED";

type ImportRecord = {
  id: string;
  entityType: string;
  source: {
    type: string;
    name: string;
    metadata?: Record<string, unknown>;
  };
  data: Record<string, unknown>;
  rowNumber?: number;
  provenance?: Array<{
    workbookName?: string;
    sheetName: string;
    sheetIndex: number;
    headerRowIndex?: number;
    rowIndex: number;
    sourceRowNumber: number;
    column: string;
    address: string;
    header?: string;
    semanticType?: string;
    rawValue: unknown;
  }>;
};

type ImportJob = {
  id: string;
  source: {
    type: string;
    name: string;
    metadata?: Record<string, unknown>;
  };
  status: ImportStatus;
  records: ImportRecord[];
  validationResult?: {
    errors?: Array<{ code?: string; message?: string; field?: string }>;
    warnings?: Array<{ code?: string; message?: string; field?: string }>;
  };
  evaluationResult?: SpreadsheetEvaluationReport;
  assessmentResult?: {
    governance?: {
      errors?: Array<{ rule: string; entityId: string; message: string; severity?: string }>;
    };
    findings?: Array<{ code?: string; severity?: string; message?: string }>;
  };
  qualityScore?: {
    overallScore?: number;
    dimensions?: Record<string, number>;
    findings?: Array<{ dimension?: string; code?: string; severity?: string; message?: string; entityId?: string }>;
  };
  analysisRevision?: number;
  remediations?: Array<{
    id: string;
    targetEntityId: string;
    proposedOwnerId: string;
    ownerDisplayName: string;
    reason: string;
    resultingAnalysisRevision?: number;
  }>;
  createdAt: string;
  failureReason?: string;
};

type ImportResponse = {
  job?: ImportJob;
  evaluation?: {
    status?: string;
    mappedRecords?: number;
    totalSheets?: number;
    unknownHeaders?: number;
    ambiguousHeaders?: number;
    issueCounts?: Record<string, number>;
  };
  error?: string;
};

type PersonOption = { id: string; full_name: string };

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const statusLabels: Record<ImportStatus, string> = {
  DRAFT: "پیش‌نویس",
  ANALYZING: "در حال تحلیل",
  REVIEW_REQUIRED: "در انتظار بازبینی",
  APPROVED: "تأیید شده",
  REJECTED: "رد شده",
  FAILED: "ناموفق"
};

const semanticLabels: Record<string, string> = {
  goal: "هدف کلان",
  objective: "هدف جزئی",
  activity: "فعالیت",
  action: "اقدام",
  kpi: "شاخص",
  kpiTarget: "هدف شاخص",
  kpiValue: "مقدار شاخص",
  kpiUnit: "واحد شاخص",
  owner: "مالک",
  executor: "مجری / مسئول اجرا",
  collaborator: "همکار",
  unit: "واحد",
  person: "شخص",
  startDate: "شروع",
  endDate: "پایان",
  duration: "مدت",
  workingDays: "روز کاری",
  personHours: "نفرساعت",
  progress: "پیشرفت"
};

const semanticTypeLabels: Record<string, string> = {
  GOAL: "هدف کلان",
  OBJECTIVE: "هدف جزئی",
  ACTIVITY: "فعالیت",
  ACTION: "اقدام",
  KPI: "شاخص",
  KPI_TARGET: "هدف شاخص",
  KPI_VALUE: "مقدار شاخص",
  KPI_UNIT: "واحد شاخص",
  OWNER: "مالک",
  EXECUTOR: "مجری / مسئول اجرا",
  COLLABORATOR: "همکار",
  UNIT: "واحد",
  PERSON: "شخص",
  START_DATE: "شروع",
  END_DATE: "پایان",
  DURATION: "مدت",
  WORKING_DAYS: "روز کاری",
  PERSON_HOURS: "نفرساعت",
  PROGRESS: "پیشرفت"
};
const semanticTypeKeys: Record<string, string> = {
  GOAL: "goal",
  OBJECTIVE: "objective",
  ACTIVITY: "activity",
  ACTION: "action",
  KPI: "kpi",
  KPI_TARGET: "kpiTarget",
  KPI_VALUE: "kpiValue",
  KPI_UNIT: "kpiUnit",
  OWNER: "owner",
  EXECUTOR: "executor",
  COLLABORATOR: "collaborator",
  UNIT: "unit",
  PERSON: "person",
  START_DATE: "startDate",
  END_DATE: "endDate",
  DURATION: "duration",
  WORKING_DAYS: "workingDays",
  PERSON_HOURS: "personHours",
  PROGRESS: "progress"
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

export function isValidXlsxFile(file: Pick<File, "name" | "size" | "type">): boolean {
  return file.size > 0
    && file.size <= MAX_UPLOAD_BYTES
    && /\.xlsx$/i.test(file.name)
    && (!file.type || file.type === XLSX_MIME);
}

export function importStatusLabel(status: ImportStatus): string {
  return statusLabels[status];
}

function statusTone(status: ImportStatus): string {
  if (status === "REVIEW_REQUIRED") return "yellow";
  if (status === "APPROVED") return "green";
  if (status === "FAILED" || status === "REJECTED") return "red";
  return "gray";
}

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return value.join("، ");
  return String(value);
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function sourceMetadata(job: ImportJob) {
  return job.source.metadata ?? {};
}

function errorMessages(job: ImportJob): string[] {
  return [
    ...(job.validationResult?.errors ?? []),
    ...(job.assessmentResult?.findings ?? []),
    ...(job.qualityScore?.findings ?? [])
  ].map((item) => item.message).filter((message): message is string => Boolean(message));
}

type ReviewEvaluationFinding = EvaluationIssue & {
  record?: ImportRecord;
};

function evaluationFindings(job: ImportJob): ReviewEvaluationFinding[] {
  const recordsById = new Map(job.records.map((record) => [record.id, record]));
  return (job.evaluationResult?.sheets ?? []).flatMap((sheet) =>
    sheet.rows.flatMap((row) =>
      row.issues.map((issue) => ({
        ...issue,
        record: issue.recordId ? recordsById.get(issue.recordId) : undefined
      }))
    )
  );
}

type ReviewSheetFinding = EvaluationIssue & {
  sheetName: string;
  sheetIndex: number;
  sheetProvenance: SpreadsheetEvaluationReport["sheets"][number]["provenance"];
};

function sheetEvaluationFindings(job: ImportJob): ReviewSheetFinding[] {
  return (job.evaluationResult?.sheets ?? []).flatMap((sheet) =>
    sheet.checks
      .filter((check) => check.name === "header-detection")
      .flatMap((check) => check.issues.map((issue) => ({
        ...issue,
        sheetName: sheet.provenance.sheetName,
        sheetIndex: sheet.provenance.sheetIndex,
        sheetProvenance: sheet.provenance
      })))
  );
}

function evaluationProvenanceText(provenance: EvaluationIssue["provenance"]): string | undefined {
  if (!provenance) return undefined;
  const parts = [`Workbook: ${provenance.workbookName}`, `Sheet: ${provenance.sheetName}`];
  if ("sourceRowNumber" in provenance) parts.push(`Row: ${provenance.sourceRowNumber}`);
  if ("address" in provenance) parts.push(`Cell: ${provenance.address}`);
  return parts.join(" · ");
}

function evaluationCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    INHERITANCE_FAILURE: "شکست وراثت سلسله‌مراتب",
    INVALID_HIERARCHY: "سلسله‌مراتب نامعتبر",
    MISSING_VALUE: "مقدار مفقود",
    SOURCE_TRACE_FAILURE: "خطای ردیابی منبع",
    UNSUPPORTED_STRUCTURE: "ساختار پشتیبانی‌نشده",
    UNKNOWN_HEADER: "سربرگ ناشناخته",
    AMBIGUOUS_HEADER: "سربرگ مبهم",
    UNRESOLVED_ASSIGNMENT: "تخصیص حل‌نشده"
  };
  return labels[category] ?? category;
}

const assignmentKeys = new Set(["unit", "owner", "executor", "collaborator", "person"]);

function assignmentState(key: string, _value: unknown): string | undefined {
  if (!assignmentKeys.has(key)) return undefined;
  return `مقدار متنی · هویت سازمانی: حل‌نشده`;
}

function semanticTypeForKey(key: string, record: ImportRecord): string {
  const cell = record.provenance?.find((candidate) => semanticTypeKeys[candidate.semanticType ?? ""] === key);
  return cell ? semanticTypeLabels[cell.semanticType ?? ""] : (semanticLabels[key] ?? key);
}

function provenanceForKey(key: string, record: ImportRecord) {
  return record.provenance?.find((cell) => semanticTypeKeys[cell.semanticType ?? ""] === key);
}

export function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [remediationBusy, setRemediationBusy] = useState(false);
  const [people, setPeople] = useState<PersonOption[]>([]);

  async function loadJobs() {
    const response = await fetch("/api/imports");
    const body = await response.json() as ImportJob[] | ImportResponse;
    if (!response.ok) throw new Error("error" in body ? body.error : "دریافت وضعیت ورود اطلاعات ممکن نشد.");
    setJobs(Array.isArray(body) ? body : []);
  }

  async function loadJob(id: string) {
    const response = await fetch(`/api/imports/${encodeURIComponent(id)}`);
    const body = await response.json() as ImportJob | ImportResponse;
    if (!response.ok) throw new Error("error" in body ? body.error : "جزئیات کار ورود اطلاعات دریافت نشد.");
    if (!body || typeof body !== "object" || !("status" in body) || !("records" in body)) {
      throw new Error("پاسخ جزئیات بازبینی قابل استفاده نیست.");
    }
    const job = body as ImportJob;
    setSelectedJob(job);
    setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
    const remediationResponse = await fetch(`/api/imports/${encodeURIComponent(id)}/remediations`);
    if (remediationResponse.ok) {
      const remediationBody = await remediationResponse.json() as { people?: PersonOption[] };
      setPeople(remediationBody.people ?? []);
    }
  }

  useEffect(() => {
    void loadJobs().catch(() => undefined);
  }, []);

  function chooseFile(file: File | undefined) {
    setError("");
    setMessage("");
    if (!file) return;
    if (!isValidXlsxFile(file)) {
      setSelectedFile(null);
      setError("فقط فایل XLSX معتبر با اندازه حداکثر ۵ مگابایت پذیرفته می‌شود.");
      return;
    }
    setSelectedFile(file);
  }

  async function upload() {
    if (!selectedFile || busy) return;
    setBusy(true);
    setError("");
    setMessage("در حال ارسال و تحلیل فایل...");
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const csrf = await csrfResponse.json() as { token?: string };
      if (!csrfResponse.ok || !csrf.token) throw new Error("توکن امنیتی دریافت نشد.");
      const form = new FormData();
      form.append("file", selectedFile);
      const response = await fetch("/api/imports", {
        method: "POST",
        headers: { "x-csrf-token": csrf.token },
        body: form
      });
      const body = await response.json() as ImportResponse;
      if (!response.ok || !body.job || !Array.isArray(body.job.records) || !body.job.status) {
        throw new Error(body.error ?? "پاسخ تحلیل فایل قابل استفاده نیست.");
      }
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setSelectedJob(body.job);
      setJobs((current) => [body.job!, ...current.filter((item) => item.id !== body.job!.id)]);
      const remediationResponse = await fetch(`/api/imports/${encodeURIComponent(body.job.id)}/remediations`);
      if (remediationResponse.ok) {
        const remediationBody = await remediationResponse.json() as { people?: PersonOption[] };
        setPeople(remediationBody.people ?? []);
      }
      setMessage(body.job.status === "REVIEW_REQUIRED"
        ? "فایل با موفقیت تحلیل شد و برای بازبینی آماده است."
        : "فایل دریافت شد.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "خطای غیرمنتظره در ورود فایل.");
      setMessage("");
    } finally {
      setBusy(false);
    }
  }

  function resetSelection() {
    setSelectedJob(null);
    setSelectedFile(null);
    setMessage("");
    setError("");
    setPeople([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function remediateGoalOwner(input: {
    targetGoalId: string;
    expectedOldOwner?: string;
    expectedAnalysisRevision: number;
    proposedOwnerPersonId: string;
    reason: string;
  }) {
    if (!selectedJob || remediationBusy) return;
    setRemediationBusy(true);
    setError("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const csrf = await csrfResponse.json() as { token?: string };
      if (!csrfResponse.ok || !csrf.token) throw new Error("توکن امنیتی دریافت نشد.");
      const response = await fetch(`/api/imports/${encodeURIComponent(selectedJob.id)}/remediations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify({ rule: "goal.owner.required", ...input })
      });
      const body = await response.json() as ImportJob | ImportResponse;
      if (!response.ok || !("status" in body)) throw new Error("error" in body ? body.error : "رفع یافته حاکمیتی ناموفق بود.");
      const job = body as ImportJob;
      setSelectedJob(job);
      setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      setMessage("مالک هدف برای همین ورود اطلاعات ثبت و تحلیل مجدد شد.");
    } catch (remediationError) {
      setError(remediationError instanceof Error ? remediationError.message : "رفع یافته حاکمیتی ناموفق بود.");
    } finally {
      setRemediationBusy(false);
    }
  }

  async function decide(action: "approve" | "reject") {
    if (!selectedJob || decisionBusy) return;
    setDecisionBusy(true);
    setError("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf");
      const csrf = await csrfResponse.json() as { token?: string };
      if (!csrfResponse.ok || !csrf.token) throw new Error("توکن امنیتی دریافت نشد.");
      const response = await fetch("/api/imports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify({ id: selectedJob.id, action, expectedAnalysisRevision: selectedJob.analysisRevision })
      });
      const body = await response.json() as ImportJob | ImportResponse;
      if (!response.ok || !("status" in body)) throw new Error("error" in body ? body.error : "تغییر وضعیت بازبینی ناموفق بود.");
      setSelectedJob(body as ImportJob);
      setJobs((current) => [(body as ImportJob), ...current.filter((item) => item.id !== selectedJob.id)]);
      setMessage(action === "approve" ? "درخواست تأیید به حاکمیت ارسال شد." : "ورود اطلاعات رد شد.");
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "تغییر وضعیت بازبینی ناموفق بود.");
    } finally {
      setDecisionBusy(false);
    }
  }

  return (
    <PulseShell>
      <div className="page import-page">
        <div className="page-heading">
          <div>
            <div className="eyebrow">مرکز فرمان ورود اطلاعات</div>
            <h1>وارد کردن برنامه</h1>
            <p>فایل XLSX را تحلیل کنید و پیش از هر تصمیم حاکمیتی، داده‌ها را بازبینی کنید.</p>
          </div>
          {selectedJob && <button className="secondary-button" type="button" onClick={resetSelection}>ورود جدید</button>}
        </div>

        {!selectedJob && (
          <section className="panel import-upload-panel" aria-labelledby="import-upload-title">
            <div className="panel-head">
              <div>
                <span className="program-panel-kicker">XLSX / EXCEL</span>
                <h2 id="import-upload-title">تحلیل فایل</h2>
              </div>
              <span className={`status-pill ${busy ? "yellow" : "green"}`}>{busy ? "در حال پردازش" : "آماده دریافت"}</span>
            </div>
            <div
              className={`import-dropzone${dragging ? " is-dragging" : ""}`}
              onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => { event.preventDefault(); setDragging(false); }}
              onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }}
              role="group"
              aria-labelledby="import-file-label"
            >
              <input
                ref={inputRef}
                id="import-file-input"
                className="import-file-input"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => chooseFile(event.target.files?.[0])}
                aria-describedby="import-file-help"
              />
              <span className="import-dropzone-icon" aria-hidden="true">⇩</span>
              <label id="import-file-label" htmlFor="import-file-input"><strong>فایل برنامه را اینجا رها کنید</strong><span>یا برای انتخاب از رایانه کلیک کنید</span></label>
              <small id="import-file-help">فقط XLSX · حداکثر ۵ مگابایت</small>
            </div>
            {selectedFile && (
              <div className="import-file-summary" aria-live="polite">
                <div><strong>{selectedFile.name}</strong><span>{formatBytes(selectedFile.size)}</span></div>
                <button type="button" className="icon-button" aria-label="حذف فایل انتخاب‌شده" onClick={(event) => { event.stopPropagation(); setSelectedFile(null); if (inputRef.current) inputRef.current.value = ""; }}>×</button>
              </div>
            )}
            {message && <div className="import-message success" role="status" aria-live="polite">{message}</div>}
            {error && <div className="import-message error" role="alert">{error}</div>}
            <div className="form-actions import-upload-actions">
              <button className="primary-button" type="button" disabled={!selectedFile || busy} onClick={() => void upload()}>
                {busy ? "در حال تحلیل..." : "ارسال و تحلیل فایل"}
              </button>
            </div>
          </section>
        )}

        {selectedJob ? (
          <>
            <ImportReview
              job={selectedJob}
              people={people}
              onDecision={(action) => void decide(action)}
              onRemediateGoalOwner={(input) => void remediateGoalOwner(input)}
              decisionBusy={decisionBusy}
              remediationBusy={remediationBusy}
            />
            {message && <div className="import-message success" role="status" aria-live="polite">{message}</div>}
            {error && <div className="import-message error" role="alert">{error}</div>}
          </>
        ) : (
          <RecentImports jobs={jobs} onOpen={(id) => void loadJob(id).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "دریافت بازبینی ناموفق بود."))} />
        )}
      </div>
    </PulseShell>
  );
}

function RecentImports({ jobs, onOpen }: { jobs: ImportJob[]; onOpen: (id: string) => void }) {
  return (
    <section className="panel import-history-panel" aria-labelledby="import-history-title">
      <div className="panel-head"><h2 id="import-history-title">ورودهای اخیر</h2><span>{jobs.length} کار</span></div>
      {jobs.length === 0 ? <div className="empty">هنوز فایلی برای بازبینی ثبت نشده است.</div> : (
        <div className="import-job-list">
          {jobs.map((job) => (
            <button className="import-job-row" type="button" key={job.id} onClick={() => onOpen(job.id)}>
              <span className="import-job-file"><strong>{job.source.name}</strong><small>{formatDate(job.createdAt)}</small></span>
              <span className={`status-pill ${statusTone(job.status)}`}>{importStatusLabel(job.status)}</span>
              <span className="import-job-count">{job.records.length} رکورد</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function ImportReview({
  job,
  people = [],
  onDecision,
  onRemediateGoalOwner,
  decisionBusy = false,
  remediationBusy = false
}: {
  job: ImportJob;
  people?: PersonOption[];
  onDecision?: (action: "approve" | "reject") => void;
  onRemediateGoalOwner?: (input: {
    targetGoalId: string;
    expectedOldOwner?: string;
    expectedAnalysisRevision: number;
    proposedOwnerPersonId: string;
    reason: string;
  }) => void;
  decisionBusy?: boolean;
  remediationBusy?: boolean;
}) {
  const metadata = sourceMetadata(job);
  const warnings = errorMessages(job);
  const sheets = [...new Set(job.records.map((record) => String(record.source.metadata?.sheetName ?? "—")))];
  const score = job.qualityScore?.overallScore;

  return (
    <div className="import-review-stack">
      <section className="panel import-review-hero" aria-labelledby="import-review-title">
        <div>
          <span className="program-panel-kicker">بازبینی داده‌ها</span>
          <h2 id="import-review-title">{job.source.name}</h2>
          <p>این داده‌ها هنوز به‌عنوان اطلاعات canonical ثبت نشده‌اند.</p>
        </div>
        <span className={`status-pill ${statusTone(job.status)}`}>{importStatusLabel(job.status)}</span>
      </section>

      <section className="import-review-summary" aria-label="خلاصه تحلیل فایل">
        <div className="import-summary-card"><span>رکوردهای استخراج‌شده</span><strong>{job.records.length}</strong></div>
        <div className="import-summary-card"><span>برگه‌ها</span><strong>{sheets.length}</strong></div>
        <div className="import-summary-card"><span>امتیاز کیفیت</span><strong>{score === undefined ? "—" : score}</strong></div>
        <div className="import-summary-card"><span>سال برنامه</span><strong>{displayValue(metadata.planYear)}</strong></div>
      </section>

      <section className="panel import-provenance-panel" aria-labelledby="import-provenance-title">
        <div className="panel-head"><h2 id="import-provenance-title">منبع و ردیابی</h2><span>ردیابی منبع</span></div>
        <div className="import-provenance-grid">
          <div><span>فایل</span><strong>{job.source.name}</strong></div>
          <div><span>برگه‌ها</span><strong>{sheets.join("، ") || "—"}</strong></div>
          <div><span>ردیف‌های منبع</span><strong>{job.records.length ? `${job.records[0].provenance?.[0]?.sourceRowNumber ?? "—"} تا ${job.records[job.records.length - 1].provenance?.[0]?.sourceRowNumber ?? "—"}` : "—"}</strong></div>
          <div><span>سلول‌های ثبت‌شده</span><strong>{job.records.reduce((count, record) => count + (record.provenance?.length ?? 0), 0) || "—"}</strong></div>
        </div>
        <small className="import-provenance-note">ردیابی ثبت‌شده: Workbook → Sheet → Row → Column → Cell</small>
      </section>

      {warnings.length > 0 && (
        <section className="panel import-warning-panel" aria-labelledby="import-warning-title">
          <div className="panel-head"><h2 id="import-warning-title">هشدارها و یافته‌های حاکمیتی</h2><span>{warnings.length} مورد</span></div>
          <ul>{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
        </section>
      )}

      <SheetEvaluationFindings findings={sheetEvaluationFindings(job)} />

      <EvaluationFindings findings={evaluationFindings(job)} />

      <GovernanceFindings
        job={job}
        people={people}
        onRemediateGoalOwner={onRemediateGoalOwner}
        remediationBusy={remediationBusy}
      />

      <MaterializationControl importJobId={job.id} status={job.status} />

      <section className="panel import-records-panel" aria-labelledby="import-records-title">
        <div className="panel-head"><h2 id="import-records-title">داده‌های استخراج‌شده</h2><span>نمایش فقط برای بازبینی انسانی</span></div>
        {job.records.length === 0 ? <div className="empty">رکورد قابل نمایش وجود ندارد.</div> : (
          <div className="import-record-list">
            {job.records.map((record) => <ImportRecordCard key={record.id} record={record} />)}
          </div>
        )}
      </section>

      <div className="import-review-boundary" role="status">
        <div><strong>وضعیت بازبینی: {importStatusLabel(job.status)}</strong><span>تأیید نهایی همچنان با حاکمیت سمت سرور انجام می‌شود.</span></div>
        {onDecision && job.status === "REVIEW_REQUIRED" && (
          <div className="import-review-actions">
            <button className="secondary-button" type="button" disabled={decisionBusy} onClick={() => onDecision("reject")}>رد ورود</button>
            <button className="primary-button" type="button" disabled={decisionBusy} onClick={() => onDecision("approve")}>{decisionBusy ? "در حال بررسی..." : "تأیید ورود"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function GovernanceFindings({
  job,
  people,
  onRemediateGoalOwner,
  remediationBusy
}: {
  job: ImportJob;
  people: PersonOption[];
  onRemediateGoalOwner?: (input: {
    targetGoalId: string;
    expectedOldOwner?: string;
    expectedAnalysisRevision: number;
    proposedOwnerPersonId: string;
    reason: string;
  }) => void;
  remediationBusy: boolean;
}) {
  const findings = job.assessmentResult?.governance?.errors ?? [];
  if (findings.length === 0) return null;
  return (
    <section className="panel import-governance-findings-panel" aria-labelledby="import-governance-findings-title">
      <div className="panel-head">
        <div><h2 id="import-governance-findings-title">یافته‌های حاکمیتی</h2><small>رفع هر یافته فقط با تحلیل مجدد ممکن است.</small></div>
        <span>{findings.length} مورد</span>
      </div>
      <div className="import-evaluation-findings-list">
        {findings.map((finding, index) => (
          <GoalOwnerRemediation
            key={`${finding.rule}-${finding.entityId}-${index}`}
            finding={finding}
            job={job}
            people={people}
            onRemediate={onRemediateGoalOwner}
            busy={remediationBusy}
          />
        ))}
      </div>
    </section>
  );
}

function GoalOwnerRemediation({
  finding,
  job,
  people,
  onRemediate,
  busy
}: {
  finding: { rule: string; entityId: string; message: string };
  job: ImportJob;
  people: PersonOption[];
  onRemediate?: (input: {
    targetGoalId: string;
    expectedOldOwner?: string;
    expectedAnalysisRevision: number;
    proposedOwnerPersonId: string;
    reason: string;
  }) => void;
  busy: boolean;
}) {
  const [personId, setPersonId] = useState("");
  const [reason, setReason] = useState("");
  const record = job.records.find((candidate) => candidate.data.goal === finding.entityId);
  if (finding.rule !== "goal.owner.required" || !onRemediate) {
    return <article className="import-evaluation-finding"><strong>{finding.rule}</strong><p>{finding.message}</p></article>;
  }
  return (
    <article className="import-evaluation-finding">
      <div className="import-evaluation-finding-head">
        <strong>{finding.entityId}: مالک هدف الزامی است</strong>
        <span>{job.source.name} · {String(record?.source.metadata?.sheetName ?? "—")} · ردیف {record?.rowNumber ?? "—"}</span>
      </div>
      <div className="import-evaluation-finding-body">
        <div><span>یافته</span><strong>{finding.rule}</strong></div>
        <div><span>وضعیت فعلی</span><strong>مالک مؤثر ثبت نشده است.</strong></div>
        <div><span>پیام</span><strong>{finding.message}</strong></div>
        <div><span>منبع</span><strong>{record?.provenance?.map((cell) => `${cell.address}: ${displayValue(cell.rawValue)}`).join(" · ") ?? "—"}</strong></div>
        <label>
          <span>مالک جدید</span>
          <select value={personId} onChange={(event) => setPersonId(event.target.value)} disabled={busy} required>
            <option value="">انتخاب شخص فعال</option>
            {people.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
          </select>
        </label>
        <label>
          <span>دلیل اصلاح</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} required />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={busy || !personId || !reason.trim()}
          onClick={() => onRemediate({
            targetGoalId: finding.entityId,
            expectedOldOwner: "",
            expectedAnalysisRevision: job.analysisRevision ?? 0,
            proposedOwnerPersonId: personId,
            reason
          })}
        >
          {busy ? "در حال تحلیل مجدد..." : "ثبت مالک و تحلیل مجدد"}
        </button>
      </div>
    </article>
  );
}

function SheetEvaluationFindings({ findings }: { findings: ReviewSheetFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <section className="panel import-sheet-findings-panel" aria-labelledby="import-sheet-findings-title">
      <div className="panel-head">
        <div>
          <h2 id="import-sheet-findings-title">یافته‌های سطح برگه</h2>
          <small>یافته‌های ساختاری و سربرگ فایل</small>
        </div>
        <span>{findings.length} مورد</span>
      </div>
      <div className="import-evaluation-findings-list">
        {findings.map((finding, index) => (
          <article className="import-evaluation-finding" key={`${finding.sheetIndex}-${finding.category}-${index}`}>
            <div className="import-evaluation-finding-head">
              <strong>{evaluationCategoryLabel(finding.category)}</strong>
              <span>{finding.sheetProvenance.workbookName} · {finding.sheetName}</span>
            </div>
            <div className="import-evaluation-finding-body">
              <div><span>دسته</span><strong>{evaluationCategoryLabel(finding.category)}</strong></div>
              <div><span>پیام ارزیابی</span><strong>{finding.message}</strong></div>
              <div><span>منبع</span><strong>{evaluationProvenanceText(finding.provenance) ?? `${finding.sheetProvenance.workbookName} · ${finding.sheetName}`}</strong></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EvaluationFindings({ findings }: { findings: ReviewEvaluationFinding[] }) {
  if (findings.length === 0) return null;
  return (
    <section className="panel import-evaluation-findings-panel" aria-labelledby="import-evaluation-findings-title">
      <div className="panel-head">
        <div>
          <h2 id="import-evaluation-findings-title">یافته‌های سلسله‌مراتبی</h2>
          <small>یافته‌های ارزیابی فایل برای تصمیم بازبینی</small>
        </div>
        <span>{findings.length} مورد</span>
      </div>
      <div className="import-evaluation-findings-intro">
        این موارد خطای خواندن XLSX نیستند؛ ساختار منبع با سلسله‌مراتب canonical سامانه تطابق کامل ندارد.
      </div>
      <div className="import-evaluation-findings-list">
        {findings.map((finding, index) => {
          const record = finding.record;
          const missingActivity = finding.category === "INHERITANCE_FAILURE"
            && record?.entityType === "action"
            && !Object.prototype.hasOwnProperty.call(record.data, "activity");
          const rowNumber = finding.provenance && "sourceRowNumber" in finding.provenance
            ? finding.provenance.sourceRowNumber
            : record?.rowNumber;
          const source = record?.provenance?.filter((cell) =>
            ["GOAL", "OBJECTIVE", "ACTIVITY", "ACTION"].includes(cell.semanticType ?? "")
          ) ?? [];
          return (
            <article className="import-evaluation-finding" key={`${finding.recordId ?? "finding"}-${index}`}>
              <div className="import-evaluation-finding-head">
                <strong>{missingActivity ? "فعالیت مفقود است" : evaluationCategoryLabel(finding.category)}</strong>
                <span>ردیف منبع: {rowNumber ?? "—"}</span>
              </div>
              <div className="import-evaluation-finding-body">
                <div><span>دسته</span><strong>{evaluationCategoryLabel(finding.category)}</strong></div>
                <div><span>پیام ارزیابی</span><strong>{missingActivity ? "در این ردیف، Activity وجود ندارد." : finding.message}</strong></div>
                {missingActivity && (
                  <>
                    <div><span>ساختار منبع</span><strong>هدف جزئی → اقدام</strong></div>
                    <div><span>ساختار canonical مورد انتظار</span><strong>هدف جزئی → فعالیت → اقدام</strong></div>
                    <div><span>توضیح</span><strong>این یک یافته ساختار منبع/بازسازی است، نه خطای parser فایل XLSX.</strong></div>
                  </>
                )}
                {record && <div><span>مقادیر مرتبط</span><strong>{displayValue(record.data.objective)}{record.data.action ? ` → ${displayValue(record.data.action)}` : ""}</strong></div>}
                <div><span>ردیابی</span><strong>{String(record?.source.metadata?.sheetName ?? "—")} · ردیف {rowNumber ?? "—"}</strong></div>
                {source.length > 0 && (
                  <div><span>سلول‌های مرتبط</span><strong>{source.map((cell) => `${cell.address}: ${displayValue(cell.rawValue)}`).join(" · ")}</strong></div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ImportRecordCard({ record }: { record: ImportRecord }) {
  const values = Object.entries(record.data).filter(([, value]) => value !== undefined && value !== null && value !== "");
  return (
    <article className="import-record-card">
      <div className="import-record-head">
        <div><span>{record.entityType}</span><strong>{displayValue(record.data.action ?? record.data.activity ?? record.data.objective ?? record.data.goal)}</strong></div>
        <small>برگه: {String(record.source.metadata?.sheetName ?? "—")} · ردیف: {record.rowNumber ?? "—"}</small>
      </div>
      <div className="import-field-grid">
        {values.map(([key, value]) => (
          <div className="import-field" key={key}>
            <span>{semanticLabels[key] ?? key}</span>
            <strong>خام: {displayValue(provenanceForKey(key, record)?.rawValue ?? value)}</strong>
            <small>نوع معنایی: {semanticTypeForKey(key, record)}</small>
            <small>مقدار نرمال‌شده: {displayValue(value)}</small>
            {assignmentState(key, value) && <small>{assignmentState(key, value)}</small>}
            <details>
              <summary>جزئیات فنی</summary>
              <small>منبع: {provenanceForKey(key, record)?.address ?? "—"}</small>
            </details>
          </div>
        ))}
      </div>
    </article>
  );
}
