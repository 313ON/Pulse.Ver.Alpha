# PULSE Local Pre-Production Activation Evidence

Date: 2026-09-02  
Status: PREPROD_ACTIVATED_WITH_FINDINGS  
Final server deployment readiness: READY_FOR_SERVER_DEPLOYMENT

## Certified release

- Certified HEAD: `e810e41c1133a84eb07ff4f5c119cd93a9b32d92`
- Clean artifact: `C:\Users\Nima Bakhtar\AppData\Local\Temp\pulse-preprod-certified-e810e41`
- Clean artifact HEAD: `e810e41c1133a84eb07ff4f5c119cd93a9b32d92`
- Clean artifact tracked status: clean
- Application version: `1.0.0`

## Runtime

- Node: `v22.23.2`
- npm: `10.9.8`
- Next.js: `15.5.23`
- Build: PASS (`npm ci`, `npm run build`)
- Runtime command: `next start -p 3001`
- Local pre-production URL: `http://127.0.0.1:3001`
- Runtime PID at evidence capture: `11248`
- Development runtime: port `3045`, separate process, left untouched

## Isolated database and recovery

- Database: `C:\Users\Nima Bakhtar\AppData\Local\Temp\PULSE-LOCAL-PREPRODUCTION-20260902\pulse.sqlite`
- Database identity: disposable local pre-production SQLite database, external to the artifact
- Baseline backup: `C:\Users\Nima Bakhtar\AppData\Local\Temp\PULSE-LOCAL-PREPRODUCTION-20260902\backups\pulse-local-preprod-active-baseline-20260902.sqlite`
- Baseline backup SHA-256: `5E7CE3E68F62A02B315B0002046CE0D14FBA90003EBFD0DDA5F98B968E0EBB67`
- Restore rehearsal copy: `C:\Users\Nima Bakhtar\AppData\Local\Temp\PULSE-LOCAL-PREPRODUCTION-20260902\restore-rehearsal\pulse-local-preprod-restore-20260902.sqlite`
- Active DB `integrity_check`: PASS (`ok`)
- Active DB `foreign_key_check`: PASS (empty)
- Backup integrity and foreign-key checks: PASS
- Restore rehearsal integrity and foreign-key checks: PASS
- An initial bootstrap database was quarantined recoverably after its intentionally undisclosed generated secret was not available for login; no database file was deleted.

## Acceptance

- Health endpoint: PASS, HTTP `200`, `status:"ok"`, `database:"ok"`
- Login/session/logout: PASS against the live runtime as `admin` / `SUPER_ADMIN`; no password recorded
- Browser UI: PASS on the live runtime for dashboard, program, goals, objectives, activities, actions, KPIs, risks, dependencies, reports, and imports
- Controlled write: PASS; goal `G99` created with HTTP `201`, visible after reload, and retained after restart
- Import fixture: PASS through the real browser file input and submit flow
- Import result: `REVIEW_REQUIRED`; governance finding behavior preserved, including unresolved owner accountability; no approval bypass performed
- Import persistence: PASS; review job remained persisted after restart
- Source fixture: unchanged; SHA-256 `E982DD48CB390ED04D519902069CF8AEA710ACB0268FCAEB393A3A53C77052AD`
- Report rendering: PASS, HTTP `200`
- PDF export: PASS, readable/non-empty, `22152` bytes
- XLSX export: PASS, readable/non-empty, `7329` bytes
- Restart/persistence: PASS; same artifact, same `PULSE_DB_PATH`, health/login/read/write/import state retained

## Findings

- `npm ci` reported dependency audit findings (2 moderate, 3 high); this did not block the certified build or runtime activation and was not changed in this controlled session.
- One PowerShell multipart upload attempt produced an internal error due to transport construction; a standards-compliant multipart submission and the real browser flow both passed. No application source change was required.

## Deferred to real server

- Real Windows Server and approved service account
- Windows Service Manager/NSSM registration
- Production firewall, reverse proxy, TLS certificate, and DNS
- Production database, backup repository, and rollback operator
