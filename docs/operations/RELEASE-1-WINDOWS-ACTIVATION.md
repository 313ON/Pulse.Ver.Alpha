# PULSE Release 1 — Windows Server Activation Commands

This procedure is for the approved Windows Server administrator. It does not
assume the final database path, service account, port, or service manager.
Replace every `<...>` value after approval. Do not paste secrets into commands.

## 1. Server discovery

Run in an elevated PowerShell session and save the output in the change record:

```powershell
Get-ComputerInfo |
  Select-Object WindowsProductName,WindowsVersion,OsBuildNumber,WindowsInstallationType
hostname
whoami
node --version
npm --version
Get-ChildItem -LiteralPath "D:\Apps\Pulse.Ver.Alpha" -Force |
  Select-Object Mode,Length,LastWriteTime,Name
Get-Command nssm -ErrorAction SilentlyContinue
Get-Service | Where-Object { $_.DisplayName -match "PULSE|NSSM" } |
  Select-Object Name,DisplayName,Status,StartType
```

The application requires Node.js `>=22 <23`. Stop if `node --version` is not
Node 22.x. Do not change `package.json` to accommodate an unsupported runtime.

## 2. Artifact verification

The release artifact must be exactly commit
`98ed206b98631f2f6b966a3cd5fb0f513c5a4ed6` or a separately approved immutable
artifact built from that commit:

```powershell
$ReleaseDir = "D:\Apps\Pulse.Ver.Alpha"
Set-Location -LiteralPath $ReleaseDir
git rev-parse HEAD
git status --porcelain=v1
Get-Content -LiteralPath package.json | Select-String '"version"|"node"'
Test-Path -LiteralPath ".next"
Test-Path -LiteralPath "db\schema.sqlite.sql"
```

Expected: exact commit, empty tracked status, application version `1.0.0`,
Node requirement `>=22 <23`, `.next`, and canonical schema present. Do not
copy `db\pulse.sqlite` from a developer machine.

## 3. Approved paths and ACLs

Set the approved values first:

```powershell
$ReleaseDir = "D:\Apps\Pulse.Ver.Alpha"
$DbPath = "<approved external absolute path>\pulse.sqlite"
$DbDir = Split-Path -Parent $DbPath
$BackupDir = "<approved separate backup path>"
$LogDir = "<approved service log path>"
$ServiceName = "PULSE"
$ServiceAccount = "<approved service account>"
$Port = <approved port>
```

Validate the database boundary before creating anything:

```powershell
$releaseFull = [IO.Path]::GetFullPath($ReleaseDir).TrimEnd('\')
$dbFull = [IO.Path]::GetFullPath($DbPath)
if ($dbFull.StartsWith($releaseFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
  throw "PULSE_DB_PATH must be outside the application directory."
}
New-Item -ItemType Directory -Force -Path $DbDir,$BackupDir,$LogDir | Out-Null
Get-Acl -LiteralPath $ReleaseDir | Format-List Owner,Access
Get-Acl -LiteralPath $DbDir | Format-List Owner,Access
Get-Acl -LiteralPath $BackupDir | Format-List Owner,Access
```

Grant only the required permissions using the approved account:

```powershell
icacls $ReleaseDir
icacls $DbDir
icacls $BackupDir
icacls $LogDir
```

The service account requires read/execute on the release directory and
read/write on the database and log directories. Backup ownership/access must
remain separate. Do not grant Local Administrator unless separately approved.

## 4. Database bootstrap and readiness

If `$DbPath` does not exist, do not create it with ad-hoc SQL. Configure the
service environment with:

```text
NODE_ENV=production
PULSE_DB_PATH=<DbPath>
PULSE_SEED_MODE=reference
PULSE_PLAN_YEAR=1405
PULSE_PLAN_START_DATE=1405/01/01
PULSE_PLAN_END_DATE=1405/12/29
PULSE_PLAN_TODAY=<approved reference date>
PULSE_RELEASE_COMMIT=98ed206b98631f2f6b966a3cd5fb0f513c5a4ed6
```

For first provisioning only, add `PULSE_ADMIN_PASSWORD` through the approved
protected service configuration mechanism. Start the application once; the
application creates the canonical schema, release metadata, reference/RBAC
baseline, and administrator. Remove `PULSE_ADMIN_PASSWORD` from the service
environment immediately after successful provisioning.

