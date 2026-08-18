import { NextResponse } from "next/server";
import { issueCsrfToken } from "../../_lib";

export async function GET() {
  return NextResponse.json({ token: await issueCsrfToken() });
}
