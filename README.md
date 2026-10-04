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

## Temporal data growth contract

The canonical data engine supports two explicit temporal grains:

- Monthly (periodGrain=month): the existing RESIDENCE_PERMIT_SERVICE_MONTHLY and PASSPORT_SERVICE_MONTHLY contracts remain the canonical operational baseline.
- Annual (periodGrain=year): authoritative annual source data uses isolated RESIDENCE_PERMIT_SERVICE_ANNUAL and PASSPORT_SERVICE_ANNUAL contracts.
- Historical monthly data and future monthly data use the same canonical YYYY-MM representation; no schema change is required when adding new periods.
- Historical annual data and future annual data use canonical YYYY.
- Annual values derived from monthly data are exposed only through a read-only annual roll-up seam. They are not written back into the monthly source and are not mixed into cross-service monthly totals.
- Existing monthly schema signatures remain backward-compatible; annual schema identity includes dataset identity, version, and temporal grain so monthly and annual datasets cannot collide in the registry.

This means adding a new year or month is an append-by-business-key operation, not a schema migration. A new source grain is a contract change and must pass CI, forensic review, canonical deployment, and runtime evidence before production use.

## Current application scope
The production application is now a governed monthly-data platform with Residence Permit and Passport dataset isolation and a GIS First workspace shell. **Phase 10.2 production certification is CLOSED / PASS as of 2026-10-02.** Source implementation, CI validation, canonical deployment, production regression, seven-workspace UAT, monitoring verification, and authorization negative testing have been evidenced against canonical Apps Script deployment version `71`.

## Certified production baseline
- Main release commit: `d186faee120aea48f97a063725e105d7d48bd61b`.
- Canonical Apps Script deployment ID: `AKfycbzwhcpZWp8LhyidPFsvqwBQ6ZrgXjEB60NkyNmaQYsiewsvm9uZ_pwPdrG5xZINF2NK`.
- Canonical Apps Script immutable version: `71`.
- Residence baseline: 80 rows / 258,094 services / 8 periods / 10 offices.
- Passport baseline: 80 rows / 327,088 services / 8 periods / 10 offices.
- Combined service volume: 585,182.
- Production smoke and dashboard regression: PASS with `failedChecks: []`.
- Authorization negative test: unregistered authenticated user is denied protected application data; anonymous access is denied at the authentication boundary.

## Future-feature gate
Phase 10.2 certification is closed. New features may now enter the controlled delivery gate: requirement → contract/architecture impact → minimal implementation → CI → canonical deployment → live UAT → evidence. The canonical monthly production baseline must remain unchanged unless an explicit contract/migration gate is approved.

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

The repository is the source of truth; avoid manual source edits in the Apps Script editor after CI/CD is active. Do not add a new persistent dataset or alter an existing contract implicitly through a UI feature.