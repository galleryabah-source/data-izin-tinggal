# Data Izin Tinggal

Aplikasi pengelolaan, monitoring, statistik, pemetaan, import otomatis, RBAC, dashboard, audit trail, dan deployment CI/CD untuk data izin tinggal keimigrasian.

## Target Platform
- Google Apps Script
- Google Sheets
- GitHub Actions
- clasp

## Prinsip
- Schema-driven dataset registry.
- Paste tabel -> preview -> validasi -> commit.
- Dataset sheet dibuat otomatis bila schema baru dikenali.
- Dashboard, statistik, pencarian, dan peta membaca registry/data dictionary.
- RBAC dan authorization diperiksa di server-side Apps Script.
- Audit trail untuk perubahan penting.
- GitHub menjadi source of truth.

## Roadmap
1. GAS foundation
2. Login + RBAC
3. Data dictionary + dataset registry
4. Paste/import engine
5. Dashboard + statistik
6. Pemetaan
7. Admin + audit
8. CI/CD GitHub -> Apps Script

Detail arsitektur akan menjadi dokumen utama repository.

## Quick start — Apps Script

1. Create a Google Spreadsheet as the database.
2. Create a bound Apps Script project or Apps Script project connected to the repository source.
3. Push the `gas/` directory with clasp.
4. In Apps Script, run `setupApp()` once.
5. Run `bootstrapAdmin("email@domain", "Administrator")` once while the USERS sheet is empty.
6. Deploy as Web App and use the Google account registered in USERS.
7. Paste tabular data into Import Center; preview before commit.

### Security note

The first implementation uses Google account identity via `Session.getActiveUser()`; it deliberately does not store plaintext passwords. Authorization is enforced server-side through USERS -> ROLES -> PERMISSIONS.
