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