"use client";

import { useEffect, useRef, useState } from "react";
import { PulseShell } from "./PulseShell";

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
    sheetName: string;
    sheetIndex: number;
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
  assessmentResult?: {
    findings?: Array<{ code?: string; severity?: string; message?: string }>;
  };
  qualityScore?: {
    overallScore?: number;
    findings?: Array<{ code?: string; severity?: string; message?: string }>;
  };
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
    if (inputRef.current) inputRef.current.value = "";
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
        body: JSON.stringify({ id: selectedJob.id, action })
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
            <ImportReview job={selectedJob} onDecision={(action) => void decide(action)} decisionBusy={decisionBusy} />
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
  onDecision,
  decisionBusy = false
}: {
  job: ImportJob;
  onDecision?: (action: "approve" | "reject") => void;
  decisionBusy?: boolean;
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
          <div className="panel-head"><h2 id="import-warning-title">هشدارها و یافته‌ها</h2><span>{warnings.length} مورد</span></div>
          <ul>{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>
        </section>
      )}

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
