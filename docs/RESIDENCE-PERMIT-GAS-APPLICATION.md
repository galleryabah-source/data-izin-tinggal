# Residence Permit Intelligence — Google Apps Script Application Blueprint

## 1. Tujuan

Membangun aplikasi operasional berbasis Google Apps Script (GAS) yang menjadikan Google Spreadsheet sebagai data store utama untuk data izin tinggal keimigrasian, dengan UI web responsif, dashboard interaktif, peta, statistik, pencarian/filter, import data berbasis paste, RBAC, audit trail, dan deployment yang dikendalikan dari GitHub.

Aplikasi ini adalah modul operasional/data-management, bukan pengambil keputusan otomatis. Analitik ditampilkan sebagai informasi pendukung dan setiap perubahan data penting dapat dilacak.

## 2. Arsitektur

Browser -> GAS Web App (HTMLService) -> Auth/Session/RBAC, Dashboard/Maps/Analytics, Import/Validation/Schema detection, CRUD/Search/Export, Audit -> Google Spreadsheet.

Core sheets: CONFIG, USERS, ROLES, PERMISSIONS, DATA_DICTIONARY, IMPORT_LOG, AUDIT_LOG, DATASET_REGISTRY. Dataset sheets memakai pola DATA_<SAFE_SCHEMA_KEY>.

Sistem memakai dataset registry: satu jenis dataset memiliki signature/schema yang stabil. Sheet baru dibuat otomatis saat signature baru dikenali; impor berikutnya dengan schema sama masuk ke dataset yang sama sehingga dashboard membaca registry, bukan nama sheet hardcoded.

## 3. Modul UI

### Login
- Username/email.
- Session timeout.
- Logout.
- Deny-by-default.

### Dashboard
- Total izin tinggal.
- Aktif/berakhir/akan berakhir.
- Distribusi jenis izin.
- Distribusi kewarganegaraan.
- Distribusi wilayah/kantor.
- Tren bulanan.
- Data-quality indicators.
- Last refresh/import.
- Drill-down mengikuti filter.

### Data Explorer
- Global search.
- Filter multi-kolom.
- Pagination dan sort.
- Detail record.
- Export sesuai permission.

### Import Center
- Paste area untuk blok tabel.
- Preview.
- Auto-detect delimiter/header/schema.
- Normalisasi tanggal/angka/whitespace sesuai aturan.
- Validasi mandatory column.
- Duplicate detection.
- Dry-run lalu commit.
- Import log dan batch ID.

### Maps
- Titik berdasarkan kantor/wilayah atau koordinat bila tersedia.
- Clustering.
- Filter mengikuti dashboard.
- Popup ringkas.

### Administration
- Users.
- Roles.
- Permissions.
- Dataset registry.
- Data dictionary.
- Audit log.
- Configuration.

## 4. RBAC

Role awal: ADMIN, SUPERVISOR, OPERATOR, VIEWER, AUDITOR.

Permission granular: dashboard.read, dataset.read, dataset.write, dataset.import, dataset.export, dataset.approve, dataset.delete, map.read, admin.users, admin.roles, admin.config, audit.read.

Semua server-side function wajib memeriksa permission. Menyembunyikan tombol di UI bukan authorization.

## 5. Import-by-paste workflow

PASTE -> PARSE -> HEADER DETECTION -> SCHEMA MATCH -> CREATE/UPDATE DATASET -> VALIDATE -> PREVIEW -> COMMIT -> REINDEX -> REFRESH -> AUDIT.

Schema baru membuat sheet DATA_<SAFE_SCHEMA_KEY> dan entry di DATASET_REGISTRY. Schema lama diarahkan ke dataset terdaftar.

Contoh canonical fields: no, no_paspor, nama, jenis_izin_tinggal, tanggal_terbit, tanggal_berakhir, kewarganegaraan, kantor, provinsi, kabupaten_kota, latitude, longitude, status, source.

## 6. Data dictionary

Setiap field menyimpan canonical_key, display_name, aliases[], data_type, required, enum_values[], transform, pii_classification, searchable, aggregatable, map_role, version.

## 7. Derived analytics

active_count, expiring_30d, expiring_90d, expired_count, by_jenis_izin, by_kewarganegaraan, by_kantor, by_province, monthly_issuance, data_quality_rate, import_volume, duplicate_rate.

Semua analytics membaca dataset registry dan canonical schema.

## 8. Audit

Audit record: event_id, timestamp, actor, action, dataset, batch_id, affected_rows, status, error_summary, source_context, before_hash, after_hash bila relevan.

Import log: batch_id, actor, received_at, dataset_key, schema_version, source_label, row_count, accepted, rejected, duplicate, status.

## 9. GAS source layout

gas/appsscript.json, Code.gs, Config.gs, Auth.gs, Rbac.gs, Router.gs, ImportService.gs, SchemaService.gs, DatasetService.gs, DashboardService.gs, AnalyticsService.gs, MapService.gs, AuditService.gs, ValidationService.gs, Utils.gs, index.html, login.html, dashboard.html, data.html, import.html, admin.html, styles.html, js.html.

## 10. GitHub -> Apps Script deployment

GitHub adalah source of truth. Pull request menjalankan lint/unit/schema tests. Branch deployment yang berhasil melakukan clasp push lalu clasp deploy. Production sebaiknya memakai GitHub Environment protection/approval.

Jangan commit service-account JSON atau OAuth secrets. Rekomendasi autentikasi CI: GitHub OIDC -> Google Cloud Workload Identity Federation bila tersedia. Alternatif: credential deployment terenkripsi di GitHub Secrets dan dirotasi.

## 11. CI stages

validate -> test -> package -> deploy-staging -> smoke-test -> deploy-production.

## 12. Non-functional requirements

- Asia/Jakarta timezone.
- Responsive desktop/mobile.
- Batch Spreadsheet calls, bukan per-cell loops.
- CacheService untuk agregat mahal.
- LockService untuk concurrent import.
- Input/row limits.
- Structured logging.
- Least privilege dan data minimization.
- Backup/export strategy.

## 13. MVP acceptance criteria

- Login dan RBAC berfungsi.
- ADMIN dapat mengelola user/role.
- User dapat paste tabel dan preview.
- Schema terdeteksi otomatis.
- Dataset sheet dibuat/terdaftar otomatis bila schema baru.
- Valid rows masuk dan rejected rows dilaporkan.
- Dashboard, statistik, dan peta mengambil data baru tanpa rewrite formula manual.
- Import tercatat di audit log.
- GitHub PR menjalankan CI.
- Merge ke branch deployment memicu deployment Apps Script.
- Hasil deployment terlihat di Actions.

## 14. Implementation order

Phase 1: GAS foundation + repository + CI.
Phase 2: Auth/RBAC.
Phase 3: Data dictionary + dynamic dataset registry.
Phase 4: Paste/import engine.
Phase 5: Dashboard/statistics.
Phase 6: Map module.
Phase 7: Admin/audit.
Phase 8: staging/prod deployment and smoke tests.

Catatan penting: sebelum produksi, gunakan nama kolom dan contoh baris nyata dari spreadsheet pengguna sebagai canonical initial schema. Blueprint sengaja schema-driven agar format tabel baru yang disetujui dapat ditambahkan tanpa menulis ulang dashboard.