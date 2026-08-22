# PULSE Release 1

## Release contract

| Item | Release 1 value |
|---|---|
| Product | PULSE — Charb Chimie operational planning |
| Application version | 1.0.0 |
| Database schema version | 1 |
| Release name | PULSE Release 1 |
| Source commit | Record the output of `git rev-parse HEAD` for the deployment artifact |
| Node.js | 22.x (`package.json` engines: `>=22 <23`) |
| Database | External SQLite file opened by `better-sqlite3` |
| Production seed mode | `PULSE_SEED_MODE=reference` |

The application, schema, authentication, seed behavior, reporting, import
workflow, backup procedure, and operational documents are one release unit.
Do not deploy a release directory without its matching database checks and
operator evidence.

## Required environment

Required for the first activation:

```text
NODE_ENV=production
PULSE_DB_PATH=<absolute path to external persistent pulse.sqlite>
PULSE_ADMIN_PASSWORD=<one-time secret, at least 8 characters>
PULSE_SEED_MODE=reference
PULSE_PLAN_YEAR=1405
PULSE_PLAN_START_DATE=1405/01/01
PULSE_PLAN_END_DATE=1405/12/29
PULSE_PLAN_TODAY=<approved operational reference date>
PULSE_HTTPS=<true only when TLS terminates before Next.js>
PULSE_RELEASE_COMMIT=<commit deployed by the operator>
```

`PULSE_ADMIN_PASSWORD` is read only for initial administrator provisioning.
Never place it in source, Git, command history, or logs. After the first
successful provisioning, remove it from the service environment and use the
secure password-rotation procedure for later changes.

## Capability matrix

| Capability | Implementation | Persistence | UI | API/server behavior | Tests | Production status | User-facing completeness |
|---|---|---|---|---|---|---|---|
| Authentication/RBAC | Session cookies, CSRF, scoped permissions | SQLite users, roles, sessions, audit log | `/login`, user card, settings user management | `/api/auth/*`, permission and scope checks | Auth/API/page authorization tests | Ready with controlled admin provisioning | Complete |
| Dashboard | Strategic and execution command centers | Reads canonical program/report data | `/`, `/program` | Governed query composition and dashboard API | Command-center and reporting tests | Ready | Complete for Release 1 |
| Goals/objectives | Create/list/detail navigation | `strategic_goals`, `sub_goals` | `/goals`, `/sub-goals`, goal detail | CRUD routes | Repository/application/API coverage | Ready | Complete |
| Activities | Create/list/detail navigation | `activities` | `/activities` | CRUD routes | Persistence and UI coverage | Ready | Complete |
| Actions/work items | Create/list/detail, ownership and progress | `work_items`, collaborators | `/actions`, action detail | CRUD, scope, progress routes | Repository/application/command-center coverage | Ready | Complete |
| Departments/people/roles | Organizational structure and assignments | `departments`, `seats`, `people`, roles | `/departments`, `/persons`, `/roles` | CRUD and RBAC routes | Organization tests | Ready after replacing reference roster with real roster | Complete |
| KPIs | KPI list and management | `kpis` | `/kpis` | Authenticated CRUD route | Reporting/application coverage | Ready | Complete |
| Risks | Risk register and status | `risks` | `/risks` | Authenticated CRUD route | Reporting/application coverage | Ready | Complete |
| Dependencies | Work-item dependency register | `dependencies` | `/dependencies` | Authenticated CRUD route | Repository/application coverage | Ready | Complete |
| Monthly reviews | Department/month review records | `monthly_reviews` | `/monthly-reviews` list/create/detail/edit | Authenticated CRUD route | API/persistence coverage | Ready | Complete |
| Spreadsheet import | XLSX upload, analysis, review, approval/rejection | `import_jobs`, `import_records`, transactional replacement | `/imports` | CSRF-protected durable import routes | Import persistence, mapping, evaluation, UI tests | Ready for controlled reviewed import | Complete |
| Reporting/export | Governed report, PDF and XLSX export | Read-only report composition | `/reports` | Governed report/export routes | Reporting and export tests | Ready | Complete |
| Backup/restore | SQLite online backup and verification | External DB and approved backup path | Operator procedure | `backup.ts` verification boundary | Backup/restore test | Ready with operator execution | Operator-complete |
| Restart persistence | WAL/full-sync runtime baseline | External SQLite | Operator smoke test | Health/readiness boundary | DB concurrency/restart-related tests | Ready | Operator-complete |

