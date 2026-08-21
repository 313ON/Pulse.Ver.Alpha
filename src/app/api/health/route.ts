import { getReadOnlyDatabase } from "../../../server/db";

export function GET() {
  try {
    const database = getReadOnlyDatabase();
    database.prepare("SELECT 1 AS ok").get();
    return Response.json({ status: "ok", database: "ok" });
  } catch {
    return Response.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
