# PULSE Release 1 — Operator Smoke Test

Run this checklist against the actual Windows Server service. Record the date,
operator, URL, release commit, database path (without secrets), and backup
checksum in the change record.

| Step | Check | Expected result | Evidence |
|---|---|---|---|
| START | Start/restart the approved service | Service reaches Running; no startup error | Service status/log |
| HEALTH | `GET /api/health` | HTTP 200; `status=ok`; `database=ok` | Response |
| LOGIN | Open `/login` and sign in with the provisioned account | Dashboard opens; no credential is logged | Screenshot or operator note |
| DASHBOARD | Open `/` and `/program` | Current 1405 dashboard and hierarchy render | Operator note |
| READ | Open goals, objectives, activities, actions, KPIs, risks, dependencies | Lists load without server/database errors | Operator note |
| CREATE | Create one controlled test action under an approved goal | New record is accepted | Record ID |
| EDIT | Change its title/status/progress | Save succeeds and validation is clear | Record ID |
| RELOAD | Refresh the page and reopen the record | Edited values remain | Record ID |
| REPORT | Open `/reports`; request PDF and XLSX | Governed report loads; both exports download | File names |
| IMPORT | Upload an approved XLSX sample; review; reject or approve per change plan | Durable import job appears and review state is visible | Job ID |
| BACKUP | Run the approved SQLite online backup procedure | Backup exists and passes integrity/FK/schema checks | Path/checksum |
| RESTART | Restart the service | Health returns 200 again | Service/log |
| READ AGAIN | Reopen the created record and report | Data persists after restart and is reportable | Record ID/report |

The controlled test action must be identified and removed or retained according
to the change record. Never use a real management record as a disposable test.

## Windows command template

Replace every angle-bracket value before execution. Do not paste secrets into
the command line.

```powershell
$PulseUrl = "http://127.0.0.1:<PORT>"
Invoke-WebRequest "$PulseUrl/api/health" -UseBasicParsing
Get-Service -Name "<SERVICE_NAME>"
Get-FileHash -Algorithm SHA256 -LiteralPath "<BACKUP_FILE>"
```

The repository cannot validate the actual Windows Server service, ACL, firewall,
or approved service manager from this workstation. Those checks belong in the
operator evidence for the deployment.