## Seed classification

| Seeded record | Classification | Production handling |
|---|---|---|
| RBAC roles and permissions | REFERENCE | Required baseline |
| Department and seat catalog in `src/server/seed.ts` | REFERENCE starter catalog | Verify and replace with the approved Charb Chimie structure |
| People attached to starter seats | REFERENCE starter catalog | Verify and replace with real people |
| Goals, actions, KPIs, risks, dependencies from `src/lib/data.ts` | DEMO | Not seeded when `NODE_ENV=production` and `PULSE_SEED_MODE=reference` |

PULSE does not silently delete an existing database's operational records.
The operator must start from a verified empty/existing production database and
load the approved Annual Plan 1405 data.

## Deployment identity and paths

The operator must fill these values in the change record; the repository does
not assume them:

```text
RELEASE_DIR=<application release directory>
DB_DIR=<external persistent database directory>
PULSE_DB_PATH=<DB_DIR>\pulse.sqlite
BACKUP_DIR=<approved backup directory>
LOG_DIR=<approved service log directory>
SERVICE_NAME=<approved Windows service name>
SERVICE_ACCOUNT=<approved least-privilege account>
PORT=<approved listening port>
```

The database path must be absolute, persistent, ACL-protected, and outside
`RELEASE_DIR`. Run only one writer process for a database file.

## Controlled activation sequence

1. Confirm the exact release commit, Node.js 22.x, release directory, service
   account, port, firewall rule, and environment values.
2. Stop the existing PULSE process/service if one exists.
3. Verify the database path, `PRAGMA integrity_check`, foreign-key check, and
   schema readiness.
4. Create an SQLite online backup in `BACKUP_DIR`; verify integrity, foreign
   keys, schema, and SHA-256 checksum.
5. Install dependencies with `npm ci`, run `npm test`, `npm run typecheck`,
   `npm run lint`, and `npm run build` in `RELEASE_DIR`.
6. Configure the approved Windows service manager with `npm start -- -p <PORT>`,
   `RELEASE_DIR` as working directory, the external `PULSE_DB_PATH`, and
   restart-on-failure.
7. Start the service and call `GET http://127.0.0.1:<PORT>/api/health`.
8. Provision the initial admin using the protected environment secret, log in,
   then remove the provisioning secret.
9. Execute `docs/operations/RELEASE-1-SMOKE-TEST.md`.
10. Record the backup name/checksum, health response, login result, controlled
    write/reload result, report result, import result, and restart result.

## Rollback

For an application-only failure, stop the service and restore the previous
release directory. Do not downgrade the database unless compatibility with the
current schema is explicitly verified.

For database corruption or an incorrect data import:

1. stop the service and remove it from traffic;
2. preserve the current database and logs as incident evidence;
3. verify the selected backup;
4. restore the backup to the exact external `PULSE_DB_PATH`;
5. restore ACLs for the service account;
6. start the service;
7. run health, login, read, reporting, and persistence checks;
8. record the recovery point and any lost post-backup writes.

## Release quality evidence

- Test: PASS — 200 tests in 40 files
- Typecheck: PASS
- Lint: PASS
- Build: PASS
- Schema contract: covered by readiness and database tests
- Backup/restore: PASS — independent verified backup and restore test
- Windows SQLite baseline: PASS in repository tests; Windows Server service
  execution remains an operator responsibility

## Go criteria

Release 1 is technically ready for controlled deployment when the operator
has completed the activation sequence and attached the smoke-test evidence.
Unverified server-local values are deployment prerequisites, not reasons to
delay the application release indefinitely.
