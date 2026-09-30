# Roadmap

## Phase 1 — Foundation
- [x] Apps Script skeleton
- [x] config
- [x] routing
- [x] base UI

## Phase 2 — Security
- [x] Google identity/session
- [x] RBAC
- [x] deny-by-default

## Phase 3 — Data engine
- [x] Data dictionary
- [x] schema signatures
- [x] dynamic dataset registry
- [x] automatic sheet creation

## Phase 4 — Import
- [x] paste parser
- [x] validation
- [x] duplicate detection
- [x] preview/commit
- [x] first real import: 80 operational rows
- [x] end-to-end integrity verification

## Phase 5 — Intelligence UI
- [x] Dashboard v1: KPI, monthly totals, office totals, service totals
- [x] dashboard filters — period + immigration office, server-side, UAT validated
- [x] drill-down
- [x] map readiness — Office Reference v1 (10 offices verified; readiness gate `ready=true`)
- [x] Map v1 — read-only Leaflet map driven by verified Office Reference and dashboard filters

## Phase 6 — Governance
- [x] audit log
- [x] admin bootstrap
- [x] governed CSV export
- [x] Export Verification v1 — production verified: all dataset, January 2026, KANIM KELAS I NON TPI BOGOR
- [x] Drive backup snapshot v1
- [x] Backup Snapshot Verification v1 — production verified with manifest, checksum, schema, row-count, and cell-level equality

## Phase 7 — CI/CD
- [x] clasp
- [x] GitHub Actions
- [x] hosted runner path
- [x] production deployment
- [x] canonical Apps Script deployment ID
- [x] CI action runtime hardening
- [x] automated source-level smoke checks
- [x] Automated Production Smoke Test v1 — production verified

## Production verification baseline

The current production baseline is verified against the real Web App and production spreadsheet:

- dataset: `RESIDENCE_PERMIT_SERVICE_MONTHLY`
- source sheet: `DATA_RESIDENCE_PERMIT_SERVICE_MONTHLY`
- 80 operational rows
- 16 columns
- 8 monthly periods
- 10 immigration offices
- grand total: 258,094 services
- duplicate business keys: 0
- blank business keys: 0
- total mismatches: 0
- latest import: 80 accepted / 0 rejected / 0 duplicates
- export verification: 80 rows / 258,094 services
- backup snapshot verification: source, snapshot, and manifest checksums match
- automated production smoke test: PASS

### Passport production verification baseline

The Passport dataset is now verified against the real production Web App and production spreadsheet:

- dataset: `PASSPORT_SERVICE_MONTHLY`
- source sheet: `DATA_PASSPORT_SERVICE_MONTHLY`
- 80 operational rows
- 7 columns
- 8 monthly periods
- 10 immigration offices
- grand total: 327,088 services
- duplicate business keys: 0
- blank business keys: 0
- total mismatches: 0
- latest import: 80 accepted / 0 rejected / 0 duplicates / SUCCESS
- matching `IMPORT_COMMIT` audit evidence: 1
- CSV export: 80 rows
- backup snapshot: checksum, manifest, schema, row-count, and source/snapshot checksum match
- dashboard runtime: 80 rows / 327,088 services / 8 periods / 10 offices
- dashboard regression smoke: Residence Permit + Passport PASS

## Current gate

The production baseline is now verified end-to-end for both the existing Residence Permit dataset and the Passport dataset. Map v1, Export Verification v1, Backup Snapshot Verification v1, Automated Production Smoke Test v1, Passport governance/runtime regression gates, and the GIS First production UI baseline have passed their verification gates.

The current source model is monthly. The canonical monthly engine hardening gate is now closed by live production Regression Smoke: `dataset_registry_identity`, dashboard, drilldown, Office Reference, and map checks all returned `ok: true` with no failed checks on 2026-09-30. The next work may therefore enter Phase 10 in a controlled, capability-gated manner using authoritative monthly data. Daily operational data remains explicitly deferred until an authoritative daily source becomes available.

The deployment identity evidence chain remains part of the gate: Git commit SHA -> GitHub Actions run -> Apps Script immutable version -> canonical deployment ID -> production smoke -> AUDIT_LOG -> backup snapshot.

## Future platform expansion — planned, not yet implemented

### Phase 8 — Multi-service blueprint
- [x] Document single-application / multi-dataset architecture
- [x] Define service selector concept: All / Residence Permit / Passport
- [x] Define dataset isolation and cross-service query boundaries
- [x] Define phased roadmap for Passport Services
- [x] Implement Passport dataset contract
- [x] Implement Passport import/validation
- [x] Integrate Passport into dashboard
- [x] Integrate service-scoped export and backup
- [x] Extend production smoke verification

### Phase 9 — Daily operational data — DEFERRED
**Status:** Deferred — authoritative daily source not available.

**Reason:** The current authoritative operational sources are monthly. The existing monthly contracts do not contain sufficient temporal information to reconstruct authoritative daily records.

**Non-goals while deferred:**
- no synthetic daily records;
- no daily table derived from monthly totals;
- no daily contract implementation;
- no daily lifecycle/correction workflow;
- no daily-to-monthly aggregation;
- no migration of the historical monthly baseline into a fabricated daily model.

**Activation condition:** Resume Phase 9 only when an authoritative daily operational source and its business semantics are available and pass a source audit.

- [x] Draft Phase 9 daily operational contract/lifecycle design (design gate only)
- [x] Define proposed period closing / correction workflow (design gate only)
- [x] Prepare Gate 9.1 operational source audit worksheet
- [ ] Obtain authoritative daily source/workflow and pass Gate 9.1
- [ ] Approve exact daily source-specific contract
- [ ] Implement daily lifecycle and revision/correction workflow
- [ ] Derive monthly and yearly aggregates from approved daily records
- [ ] Reconcile daily-derived periods against historical monthly baselines
- [ ] Preserve historical monthly baseline and migration traceability

### Phase 10 — Advanced platform capabilities
- [ ] Cross-service reporting where metrics are semantically compatible
- [ ] Advanced drill-down and analytics
- [ ] Service-aware geographic analytics
- [ ] Document / knowledge integration
- [ ] Controlled notifications and automation

**Implementation rule:** future phases remain gated. No future service is enabled merely because it is documented. A new dataset family must pass contract, validation, deployment, integrity, export, backup, and runtime evidence gates without weakening the existing production baseline.
