# PULSE — Production Activation Manifest

Status: Operator handoff contract  
Prepared: 2026-09-01  
Activation attempt: Not performed

This manifest converts the committed Windows activation procedure into an
execution-ready change record. Do not execute activation until every required
external value is completed and approved. Do not place secrets in this file,
Git, command arguments, logs, or screenshots.

## 1. Certified release identity

| Item | Value |
|---|---|
| Release branch | `release/pulse-departmental-materialization` |
| Certified release HEAD | `e810e41c1133a84eb07ff4f5c119cd93a9b32d92` |
| Original release commit | `fa4e89bffb41bd881881458dd27e4697d5245ad6` |
| Base commit | `ff5a04e07386c5c52c03af5b6b73a5a09c2b4221` |
| Corrective commit | `e810e41c1133a84eb07ff4f5c119cd93a9b32d92` |
| Commit message | `fix(import): correct committed manifest JSON` |
| Promotion gate | `PROMOTION READY WITH WARNINGS` |
| Required deployed commit | `e810e41c1133a84eb07ff4f5c119cd93a9b32d92` |

The historical activation procedure contains an older example commit identity;
it is superseded for this activation. Use only the required deployed commit
above.

## 2. Preconditions

- [ ] Approved Windows Server administrator is operating in an elevated
  PowerShell session.
- [ ] Target server identity, release path, service, database, backup, log,
  and port values are recorded below.
- [ ] Release artifact is checked out at the required deployed commit.
- [ ] Tracked release-directory status is empty.
- [ ] Node.js is version 22.x and npm is available.
- [ ] `.next` and `db\schema.sqlite.sql` exist in the release directory.
- [ ] Production database path is external to the release directory.
- [ ] Service account has read/execute on the release directory and read/write
  on the database and log directories.
- [ ] Backup ownership/access is separate from the service account.
- [ ] Only one application writer process will use the production SQLite file.
- [ ] Approved service manager is available.
- [ ] No source workbook or developer `db\pulse.sqlite` will be copied.

## 3. Activation execution matrix

| Parameter | Required | Evidence / Source | Current Value | Owner | Secret? |
|---|---:|---|---|---|---:|
| Target Windows server | Yes | `RELEASE-1-WINDOWS-ACTIVATION.md`, server discovery | MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure operator | No |
| Server/release directory | Yes | Procedure uses `$ReleaseDir`; deployment guide requires separate release directory | MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure operator | No |
| Production database path | Yes | `src/server/db.ts`, deployment guide; must be absolute and outside release directory | MISSING — EXTERNAL OPS INPUT REQUIRED | DBA / infrastructure operator | No |
| Backup directory | Yes | Activation procedure baseline-backup section | MISSING — EXTERNAL OPS INPUT REQUIRED | DBA / infrastructure operator | No |
| Service log directory | Yes | Activation procedure and deployment guide | MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure operator | No |
| Service manager | Yes | Approved organization service manager; NSSM is only the documented example | MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure owner | No |
| Service name | Yes | Procedure uses `$ServiceName`; smoke test requires service lookup | MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure owner | No |
| Service account | Yes | Procedure requires explicit approved service identity and ACLs | MISSING — EXTERNAL OPS INPUT REQUIRED | Security / infrastructure owner | No |
| Application port | Yes | Procedure uses `$Port`; firewall and health checks depend on it | MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure owner | No |
| Node.js runtime | Yes | `package.json` and procedure require `>=22 <23` | Node.js 22.x required; exact installed version MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure operator | No |
| npm runtime | Yes | `npm ci`, test/build procedure | npm available with Node 22.x; exact version MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure operator | No |
| `NODE_ENV` | Yes | Deployment guide | `production` | Release operator | No |
| `PULSE_DB_PATH` | Yes | `src/server/db.ts`; external absolute path required in production | MISSING — EXTERNAL OPS INPUT REQUIRED | DBA / infrastructure operator | No |
| `PULSE_SEED_MODE` | Yes | Activation procedure | `reference` | Release operator | No |
| `PULSE_PLAN_YEAR` | Yes | Repository planning contract | `1405` | Release operator | No |
| `PULSE_PLAN_START_DATE` | Yes | Activation procedure | `1405/01/01` | Release operator | No |
| `PULSE_PLAN_END_DATE` | Yes | Activation procedure | `1405/12/29` | Release operator | No |
| `PULSE_PLAN_TODAY` | Yes | Procedure requires approved operational reference date | MISSING — EXTERNAL OPS INPUT REQUIRED | Business / release owner | No |
| `PULSE_RELEASE_COMMIT` | Yes | Certified release identity | `e810e41c1133a84eb07ff4f5c119cd93a9b32d92` | Release operator | No |
| `PULSE_HTTPS` | Conditional | Deployment guide; true only when TLS terminates before Next.js | MISSING — EXTERNAL OPS INPUT REQUIRED | Network / security owner | No |
| `PULSE_ADMIN_PASSWORD` | First provisioning only | Procedure; protected service configuration only | Existence confirmation MISSING — EXTERNAL OPS INPUT REQUIRED; never record the value | Security / release operator | Yes |
| Elevated PowerShell | Yes | Procedure requires Administrator for service, ACL, and firewall operations | MISSING — EXTERNAL OPS INPUT REQUIRED | Infrastructure operator | No |
| Approved TLS termination | Conditional | Deployment guide | MISSING — EXTERNAL OPS INPUT REQUIRED | Network / security owner | No |
| Health endpoint | Yes | `src/app/api/health/route.ts`, deployment guide | `GET http://127.0.0.1:$Port/api/health` | Release operator | No |
| Smoke-test procedure | Yes | `docs/operations/RELEASE-1-SMOKE-TEST.md` | Repository procedure | Release operator | No |
| Rollback procedure | Yes | Deployment guide and RUNBOOK | Artifact rollback; verified backup restore to disposable path | Release operator / DBA | No |

