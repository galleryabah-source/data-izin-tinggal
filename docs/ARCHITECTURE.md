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

Phase 10.2 certification remains a historical certification record. It is not the current deployment pointer. The current production deployment evidence is maintained by the canonical GitHub Actions deployment workflow and must always be read as:

main commit → GitHub Actions run → Apps Script immutable version → canonical deployment ID → runtime evidence.

The latest audited production deployment at the time of this documentation reconciliation is main commit 052cebfc131ab0a06e559159333f5da083bf089f, GitHub Actions run 37117703787 (run #412), with deployment evidence archived as artifact deployment-evidence-37117703787. The immutable Apps Script version is intentionally not hard-coded here; the deployment artifact is the authoritative release record.

New feature expansion remains subject to the controlled delivery gate: requirement → contract/architecture impact → minimal implementation → CI → canonical deployment → live UAT → evidence. New work must not silently alter canonical dataset contracts, registry identity, historical baseline, or monthly grain.

### INTAL TV Design No. 6

INTAL TV is implemented as a presentation-only command display over the canonical analytics engine. It does not introduce a second canonical data path, dataset, importer, registry identity, or historical baseline. Runtime UAT remains a separate acceptance gate and must be evidenced against the canonical production deployment.
