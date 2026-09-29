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