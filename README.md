# Data Izin Tinggal

Aplikasi pengelolaan, monitoring, statistik, pemetaan, import otomatis, RBAC, dashboard, audit trail, dan deployment CI/CD untuk data layanan izin tinggal keimigrasian.

## Target Platform
- Google Apps Script
- Google Sheets
- GitHub Actions
- clasp

## Prinsip
- Schema-driven dataset registry.
- Setiap dataset memiliki contract/version dan business key yang eksplisit.
- Paste tabel -> schema detection -> normalization -> preview -> validasi -> commit.
- Dataset sheet dibuat otomatis bila schema baru yang disetujui dikenali.
- Dashboard, statistik, pencarian, dan peta membaca registry/data contract.
- RBAC dan authorization diperiksa di server-side Apps Script.
- Audit trail untuk perubahan penting.
- GitHub menjadi source of truth.

## Data Contract v1

Contract nyata pertama adalah `RESIDENCE_PERMIT_SERVICE_MONTHLY`.

- Grain: satu bulan × satu kantor imigrasi.
- Business key: `periode + kantor_imigrasi`.
- Coverage sumber yang diaudit: Januari–Agustus 2026.
- Operational rows: 80.
- Monthly `JUMLAH` rows tidak diimport.
- `total` dihitung ulang dari 13 metrik layanan dan divalidasi terhadap nilai sumber bila diberikan.
- Kolom sumber tambahan paling kanan di luar B:Q tidak menjadi bagian contract v1.

Lihat `docs/DATA-CONTRACT-v1.md` untuk contract lengkap.

## Roadmap
1. GAS foundation
2. Login + RBAC
3. Data dictionary + dataset registry
4. Paste/import engine + Data Contract v1
5. First real deployment + import + verification
6. Dashboard + statistik
7. Pemetaan
8. Admin + audit
9. CI/CD hardening

Dashboard/statistik/map **tidak dikembangkan lebih lanjut sebelum first real deployment, import 80 row, dan verifikasi contract selesai**.

## Quick start — Apps Script

1. Create a Google Spreadsheet as the database.
2. Create a bound Apps Script project or Apps Script project connected to the repository source.
3. Push the `gas/` directory with clasp.
4. In Apps Script, run `setupApp()` once.
5. Run `bootstrapAdmin("email@domain", "Administrator")` once while the USERS sheet is empty.
6. Deploy as Web App and use the Google account registered in USERS.
7. Prepare the normalized Data Contract v1 table and paste it into Import Center.
8. Preview, verify 80 rows, then commit once.

### Security note
The first implementation uses Google account identity via `Session.getActiveUser()`; it deliberately does not store plaintext passwords. Authorization is enforced server-side through USERS -> ROLES -> PERMISSIONS.

## First real deployment gate

Before building complex dashboard/statistics/map features, the project must pass this sequence:

1. Prepare the real Google Spreadsheet containing residence-permit service data.
2. Use `docs/DATA-CONTRACT-v1.md` to normalize the eight monthly sheets into one 80-row flat table.
3. Create/open the Apps Script project that will own this application and record its Script ID.
4. Enable the Apps Script API for the Google account used by `clasp`.
5. Configure GitHub Actions production secrets:
   - `APPS_SCRIPT_ID`
   - `CLASPRC_JSON`.
6. Deploy from `main` after the contract branch is reviewed/merged.
7. Run `setupApp()` once against the real database spreadsheet.
8. Run `bootstrapAdmin()` once while `USERS` is empty.
9. Preview/import the normalized 80-row contract.
10. Verify dataset row count, duplicate count, rejected rows, and derived totals.
11. Only after that contract is stable, implement the production dashboard, statistics, filters, and map layers.

The repository is the source of truth; avoid manual source edits in the Apps Script editor after CI/CD is active.