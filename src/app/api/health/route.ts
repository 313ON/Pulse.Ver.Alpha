import { getReadOnlyDatabase } from "../../../server/db";

export function GET() {
  try {
    const database = getReadOnlyDatabase();
    database.prepare("SELECT 1 AS ok").get();
    return Response.json(
      { status: "ok", database: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { status: "degraded", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
