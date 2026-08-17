import { ensureRuntimeData, handleApiError, json, readJson } from "../_lib";
import { MonthlyReviewRepository } from "../../../server/repositories";
export const dynamic = "force-dynamic";
export function GET() { try { ensureRuntimeData(); return json(new MonthlyReviewRepository().list()); } catch (error) { return handleApiError(error); } }
export async function POST(request: Request) { try { ensureRuntimeData(); return json(new MonthlyReviewRepository().create(await readJson(request)), { status: 201 }); } catch (error) { return handleApiError(error); } }
