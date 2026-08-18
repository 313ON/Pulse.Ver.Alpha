import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDatabase } from "../../../../server/db";
import { handleApiError, requireCsrf } from "../../_lib";

export async function POST(request: Request) {
  try {
    await requireCsrf(request);
    const cookieStore = await cookies();
    const token = cookieStore.get("pulse_session")?.value;
    if (token) getDatabase().prepare("DELETE FROM sessions WHERE id = ?").run(token);
    cookieStore.delete("pulse_session");
    cookieStore.delete("pulse_csrf");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
