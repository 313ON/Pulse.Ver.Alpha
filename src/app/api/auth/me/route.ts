import { NextResponse } from "next/server";
import { ensureRuntimeData } from "../../_lib";
import { getSessionUser, seedAuthFoundation } from "../../../../server/auth";

export async function GET() {
  ensureRuntimeData();
  seedAuthFoundation();
  return NextResponse.json({ user: await getSessionUser() });
}
