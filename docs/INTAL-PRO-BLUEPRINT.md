# INTAL Pro — Professional Data Platform Blueprint

Status: Proposed / Architecture Baseline
Version: 1.0
Date: 2026-10-03

## 1. Purpose

INTAL Pro is the planned professional successor platform for Data Izin Tinggal. It is a controlled rebuild, not a destructive rewrite of the current production application.

The current Apps Script + Google Sheets application remains the Legacy Production system until INTAL Pro passes data parity, functional parity, security, performance, UAT, and production certification gates.

## 2. Core principles

1. One canonical lifecycle.
2. One source of truth for canonical operational data.
3. Contract-first datasets.
4. PostgreSQL as the canonical database for INTAL Pro.
5. Google Sheets remains an import/source adapter, not the canonical database.
6. Read paths are separated from write/import paths.
7. Authorization is enforced at API/application and database layers.
8. Every mutation and sensitive read/export is auditable.
9. Production migration is evidence-driven and reversible.
10. Legacy Production must not be destabilized by V2 development.

## 3. Target architecture

```
Google Sheets / External Sources
          |
          v
     Import Gateway
          |
     Normalize + Validate
          |
          v
     Staging / Quarantine
          |
     Contract Verification
          |
          v
      PostgreSQL
   Canonical Data Layer
          |
   +------+-------+---------+---------+
   |              |         |         |
   v              v         v         v
Dashboard       GIS      Explorer   Reporting
   |              |         |         |
   +--------------+---------+---------+
                  |
              Audit Layer
                  |
          Monitoring / Evidence
```

## 4. Recommended stack

- Frontend: Next.js App Router + TypeScript.
- UI: Tailwind CSS + shadcn/ui.
- Data tables: TanStack Table.
- Charts: Recharts or equivalent.
- GIS: MapLibre GL or Leaflet.
- Database: PostgreSQL, preferably Supabase for the initial platform.
- Authentication: Supabase Auth or equivalent OIDC-compatible identity provider.
- Authorization: application RBAC + PostgreSQL Row Level Security where appropriate.
- Object storage: Supabase Storage or S3-compatible storage for import files/evidence.
- CI/CD: GitHub Actions.
- Hosting: Vercel or equivalent.
- Observability: structured application logs, audit events, deployment evidence, and error monitoring.

## 5. Domain model

The existing contracts remain the starting domain specification.

### Residence Permit Monthly

Dataset key: RESIDENCE_PERMIT_SERVICE_MONTHLY

Business key:
- periode
- kantor_imigrasi

Canonical measures:
- bvk
- voa
- itk
- itk_peralihan
- itas
- itap
- itkt
- alih_status_itk_ke_itas
- alih_status_itas_ke_itap
- abg
- epo
- imk
- skim

Derived:
- total

### Passport Monthly

Dataset key: PASSPORT_SERVICE_MONTHLY

Business key:
- periode
- kantor_imigrasi

Measures:
- biasa_24
- biasa_48
- elektronik_48
- e_polikarbonat

Derived:
- total

## 6. Canonical PostgreSQL boundary

Initial logical entities:

- users
- roles
- permissions
- user_roles
- datasets
- dataset_versions
- dataset_registry
- dataset_contracts
- immigration_offices
- residence_permit_monthly
- passport_service_monthly
- import_batches
- import_rows / import_errors
- audit_logs
- report_runs
- evidence_manifests
- application_settings

The exact physical schema must be finalized through migrations and integration tests before production data migration.

## 7. Application modules

### Executive Dashboard
Cross-service KPIs, period trend, office distribution, data freshness, and governance status.

### Izin Tinggal
Dashboard, Data Explorer, GIS Workspace, Statistics, and export.

### Paspor
Dashboard, Data Explorer, GIS Workspace, Statistics, and export.

### Cross-Service Reporting
Read-only semantic adapter over canonical monthly datasets.

### Import Center
Upload/paste, schema detection, preview, validation, rejection details, commit, evidence, and rollback/quarantine semantics.

### Data Governance
Dataset registry, contract versions, data quality, provenance, lineage, and integrity verification.

### Administration
Users, roles, permissions, reference data, configuration.

### Monitoring
Runtime health, import status, data freshness, deployment provenance, audit activity, and regression evidence.

## 8. Non-goals for the first INTAL Pro release

- Do not introduce individual foreign-national records into the monthly aggregate contract.
- Do not redesign the canonical business keys without an explicit contract migration.
- Do not add speculative AI features.
- Do not migrate production before parity gates pass.
- Do not modify Legacy Production merely to support V2.

## 9. Success criteria

INTAL Pro is production-ready only when:

- canonical data parity is proven;
- row counts, periods, offices, measures, and totals match the certified baseline;
- import validation matches or intentionally supersedes the Legacy contract with evidence;
- RBAC and authorization tests are green;
- database migration is repeatable;
- unit/integration/E2E tests are green;
- performance tests meet agreed thresholds;
- GIS reference integrity is verified;
- exports reconcile to canonical data;
- audit events are complete;
- deployment commit -> artifact -> runtime provenance is verified;
- UAT is signed off;
- rollback procedure is tested.
