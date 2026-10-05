# Dasmon Imigrasi

## Project Charter

Dasmon Imigrasi adalah rancangan **professional V2** untuk platform data, dashboard, GIS, reporting, governance, dan monitoring layanan keimigrasian.

> Domain dan evidence dari Data Izin Tinggal dipertahankan; implementation layer dibangun ulang secara modular.

### Relationship dengan aplikasi lama
- Source/reference: Data Izin Tinggal (data-izin-tinggal)
- Target architecture: Dasmon Imigrasi
- Production lama tidak dimodifikasi oleh blueprint ini.
- Google Sheets/Apps Script menjadi legacy adapter/import source, bukan database jangka panjang.
- Canonical domain contracts tetap menjadi sumber kebenaran bisnis selama migrasi.

### Target stack
- Web: Next.js + TypeScript
- UI: Tailwind CSS + shadcn/ui
- Data: PostgreSQL / Supabase
- Auth: managed authentication + RBAC
- GIS: PostGIS + MapLibre/Leaflet
- Validation: Zod/domain validators
- Testing: unit + integration + E2E + regression
- Delivery: GitHub CI/CD + staging + production
- Observability: structured logs, audit trail, health/readiness

### Initial domains
1. Executive Dashboard
2. Izin Tinggal
3. Paspor
4. Cross-Service Reporting
5. Data Explorer
6. GIS Workspace
7. Import Center
8. Reports & Statistics
9. Data Governance
10. Administration
11. Monitoring
12. Evidence & Audit

### Non-goals
- Tidak mengganti production lama secara langsung.
- Tidak memindahkan data tanpa provenance dan parity verification.
- Tidak menambahkan fitur tanpa domain contract.
- Tidak membuat second source of truth.

### Success condition
Dasmon Imigrasi hanya menjadi production successor setelah contract parity, data parity, functional parity, security gate, performance gate, UAT, dan production evidence terpenuhi.
