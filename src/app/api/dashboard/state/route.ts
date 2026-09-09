import { ensureRuntimeData, handleApiError, json, requirePermission } from "../../_lib";
import { isDatabaseUnavailableError } from "../../../../server/db";
import { loadDashboardState } from "../../../../server/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requirePermission("goals.view");
    ensureRuntimeData();
    return json({ state: loadDashboardState() });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) return json({ state: { kind: "blocking-error", message: "داده پایدار برنامه در دسترس نیست.", guidance: "اتصال پایگاه داده را بررسی کنید یا با مسئول سامانه تماس بگیرید." } }, { status: 503 });
    return handleApiError(error);
  }
}
