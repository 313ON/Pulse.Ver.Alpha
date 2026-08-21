import { ensureRuntimeData, handleApiError, json, requirePermission } from "../../_lib";
import { SQLiteImportJobRepository, SQLiteImportRecordRepository } from "../../../../server/import/SQLiteImportRepositories";
import { ImportReviewService } from "../../../../application/import/staging";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    ensureRuntimeData();
    await requirePermission("imports.manage");
    const service = new ImportReviewService(undefined, new SQLiteImportJobRepository(), new SQLiteImportRecordRepository());
    return json(service.getJob((await params).id));
  } catch (error) {
    return handleApiError(error);
  }
}