## 4. Minimum external ops input set

Provide only these external inputs; all other activation values are
deterministic from repository evidence or are operator confirmations:

1. Target Windows server and elevated administrator access.
2. Approved release/application directory.
3. Approved external persistent SQLite path.
4. Approved backup directory and log directory.
5. Approved service manager, service name, service account, and application
   port.
6. Exact installed Node.js 22.x/npm versions.
7. Approved operational reference date for `PULSE_PLAN_TODAY`.
8. Approved TLS decision and, if applicable, confirmed TLS termination before
   Next.js.
9. Confirmation that the protected first-provisioning administrator secret
   exists, without disclosing the secret.

Do not request or record the administrator password itself in this manifest.

## 5. Repository-known environment

Configure through the approved protected service-configuration mechanism:

```text
NODE_ENV=production
PULSE_DB_PATH=MISSING — EXTERNAL OPS INPUT REQUIRED
PULSE_SEED_MODE=reference
PULSE_PLAN_YEAR=1405
PULSE_PLAN_START_DATE=1405/01/01
PULSE_PLAN_END_DATE=1405/12/29
PULSE_PLAN_TODAY=MISSING — EXTERNAL OPS INPUT REQUIRED
PULSE_RELEASE_COMMIT=e810e41c1133a84eb07ff4f5c119cd93a9b32d92
PULSE_HTTPS=MISSING — EXTERNAL OPS INPUT REQUIRED
```

For first provisioning only, add `PULSE_ADMIN_PASSWORD` through the protected
service mechanism, then remove it immediately after successful provisioning.
Never put its value in this file or on a command line.

## 6. Exact activation procedure

Execute the committed procedure in this order, replacing only values explicitly
marked `MISSING — EXTERNAL OPS INPUT REQUIRED` after approval:

1. Run the server-discovery commands in
   `docs/operations/RELEASE-1-WINDOWS-ACTIVATION.md`. Confirm Windows identity,
   elevated access, Node 22.x, npm, approved service manager, and service state.
2. In the release directory, verify:

   ```powershell
   git rev-parse HEAD
   git status --porcelain=v1
   Get-Content -LiteralPath package.json | Select-String '"version"|"node"'
   Test-Path -LiteralPath ".next"
   Test-Path -LiteralPath "db\schema.sqlite.sql"
   ```

   Require HEAD equal to
   `e810e41c1133a84eb07ff4f5c119cd93a9b32d92` and empty tracked status.
3. Set the approved release, database, backup, log, service, account, port,
   and environment values. Confirm the database path is absolute, persistent,
   ACL-protected, and outside the release directory.
