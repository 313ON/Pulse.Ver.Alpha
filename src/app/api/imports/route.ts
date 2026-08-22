import { randomUUID } from "node:crypto";
import { auditMutation, ensureRuntimeData, handleApiError, json, readJson, requireCsrf, requirePermission } from "../_lib";
import { getDatabase } from "../../../server/db";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../../server/import/SQLiteImportRepositories";
import { ImportReviewService } from "../../../application/import/staging";
import { XlsxWorkbookError, XlsxWorkbookReader, hasXlsxZipSignature } from "../../../application/import/spreadsheet/xlsx";
import { SpreadsheetMappingEngine } from "../../../application/import/spreadsheet/mapping";
import { SpreadsheetEvaluationEngine } from "../../../application/import/spreadsheet/evaluation";
import { ImportNormalizer } from "../../../application/import/normalization";
import { createProgramServices } from "../../../server/program";
import { getPlanningContext } from "../../../domain/planning";
import { RepositoryError } from "../../../server/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function GET() {
  try {
    ensureRuntimeData();
    await requirePermission("imports.manage");
    return json(new SQLiteImportJobRepository().list());
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    ensureRuntimeData();
    await requirePermission("imports.manage");
    await requireCsrf(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new RepositoryError("VALIDATION", "یک فایل Excel الزامی است.");
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) throw new RepositoryError("VALIDATION", "اندازه فایل باید بین ۱ بایت و ۵ مگابایت باشد.");
    if (!/\.xlsx$/i.test(file.name) || (file.type && file.type !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) {
      throw new RepositoryError("VALIDATION", "فقط فایل XLSX مجاز است.");
    }

    jobId = `import-${randomUUID()}`;
    const planning = getPlanningContext();
    const sourceName = file.name.replace(/[\\/]/g, "_").slice(-160);
    const jobs = new SQLiteImportJobRepository();
    const records = new SQLiteImportRecordRepository();
    const review = new ImportReviewService(undefined, jobs, records);
    const source = { type: "EXCEL" as const, name: sourceName, metadata: { uploadedAt: new Date().toISOString(), planYear: planning.planYear } };
    jobs.create({ id: jobId, source, status: "DRAFT", records: [], createdAt: new Date().toISOString() });

    const input = await file.arrayBuffer();
    if (!hasXlsxZipSignature(input)) {
      throw new RepositoryError("VALIDATION", "فایل XLSX معتبر نیست.");
    }
    const workbook = await new XlsxWorkbookReader().read(input, { name: sourceName });
    const mapped = new SpreadsheetMappingEngine({ sourceName }).map(workbook);
    if (mapped.length === 0) throw new RepositoryError("VALIDATION", "فایل قابل نگاشت نیست.");
    const normalized = new ImportNormalizer().normalize(mapped);
    if (!normalized.valid) throw new RepositoryError("VALIDATION", normalized.errors.map((issue) => issue.message).join(" "));
    const evaluation = new SpreadsheetEvaluationEngine().evaluate(workbook, normalized.normalizedData);
    if (evaluation.summary.status === "FAIL") throw new RepositoryError("VALIDATION", "ارزیابی معنایی فایل ناموفق است.");

    const program = createProgramServices().query.getProgram({
      id: `program-${planning.planYear}`,
      title: `برنامه سالانه تحول دیجیتال ${planning.planYear}`,
      start: planning.startDate,
      end: planning.endDate,
      status: "در حال اجرا",
      priority: "بحرانی"
    }).hierarchy;
    const database = getDatabase();
    const process = database.transaction(() => {
      review.attachRecords(jobId!, normalized.normalizedData);
      return review.analyze(jobId!, program, { today: planning.today });
    });
    return json({ job: process(), evaluation: evaluation.summary }, { status: 201 });
  } catch (error) {
    if (error instanceof XlsxWorkbookError) {
      error = new RepositoryError("VALIDATION", "فایل XLSX معتبر نیست یا از حدود مجاز فراتر رفته است.");
    }
    if (jobId) {
      try { new SQLiteImportJobRepository().saveFailure(jobId, error instanceof Error ? error.message : "Import failed."); } catch { /* preserve original response */ }
    }
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    ensureRuntimeData();
    const user = await requirePermission("imports.manage");
    const body = await readJson(request);
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new RepositoryError("VALIDATION", "شناسه کار ورود اطلاعات الزامی است.");
    if (body.action !== "approve" && body.action !== "reject") {
      throw new RepositoryError("VALIDATION", "عملیات بازبینی نامعتبر است.");
    }
    const action = body.action;
    const jobs = new SQLiteImportJobRepository();
    const job = new ImportReviewService(undefined, jobs, new SQLiteImportRecordRepository());
    try {
      const database = getDatabase();
      const transition = database.transaction(() => {
        const before = jobs.get(id);
        if (!before) throw new RepositoryError("NOT_FOUND", "کار ورود اطلاعات پیدا نشد.");
        const result = action === "approve" ? job.approve(id) : job.reject(id);
        auditMutation(
          user,
          "import-review",
          id,
          action,
          { status: before.status },
          { status: result.status, approvedAt: result.approvedAt ?? null }
        );
        return result;
      });
      return json(transition());
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError("VALIDATION", error instanceof Error ? error.message : "گذار وضعیت بازبینی نامعتبر است.");
    }
  } catch (error) {
    return handleApiError(error);
  }
}