Verify readiness through the running application:

```powershell
Invoke-WebRequest "http://127.0.0.1:$Port/api/health" -UseBasicParsing
```

Expected: HTTP 200 with `status=ok` and `database=ok`.

If an approved `sqlite3.exe` is available, also run:

```powershell
sqlite3.exe $DbPath "PRAGMA integrity_check;"
sqlite3.exe $DbPath "PRAGMA foreign_key_check;"
```

Expected integrity output is `ok`; foreign-key output is empty.

## 5. Baseline backup

Stop other writers and create the first backup before management data entry:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BaselineBackup = Join-Path $BackupDir "pulse-release1-baseline-$stamp.sqlite"
sqlite3.exe $DbPath ".backup '$BaselineBackup'"
sqlite3.exe $BaselineBackup "PRAGMA integrity_check;"
sqlite3.exe $BaselineBackup "PRAGMA foreign_key_check;"
Get-FileHash -Algorithm SHA256 -LiteralPath $BaselineBackup
```

Record the backup path, checksum, timestamp, and verification output as:
`RELEASE 1 BASELINE BACKUP`.

## 6. Service configuration

Use the approved service manager. With approved NSSM, the configuration shape is:

```powershell
nssm install $ServiceName "C:\Program Files\nodejs\node.exe" `
  "node_modules\next\dist\bin\next start -p $Port"
nssm set $ServiceName AppDirectory $ReleaseDir
nssm set $ServiceName AppExit Default Restart
nssm set $ServiceName AppStdout (Join-Path $LogDir "pulse.stdout.log")
nssm set $ServiceName AppStderr (Join-Path $LogDir "pulse.stderr.log")
nssm set $ServiceName Start SERVICE_AUTO_START
```

Set the environment variables through the approved protected service
configuration path, then assign `$ServiceAccount` as the service identity.
Do not put the administrator password in this command block or in logs.

```powershell
nssm start $ServiceName
Get-Service -Name $ServiceName
Get-Process -Name node
```

## 7. Firewall and access

Inspect existing rules before adding one:

```powershell
Get-NetFirewallRule -Enabled True -Direction Inbound |
  Get-NetFirewallPortFilter |
  Where-Object { $_.LocalPort -eq "$Port" }
Test-NetConnection -ComputerName 127.0.0.1 -Port $Port
```

Only if approved LAN access is required and no rule exists, create the minimum
inbound TCP rule:

```powershell
New-NetFirewallRule -DisplayName "PULSE Release 1 TCP $Port" `
  -Direction Inbound -Protocol TCP -LocalPort $Port `
  -Action Allow -Profile Domain
```

Test from an approved LAN workstation, not from an unrestricted public network.

## 8. Smoke, business, import, restart, and restore

Execute [RELEASE-1-SMOKE-TEST.md](RELEASE-1-SMOKE-TEST.md). Then complete one
realistic Annual Plan 1405 chain:

```text
Department → Person → Goal → Objective → Activity → Action
→ Responsible Person → KPI → Risk → Dependency → Monthly Review
```

Before importing a representative approved workbook, create another online
backup. Upload, review, approve, verify provenance, and confirm reporting.

Restart and validate:

```powershell
Restart-Service -Name $ServiceName
Start-Sleep -Seconds 5
Get-Service -Name $ServiceName
Invoke-WebRequest "http://127.0.0.1:$Port/api/health" -UseBasicParsing
```

For the restore drill, stop the service and restore the verified baseline to a
disposable database path, never over the live database. Run integrity, foreign
key, schema readiness, login, read, and representative-data checks against the
disposable target.

## 9. Activation record

Record:

```text
RELEASE: PULSE Release 1
COMMIT: 98ed206b98631f2f6b966a3cd5fb0f513c5a4ed6
SCHEMA: v1
SERVER: <hostname>
APPLICATION PATH: <path>
DATABASE PATH: <external path>
SERVICE: <service name>
SERVICE ACCOUNT: <account>
PORT: <port>
BASELINE BACKUP: <path>
CHECKSUM: <sha256>
ACTIVATION TIME: <timestamp>
SMOKE TEST: PASS/FAIL
BUSINESS WORKFLOW: PASS/FAIL
RESTART: PASS/FAIL
RESTORE DRILL: PASS/FAIL
```