4. Create/verify only the approved release, database, backup, and log
   directories. Apply least-privilege ACLs.
5. If the production database does not exist, provision through the service
   environment using the canonical schema path. Do not use ad-hoc SQL and do
   not copy `db\pulse.sqlite`.
6. Build/verify the release artifact with the documented `npm ci` and
   `npm run build` procedure if the approved artifact has not already been
   built. Do not change source or package files.
7. Configure the approved service manager. If approved NSSM is selected, use
   the documented `next start -p $Port` shape after `$Port` is completed from
   the external-input matrix, set the release directory,
   protected environment, restart behavior, stdout/stderr paths, and service
   account.
8. Start the service and verify `Running`, a Node process, listener state, and
   `GET /api/health` returns HTTP 200 with `status: "ok"` and `database: "ok"`.
9. Run SQLite `integrity_check` and `foreign_key_check` with approved
   `sqlite3.exe` when available. Require `ok` and empty foreign-key output.
10. Stop other writers and create the verified baseline online backup. Record
    path, SHA-256 checksum, timestamp, integrity, and foreign-key results.
11. Execute the complete smoke test in
    `docs/operations/RELEASE-1-SMOKE-TEST.md`, including login, reads, one
    controlled test action, report/export, import review, backup, restart, and
    persistence checks. Handle the test action according to the change record.
12. Restart the approved service, repeat health/readiness, and complete the
    disposable-target restore drill. Never restore over the live database.
13. Record the activation evidence without secrets:
    server, release path, external database path, service/account, port,
    backup path/checksum, activation time, smoke result, business workflow,
    restart, and restore-drill results.

## 7. Exact smoke test

Run the repository checklist:

```text
docs/operations/RELEASE-1-SMOKE-TEST.md
```

Required outcomes:

- Service reaches `Running`.
- `GET /api/health` returns HTTP 200 with `status=ok` and `database=ok`.
- `/login`, dashboard, program, read routes, reports, PDF/XLSX exports, and
  persistence checks succeed.
- A representative XLSX import is uploaded, reviewed, and rejected or
  approved according to the change plan.
- Backup integrity, foreign-key, and schema checks pass.
- Health returns 200 after restart.
- The created controlled test action and report remain consistent after reload.

## 8. Exact rollback

For an application failure:

1. Stop the approved service.
2. Remove traffic from the failed artifact.
3. Activate the previously approved application artifact in its separate
   release directory.
4. Do not downgrade the production database unless compatibility is proven.
5. Verify health, login, read paths, reports, and restart.

For corruption or an incorrect import:

1. Stop the service and prevent all writers.
2. Quarantine the live database; do not delete it.
3. Restore the verified SQLite backup to a disposable/approved target first.
4. Run integrity, foreign-key, schema-readiness, login, read, and
   representative-data checks against the disposable target.
5. Restore the verified backup to the approved live path only under the
   separately approved database recovery procedure.
6. Restart and repeat health, login, read, report, and persistence checks.

## 9. Final acceptance criteria

Activation is accepted only when all are evidenced:

- [ ] Deployed HEAD equals `e810e41c1133a84eb07ff4f5c119cd93a9b32d92`.
- [ ] Release directory tracked status is empty.
- [ ] Node.js is 22.x and build artifact is present.
- [ ] Production DB is external to the release directory.
- [ ] ACLs are least privilege and service account is approved.
- [ ] Service is Running under the approved service manager.
- [ ] Health/readiness returns HTTP 200 with database `ok`.
- [ ] Integrity and foreign-key checks pass.
- [ ] Baseline backup exists with recorded checksum.
- [ ] Smoke test passes.
- [ ] Representative business/import workflow passes.
- [ ] Restart persistence passes.
- [ ] Disposable restore drill passes.
- [ ] No source workbook, developer DB, secret, or runtime artifact was copied
  into the release artifact.
- [ ] Deferred warnings remain recorded:
  missing IT canonical authority workbook and multi-process legacy-repair race
  test.

## 10. Source references

- `docs/operations/RELEASE-1-WINDOWS-ACTIVATION.md`
- `docs/operations/DEPLOYMENT.md`
- `docs/operations/RELEASE-1-SMOKE-TEST.md`
- `docs/release/RELEASE-1.md`
- `src/server/db.ts`
- `src/app/api/health/route.ts`
- `package.json`
