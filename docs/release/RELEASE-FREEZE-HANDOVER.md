# PULSE Release Freeze Handover

This document is the short operational handover for the frozen Release 1
candidate. It complements `docs/operations/RUNBOOK.md`,
`docs/operations/DEPLOYMENT.md`, and `docs/operations/RELEASE-1-SMOKE-TEST.md`.

## Frozen release identity

| Item | Value |
|---|---|
| Branch | `release/pulse-departmental-materialization` |
| Git commit | `1e5e166` |
| Application version | `1.0.0` |
| Schema version | `1` |
| Release name | `PULSE Release 1` |
| Node.js verified on workstation | `v22.23.2` |
| npm verified on workstation | `10.9.8` |
| Plan cycle | `1405` |
| Production seed mode | `reference` |

The database release identity is written to `pulse_release_metadata` at
startup from `PULSE_RELEASE_COMMIT`. A deployment must set that variable to
the exact deployed commit; `unrecorded` is not an acceptable operational
value.

The validated RC data shape contained 10 strategic goals, 6 work items, 6
departments, 4 KPIs, 3 risks, and 1 dependency for plan cycle 1405. These are
validation evidence, not a production seed contract. Production data must be
the approved canonical plan and organizational data loaded through the
governed application workflow.

## Authoritative database strategy

There are three intentionally different database classes:

1. `db/pulse.sqlite` is the repository-local development database. It is not
   an operational database and must not be copied into production.
2. The RC validation database was a disposable external SQLite copy used for
   smoke testing. Its temporary path is not a production location.
3. The operational database is one persistent SQLite file at an approved,
   absolute path outside the release directory, for example:
   `D:\Data\PULSE\db\pulse.sqlite`.

Only the operational database is used by the service. Run one writer process
per database. Keep database, WAL files, logs, and backups outside the web root
and protect them with least-privilege ACLs.

## First activation and startup

On the approved operator machine:

```powershell
Set-Location "<RELEASE_DIR>"
node --version                 # Node 22.x
npm --version
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

Configure the approved service manager with these values:

```text
NODE_ENV=production
PULSE_DB_PATH=<absolute external persistent path>\pulse.sqlite
PULSE_SEED_MODE=reference
PULSE_PLAN_YEAR=1405
PULSE_PLAN_START_DATE=1405/01/01
PULSE_PLAN_END_DATE=1405/12/29
PULSE_PLAN_TODAY=<approved reference date>
PULSE_RELEASE_COMMIT=1e5e166
PULSE_HTTPS=true             # only when TLS terminates before Next.js
```

For first provisioning only, provide `PULSE_ADMIN_PASSWORD` through the
approved secret mechanism. Start `npm start -- -p <PORT>`, verify readiness,
log in, and then remove the provisioning variable from the service
environment. `reference` mode creates the required reference/RBAC baseline;
it does not create demo goals, actions, KPIs, risks, or dependencies.

Verify startup:

```powershell
Get-NetTCPConnection -LocalPort <PORT> -State Listen
$health = Invoke-WebRequest "http://127.0.0.1:<PORT>/api/health" -UseBasicParsing
$health.StatusCode
$health.Content
```

Expected response is HTTP 200 with `{"status":"ok","database":"ok"}`.
Then verify login, dashboard, `/program`, `/reports`, one PDF export, and one
XLSX export using `RELEASE-1-SMOKE-TEST.md`.

Stop and restart only through the approved service manager. For a local
developer run, `Ctrl+C` stops `npm start`; start it again with the same
environment and database path. After every restart repeat health, login, one
read, report, and export checks.

## Backup and restore

Use SQLite online backup; do not raw-copy the live database or its `-wal` and
`-shm` companions:

```powershell
sqlite3.exe "<PULSE_DB_PATH>" ".backup '<BACKUP_DIR>\pulse-<yyyyMMdd-HHmmss>.sqlite'"
sqlite3.exe "<BACKUP_DIR>\pulse-<timestamp>.sqlite" "PRAGMA integrity_check;"
sqlite3.exe "<BACKUP_DIR>\pulse-<timestamp>.sqlite" "PRAGMA foreign_key_check;"
Get-FileHash -Algorithm SHA256 -LiteralPath "<BACKUP_DIR>\pulse-<timestamp>.sqlite"
```

Record the backup path, timestamp, checksum, release commit, and health
result. Keep backups on separate protected storage with a retention policy
approved by operations.

For restore:

1. Stop the service and remove it from traffic.
2. Preserve the current database and logs as incident evidence.
3. Verify the selected backup with integrity and foreign-key checks.
4. Restore the backup to the exact external `PULSE_DB_PATH` and reapply ACLs.
5. Start the frozen release with `PULSE_RELEASE_COMMIT=1e5e166`.
6. Verify health, login, dashboard/read access, governed report, PDF, XLSX,
   and restart persistence.
7. Record the recovery point and any writes after the backup that were lost.

The backup/restore procedure was locally verified on September 12, 2026:
the online backup was 125,739,008 bytes, `integrity_check` returned `ok`,
foreign-key checks returned zero errors, and the restored database started the
application successfully with health `200` / `database=ok`.

## Minimum recovery procedures

- **Application crash:** confirm the service process and logs, restart through
  the service manager, then require health 200 before returning traffic.
- **Database unavailable:** stop traffic, confirm `PULSE_DB_PATH` is absolute,
  external, readable/writable by the service account, and that only one writer
  exists; restart and require health 200.
- **Corrupt or invalid database:** stop the service, preserve the original
  file and logs, select the latest verified backup, restore it, and execute the
  full post-restore checks above.
- **Failed deployment/update:** stop the new service, retain its logs, switch
  to the previous immutable release artifact, and keep the database unchanged
  unless a compatibility-approved restore is required.
- **Bad import or accidental data change:** stop further writes, preserve the
  evidence, identify the last verified backup, and restore only through the
  approved change/recovery procedure.

## Operational freeze

This release is frozen at commit `1e5e166`. Future product or operational
changes require a new post-release change request, a new release identity, and
fresh validation. No future change may silently modify this frozen release.
