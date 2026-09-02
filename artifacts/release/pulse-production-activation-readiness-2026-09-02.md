# PRODUCTION ACTIVATION READINESS

Assessment date: 2026-09-02  
Host: `IT-Station`  
Operator: not supplied

STATUS: READY_FOR_OPERATIONS_INPUT

## CERTIFIED RELEASE

- Certified commit: `e810e41c1133a84eb07ff4f5c119cd93a9b32d92` — available locally.
- Release branch: `release/pulse-departmental-materialization` — checked out.
- Current worktree: NOT CLEAN. Existing modifications and untracked development/runtime artifacts are present; it is not a deployment artifact.
- Certified runtime observed: Node `v22.23.2`; npm `10.9.8`.
- Existing staged path: `C:\ProgramData\Pulse-Staging\releases\e810e41c1133a84eb07ff4f5c119cd93a9b32d92`; directory exists but contains no discoverable release files.

## OPERATIONS INPUTS

| Input | Result | Evidence / next action |
|---|---|---|
| Target Windows Server identity | OPERATIONS_INPUT_REQUIRED | Host is Windows 10 Enterprise client, not an approved Windows Server target. |
| Approved release/application directory | OPERATIONS_INPUT_REQUIRED | Staging root exists, but no approved populated artifact directory was discovered. |
| External persistent SQLite path | OPERATIONS_INPUT_REQUIRED | No external production database path supplied or discovered. |
| Backup directory | OPERATIONS_INPUT_REQUIRED | No approved backup path or backup file discovered. |
| Service log directory | OPERATIONS_INPUT_REQUIRED | No approved service log path discovered. |
| Service manager and service name | OPERATIONS_INPUT_REQUIRED | No PULSE service/NSSM/PM2 service discovered. |
| Least-privilege service account | OPERATIONS_INPUT_REQUIRED | Not discoverable from this workstation. |
| Port and firewall rule | OPERATIONS_INPUT_REQUIRED | Existing port `3045` belongs to a development Next.js process; no PULSE firewall rule was identified. |
| Exact Node executable | DISCOVERED, not approved for target | `C:\Program Files\nodejs\node.exe`, version `v22.23.2`. |
| Approved `PULSE_PLAN_TODAY` | OPERATIONS_INPUT_REQUIRED | No PULSE environment variables are present in the current shell. |
| TLS termination / reverse proxy | OPERATIONS_INPUT_REQUIRED | No approved reverse proxy or load balancer identity/evidence discovered. |
| `PULSE_HTTPS` | OPERATIONS_INPUT_REQUIRED | Must be supplied after TLS decision. |
| Bootstrap administrator secret availability | OPERATIONS_INPUT_REQUIRED | Availability may be confirmed without exposing the secret; actual secret was not requested. |
| Previous approved artifact | OPERATIONS_INPUT_REQUIRED | No approved rollback artifact identity supplied or discovered. |
| Recovery operator | OPERATIONS_INPUT_REQUIRED | Not supplied. |
| Disposable restore location | OPERATIONS_INPUT_REQUIRED | Not supplied. |

## DATABASE

STATUS: NOT READY  
ACTION: Identify and approve an absolute, persistent, ACL-protected production `PULSE_DB_PATH` outside the application directory.  
EVIDENCE: Only repository/development SQLite files under the worktree were found; staging `data` is empty.  
NEXT GATE: Database identification.

## BACKUP

STATUS: NOT READY  
ACTION: After the production DB path and approved backup directory are supplied, confirm the writer, execute SQLite online backup, and record identity, integrity, FK checks, and SHA-256.  
EVIDENCE: No approved production DB or backup exists in the discovered staging paths.  
NEXT GATE: Approved DB and backup inputs.

## SERVICE

STATUS: NOT READY  
ACTION: Provide the approved service manager, service name/account, release directory, log directory, port, and protected environment configuration.  
EVIDENCE: A development Next.js process from the dirty worktree listens on `[::]:3045`; no PULSE Windows service was found.  
NEXT GATE: Target service configuration.

## TLS

STATUS: NOT READY  
ACTION: Confirm whether TLS terminates at an approved reverse proxy/load balancer and provide its identity, hostname, certificate, redirect, and forwarding evidence.  
EVIDENCE: No approved TLS termination or proxy configuration was discovered.  
NEXT GATE: TLS/network validation.

## ACTIVATION GATES

1. Operations inputs — STOPPED.
2. Target server validation — STOPPED; current host is not a Windows Server target.
3. Clean certified artifact — STOPPED; existing staged directory is empty and current worktree is dirty.
4. Production configuration and DB identification — STOPPED.
5. Pre-promotion backup and verification — NOT STARTED.
6. Service/TLS/activation/acceptance — NOT STARTED.

## BLOCKERS

No repository activation blocker was demonstrated. Activation is stopped at the operations-input gate because required production authority and target-environment values are absent. Developer DBs, source fixtures, runtime logs, and the dirty worktree are explicitly excluded from production use.

## NEXT ACTION

Supply or make discoverable the mandatory operations inputs listed above on the approved Windows Server. Then resume at target-server validation and create/verify a clean artifact from the certified commit. Do not start production activation on `IT-Station`.
