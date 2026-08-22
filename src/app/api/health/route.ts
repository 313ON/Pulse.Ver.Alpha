import { checkDatabaseReadiness } from "../../../server/db";

export function GET() {
  try {
    checkDatabaseReadiness();
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
