import fs from "node:fs/promises";
import crypto from "node:crypto";

const base = "http://localhost:3000";
const workbookPath = "Samples/برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx";
const workbook = await fs.readFile(workbookPath);
const workbookHash = crypto.createHash("sha256").update(workbook).digest("hex").toUpperCase();
let cookies = new Map();

function absorbCookies(response) {
  for (const header of response.headers.getSetCookie?.() ?? []) {
    const [pair] = header.split(";", 1);
    const [name, value] = pair.split("=", 2);
    cookies.set(name, value);
  }
}

function cookieHeader() {
  return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  const cookie = cookieHeader();
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(`${base}${path}`, { ...init, headers });
  absorbCookies(response);
  return response;
}

const health = await request("/api/health");
const csrfResponse = await request("/api/auth/csrf");
const csrf = (await csrfResponse.json()).token;
const login = await request("/api/auth/login", {
  method: "POST",
  headers: { "content-type": "application/json", "x-csrf-token": csrf },
  body: JSON.stringify({ username: "admin", password: "developer-validation-password-123" })
});

const runs = [];
for (const run of [1, 2]) {
  const form = new FormData();
  form.append("file", new Blob([workbook], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }), "برنامه سال 1405 واحد نت با تفکیک اقدامات.xlsx");
  const upload = await request("/api/imports", {
    method: "POST",
    headers: { "x-csrf-token": csrf },
    body: form
  });
  const uploadText = await upload.text();
  const uploadBody = JSON.parse(uploadText);
  const jobId = uploadBody.job?.id;
  const jobResponse = jobId ? await request(`/api/imports/${encodeURIComponent(jobId)}`) : null;
  const job = jobResponse ? await jobResponse.json() : null;
  runs.push({
    run,
    uploadStatus: upload.status,
    uploadBody,
    jobStatus: jobResponse?.status ?? null,
    job
  });
}

console.log(JSON.stringify({
  node: process.version,
  health: { status: health.status, body: await health.text() },
  csrf: csrfResponse.status,
  login: { status: login.status, body: await login.text() },
  workbook: { path: workbookPath, bytes: workbook.length, sha256: workbookHash },
  runs
}, null, 2));
