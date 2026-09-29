# Architecture — Data Izin Tinggal

## Core flow
Browser -> GAS Web App -> Auth/RBAC -> Services -> Google Sheets.

## Core sheets
CONFIG, USERS, ROLES, PERMISSIONS, DATA_DICTIONARY, DATASET_REGISTRY, IMPORT_LOG, AUDIT_LOG.

Dataset sheets use DATA_<SAFE_SCHEMA_KEY>.

## Import pipeline
PASTE -> PARSE -> HEADER/SCHEMA DETECTION -> DATASET REGISTRY -> VALIDATE -> PREVIEW -> COMMIT -> AUDIT -> REFRESH ANALYTICS.

## UI
Login, Dashboard, Data Explorer, Import Center, Maps, Administration.

## Deployment
GitHub Actions validates/tests source, then clasp pushes and deploys the Apps Script project. Secrets are stored in GitHub, never committed.