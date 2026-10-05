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

> **Reconciled 2026-10-05 against canonical production runtime.** Historical certification figures are retained below for traceability and are not the current runtime baseline.

The current production baseline is verified against the real Web App and production spreadsheet:

- dataset: `RESIDENCE_PERMIT_SERVICE_MONTHLY`
- source sheet: `DATA_RESIDENCE_PERMIT_SERVICE_MONTHLY`
- 90 operational rows
- 16 columns
- 9 monthly periods
- 10 immigration offices
- grand total: 291,730 services
- duplicate business keys: 0
- blank business keys: 0
- invalid periods: 0
- invalid measures: 0
- total mismatches: 0
- latest import: 10 accepted / 0 rejected / 0 duplicates / SUCCESS
- export verification: 90 rows / 291,730 services
- backup snapshot verification: source, snapshot, and manifest checksums match
- automated production smoke test: PASS (16/16)

### Passport current production verification baseline — reconciled 2026-10-05

- dataset: `PASSPORT_SERVICE_MONTHLY`
- source sheet: `DATA_PASSPORT_SERVICE_MONTHLY`
- 90 operational rows
- 7 columns
- 9 monthly periods
- 10 immigration offices
- grand total: 373,839 services
- duplicate business keys: 0
- blank business keys: 0
- invalid periods: 0
- invalid measures: 0
- total mismatches: 0
- latest import: 10 accepted / 0 rejected / 0 duplicates / SUCCESS
- matching `IMPORT_COMMIT` audit evidence: 1
- CSV export: 90 rows / 373,839 services
- backup snapshot: checksum, manifest, schema, row-count, and source/snapshot equality verified
- dashboard runtime: 90 rows / 373,839 services / 9 periods / 10 offices
- dashboard regression smoke: PASS

### Historical certification baseline

The previously certified Phase 10.2 figures — Residence 80 / 258,094 and Passport 80 / 327,088 — remain historical reference evidence only. They are superseded as the current runtime baseline by the 2026-10-05 monthly production state.

## Phase 10.2 certification gate

**Status: CLOSED / PASS — 2026-10-02.**

Evidence chain: main release commit `d186faee120aea48f97a063725e105d7d48bd61b` → GitHub Actions production deployment → Apps Script immutable version `71` → canonical deployment ID → production smoke PASS → dashboard regression PASS → AUDIT_LOG/runtime evidence → seven-workspace UAT → authorization negative test PASS.

Certified baseline:
- Residence: 80 rows / 258,094 / 8 periods / 10 offices.
- Passport: 80 rows / 327,088 / 8 periods / 10 offices.
- Combined service volume: 585,182.
- Production smoke: `ok=true`, `failedChecks=[]`.
- Dashboard regression: `ok=true`, `failedChecks=[]`.
- Authorization: anonymous/unauthorized access denied; protected canonical data not exposed.

The Phase 10.2 baseline is now locked as the production reference. Future feature work must preserve this baseline and follow the controlled delivery gate.

## Current gate

The production baseline is now verified end-to-end for both the existing Residence Permit dataset and the Passport dataset. Map v1, Export Verification v1, Backup Snapshot Verification v1, Automated Production Smoke Test v1, Passport governance/runtime regression gates, and the GIS First production UI baseline have passed their verification gates.

The current source model is monthly. The next work therefore remains controlled hardening and maintenance of the canonical monthly pipeline, followed by Phase 10 capabilities that operate on authoritative monthly data. Daily operational data is explicitly deferred until an authoritative daily source becomes available.

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

### Phase 10 — Authoritative monthly analytics and application workspaces

**Status:** Phase 10.1 runtime gate **CLOSED / PASS** as of 2026-09-30.

- [x] Define cross-service reporting contract v1
- [x] Implement read-only `service_volume` semantic adapter
- [x] Add production regression gate for cross-service reporting
- [x] Deploy canonical Phase 10.1 runtime
- [x] Execute live production Regression Smoke
- [x] Verify `cross_service_reporting.ok === true`
- [x] Verify Residence baseline: 80 rows / 258,094 / 8 periods / 10 offices
- [x] Verify Passport baseline: 80 rows / 327,088 / 8 periods / 10 offices
- [x] Build functional GIS First Data Explorer workspace
- [x] Build dedicated GIS workspace
- [x] Build cross-service reporting workspace
- [x] Build production-grade Import workspace
- [x] Build Administration workspace
- [x] Build Monitoring workspace
- [x] Production UAT: verify all seven workspaces
- [x] Security negative test: unauthorized/anonymous access is denied
- [x] Runtime evidence: regression smoke PASS against deployed Phase 10.2 release
- [x] Reconcile production documentation/evidence

**Phase 10.1 boundary:** read-only semantic reporting only. No new persistent dataset, source-contract change, importer change, registry identity change, historical-data change, or daily reconstruction.


## Phase 10.3 certification gate

**Status: CLOSED / PASS — 2026-10-02.**

Phase 10.3 service-aware geographic analytics is certified against the canonical production deployment.

Evidence chain:
- GIS runtime repair merged at main commit `fe4665b5cedb0263b00d6b5fa9085db676dc1e72`.
- GitHub Actions production deployment Run #215: PASS.
- Canonical Apps Script immutable version: `74`.
- Residence GIS service-aware metric runtime UAT: PASS.
- Passport GIS service-aware metric runtime UAT: PASS, with production evidence showing **Elektronik 48 = 25,255** and the same office's **Total layanan = 29,506**, while the Passport baseline remains **80 rows / 327,088 services / 8 periods**.
- Static forensic scan: PASS; metric resolution is isolated to the shared map seam, Residence export remains free of map-only metric state, and Office Reference remains VERIFIED/read-only.
- No dataset, importer, registry identity, historical baseline, or canonical data lifecycle changes were introduced by Phase 10.3.

Phase 10.3 is now closed. The next controlled capability is the presentation-only **INTAL TV Design No. 6**, which must continue to consume the canonical analytics engine without creating a second data path.

### Phase 10 — Advanced platform capabilities
- [ ] Cross-service reporting where metrics are semantically compatible
- [ ] Advanced drill-down and analytics
- [x] Service-aware geographic analytics — Phase 10.3 CLOSED / PASS
- [ ] Document / knowledge integration
- [ ] Controlled notifications and automation
- [ ] INTAL TV Design No. 6 — presentation-only command display

**Implementation rule:** future phases remain gated. No future service is enabled merely because it is documented. A new dataset family must pass contract, validation, deployment, integrity, export, backup, and runtime evidence gates without weakening the existing production baseline.
