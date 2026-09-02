# Authentication Incident Result

Date: 2026-09-02

## Result

- STATUS: RECOVERED
- ROOT CAUSE: PASSWORD_NOT_CHANGED. The live disposable database was newly created during the prior activation, and its admin was provisioned with that session's one-time bootstrap credential. The previously established credential was never used to provision this database. No existing admin was overwritten.
- LIVE RUNTIME PID: `20344`
- LIVE PULSE_DB_PATH: `C:\Users\Nima Bakhtar\AppData\Local\Temp\PULSE-LOCAL-PREPRODUCTION-20260902\pulse.sqlite`
- DATABASE IDENTITY: intended disposable local pre-production SQLite database; release metadata matches certified HEAD and application version `1.0.0`
- FORENSIC BACKUP: `C:\Users\Nima Bakhtar\AppData\Local\Temp\PULSE-LOCAL-PREPRODUCTION-20260902\backups\pulse-auth-incident-forensic-20260902-103258.sqlite`
- BACKUP SHA-256: `ED59DC74762338A620E60575742C83135657CB6CE7D65AD1BEF68A31C01A4CA1`
- INTEGRITY: PASS (`ok`)
- FOREIGN KEY CHECK: PASS (empty)
- ADMIN IDENTITY: `admin`, existing stable user ID, `SUPER_ADMIN`, active; created timestamp unchanged; update timestamp changed only during the authorized recovery
- PASSWORD CHANGE PROVEN: NO
- RECOVERY: COMPLETED
- BROWSER LOGIN: PASS
- LOGOUT: PASS
- RESTART PERSISTENCE: PASS
- CERTIFIED HEAD: `e810e41c1133a84eb07ff4f5c119cd93a9b32d92`
- CERTIFIED RELEASE MODIFIED: NO
- CODE MODIFIED: NO

## Evidence basis

- The prior bootstrap path inserts an admin only when no admin exists; it does not update an existing admin password.
- The live database had one active admin, identical creation/update timestamps before repair, and no password-reset audit event.
- Credential comparison accepted only the prior activation bootstrap credential before repair.
- Recovery updated the existing admin row using the certified scrypt storage format; no account was created.
- After recovery, browser login reached the dashboard, logout returned to `/login`, re-login succeeded, and login succeeded again after a full runtime restart.
