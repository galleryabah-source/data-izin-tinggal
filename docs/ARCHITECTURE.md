# Architecture — Data Izin Tinggal

## Core flow
Browser -> GAS Web App -> Auth/RBAC -> Services -> Google Sheets.

## Core sheets
CONFIG, USERS, ROLES, PERMISSIONS, DATA_DICTIONARY, DATASET_REGISTRY, IMPORT_LOG, AUDIT_LOG.

Dataset sheets use DATA_<SAFE_SCHEMA_KEY>.

## Dataset model
The system is schema-driven and supports more than one dataset family. The first real contract is `RESIDENCE_PERMIT_SERVICE_MONTHLY`, whose grain is one month × immigration office. Individual residence-permit records, if introduced later, must use a separately versioned contract rather than altering this dataset.

## Import pipeline
PASTE -> PARSE -> HEADER/SCHEMA DETECTION -> CONTRACT MATCH -> NORMALIZE -> VALIDATE -> DUPLICATE CHECK -> PREVIEW -> COMMIT -> AUDIT.

For the monthly service contract, the importer normalizes `periode`, office names, integer metrics, and derives `total` from the 13 service metrics. Duplicate business keys (`periode + kantor_imigrasi`) are rejected.

## UI
Login, Dashboard, Data Explorer, Import Center, Maps, Administration.

## Deployment
GitHub Actions validates/tests source, then clasp pushes and deploys the Apps Script project. Secrets are stored in GitHub, never committed.

## Deployment identity and evidence

The canonical production deployment is pinned to a single Apps Script deployment ID. Each successful production deployment records non-secret release metadata as a GitHub Actions artifact: commit SHA, workflow run ID, Apps Script immutable version, deployment ID, ref, and evidence-contract version. The production smoke result records the same canonical deployment ID and is paired manually with the CI deployment-evidence artifact. This provides release traceability without granting GitHub Actions an Apps Script runtime OAuth credential.

The production smoke remains a controlled manual gate. CI source validation and production runtime evidence are intentionally separate.

## Delivery gate
The production dashboard/statistics/map implementation is intentionally blocked until Data Contract v1 has passed first real deployment, import, and verification against the supplied workbook.

## Multi-service expansion blueprint

The application is intended to remain one application while supporting multiple governed service datasets.

Initial planned families:
- `RESIDENCE_PERMIT_SERVICE_MONTHLY` — current production baseline.
- `PASSPORT_SERVICE_MONTHLY` — future family, design only at this stage.

The UI may expose a service selector such as **All Services / Residence Permit / Passport**, but the underlying datasets remain isolated. A service selection changes presentation/query scope; it does not merge incompatible schemas.

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

The multi-service blueprint is a roadmap, not an instruction to implement everything immediately. Current work remains focused on preserving the canonical production pipeline and closing its runtime evidence gate before feature expansion.
