# Architecture — Data Izin Tinggal

## Core flow
Browser -> GAS Web App -> Auth/RBAC -> Services -> Google Sheets.

## Core sheets
CONFIG, USERS, ROLES, PERMISSIONS, DATA_DICTIONARY, DATASET_REGISTRY, IMPORT_LOG, AUDIT_LOG.

Dataset sheets use DATA_<SAFE_SCHEMA_KEY>.

## Dataset model
The system is schema-driven and supports multiple governed dataset families:
- `RESIDENCE_PERMIT_SERVICE_MONTHLY` — production baseline.
- `PASSPORT_SERVICE_MONTHLY` — production baseline.

Each dataset family owns its contract/version, grain, business key, normalization, validation, duplicate, audit, export, and backup/verification rules. Do not create one universal table containing service-specific columns.

The current authoritative grain is monthly: one month × immigration office. Daily operational data is a future evolution and must not be reconstructed from monthly data.

## Import pipeline
PASTE -> PARSE -> HEADER/SCHEMA DETECTION -> CONTRACT MATCH -> NORMALIZE -> VALIDATE -> DUPLICATE CHECK -> PREVIEW -> COMMIT -> AUDIT.

For the monthly service contract, the importer normalizes `periode`, office names, integer metrics, and derives `total` from the 13 service metrics. Duplicate business keys (`periode + kantor_imigrasi`) are rejected.

## UI
GIS First production shell:
Dashboard → Peta Sebaran / GIS Workspace → Data Explorer → Laporan & Statistik → Import Workspace → Administrasi → Monitoring.

Analytics/exploration are read-only against canonical datasets. Import and governance operations remain server-side and permission-gated.

## Deployment
GitHub Actions validates/tests source, then clasp pushes and deploys the Apps Script project. Secrets are stored in GitHub, never committed.

## Deployment identity and evidence

The canonical production deployment is pinned to a single Apps Script deployment ID. Each successful production deployment records non-secret release metadata as a GitHub Actions artifact: commit SHA, workflow run ID, Apps Script immutable version, deployment ID, ref, and evidence-contract version. The production smoke result records the same canonical deployment ID and is paired manually with the CI deployment-evidence artifact. This provides release traceability without granting GitHub Actions an Apps Script runtime OAuth credential.

The production smoke remains a controlled runtime gate. CI source validation and production runtime evidence are intentionally separate.

Authorization boundary: the Web App may expose the HTML shell publicly at deployment level, but protected data and mutations must pass `Session.getActiveUser()` → USERS → ROLE → PERMISSIONS → `requirePermission_()`. Production acceptance includes a negative test proving anonymous/unauthorized requests cannot obtain protected data or execute governed mutations.

## Delivery gate
The production dashboard/statistics/map implementation is intentionally blocked until Data Contract v1 has passed first real deployment, import, and verification against the supplied workbook.

## Multi-service expansion blueprint

The application is intended to remain one application while supporting multiple governed service datasets.

The production families are:
- `RESIDENCE_PERMIT_SERVICE_MONTHLY`
- `PASSPORT_SERVICE_MONTHLY`

The UI service selector changes presentation/query scope; it does not merge incompatible schemas.

Each future dataset family must have its own:
- contract/version;
- grain;
- business key;
- normalization rules;
- validation rules;
- duplicate rules;
- audit semantics;
- export semantics;
- backup and verification coverage.

Do not create one universal table containing all service-specific columns.

The detailed blueprint is maintained in `docs/MULTI-SERVICE-BLUEPRINT.md`.

## Future daily-data model

Where operationally needed, daily data should become the source grain and monthly/yearly views should be derived:

```text
Daily records -> daily view
              -> monthly aggregate
              -> yearly aggregate
```

This is a future evolution and does not replace the current verified monthly production contract until an explicit migration plan is approved.

## Current delivery discipline

**Phase 10.2 production certification is CLOSED / PASS as of 2026-10-02.** The certified production baseline is canonical Apps Script immutable version `71`, deployed from main commit `d186faee120aea48f97a063725e105d7d48bd61b`. Production smoke, dashboard regression, seven-workspace UAT, monitoring verification, and unauthorized/anonymous negative authorization testing are complete.

The Phase 10.2 baseline is locked as the production reference. New feature expansion is now permitted through the controlled delivery gate: requirement → contract/architecture impact → minimal implementation → CI → canonical deployment → live UAT → evidence. New work must not silently alter canonical dataset contracts, registry identity, historical baseline, or monthly grain.
