# Dasmon Imigrasi — System Blueprint

## 1. Vision
Platform web profesional untuk mengelola, mengeksplorasi, memetakan, memverifikasi, dan melaporkan data layanan keimigrasian dengan satu canonical data lifecycle.

## 2. Canonical lifecycle
```
Source
  ↓
Ingestion
  ↓
Normalization
  ↓
Contract Validation
  ↓
Staging
  ↓
Integrity Verification
  ↓
Canonical PostgreSQL
  ↓
Analytics / GIS / Reporting
  ↓
Audit + Evidence
```

Tidak boleh ada modul production yang melewati canonical layer.

## 3. Layer architecture
```
Presentation — Next.js / TypeScript
        ↓
Application — API / use-cases
        ↓
Domain — contracts / validation / rules
        ↓
Data — PostgreSQL / PostGIS
        ↓
Integration — Sheets / Drive / imports
```

## 4. Domain boundary
### Dataset
dataset_contract, dataset_registry, schema_version, business_key, provenance

### Import
import_batch, import_rows, validation_errors, commit event

### Analytics
monthly aggregates, service measures, cross-service semantic adapter

### GIS
office reference, coordinates, verification status, metric overlays

### Governance
RBAC, audit log, evidence, release certification

## 5. Canonical contracts retained from V1
Residence: RESIDENCE_PERMIT_SERVICE_MONTHLY  
Business key: periode + kantor_imigrasi  
Passport: PASSPORT_SERVICE_MONTHLY

Contract definitions are authoritative inputs to V2 migration and must be versioned.

## 6. Security
```
Identity
  ↓
Role
  ↓
Permission
  ↓
API authorization
  ↓
Database policy / RLS
  ↓
Audit event
```

UI permission checks are convenience only; authorization must exist server-side.

## 7. Frontend information architecture
Dashboard; Izin Tinggal; Paspor; Cross-Service; Data Explorer; GIS Workspace; Import Center; Reports; Governance; Administration; Monitoring.

## 8. UX principles
- GIS First for geographic analytics.
- Filter state explicit and shareable.
- KPI exposes period and provenance.
- Tables use server-side pagination/filtering.
- Data-changing operations require confirmation and audit.
- Loading/error/empty states are first-class.
- Responsive desktop/tablet/mobile.
- WCAG 2.2 AA target where practical.

## 9. Performance targets
Initial targets: cached dashboard <1.5s p95; filtered table <2s p95; map query <2s p95. These become gates only after staging measurement.

## 10. Reliability
Every canonical write is authenticated, authorized, validated, idempotency-aware, audited, and observable.

## 11. Evidence
Every release identifies source → commit → build → deployment → database migration → runtime verification.
