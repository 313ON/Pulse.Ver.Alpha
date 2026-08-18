import { NextResponse } from "next/server";
import { ensureRuntimeData, handleApiError, readJson } from "../../_lib";
import { isLoginRateLimited, login, loginRateLimitKey, recordLoginFailure, clearLoginFailures, seedAuthFoundation } from "../../../../server/auth";

export async function POST(request: Request) {
  try {
    ensureRuntimeData();
    seedAuthFoundation();
    const body = await readJson(request);
    const username = String(body.username ?? "");
    const key = loginRateLimitKey(username, request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "local");
    if (isLoginRateLimited(key)) return NextResponse.json({ error: "تعداد تلاش‌های ورود بیش از حد مجاز است." }, { status: 429, headers: { "Retry-After": "900" } });
    const ok = await login(username, String(body.password ?? ""));
    if (!ok) {
      recordLoginFailure(key);
      return NextResponse.json({ error: "نام کاربری یا گذرواژه صحیح نیست." }, { status: 401 });
    }
    clearLoginFailures(key);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
