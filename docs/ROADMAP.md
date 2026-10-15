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

The Phase 10.2 figures remain locked as historical certification evidence. The current production reference is the reconciled 2026-10-05 monthly baseline above. Future feature work must preserve canonical data integrity and follow the controlled delivery gate.

## P0 controlled production hardening

**Status: GREEN — reconciled 2026-10-05.**

- [x] P0.1 Governance & Audit Center v1
- [x] P0.2 Dataset Health Center v1
- [x] P0.3 Backup & Recovery Center v1 — read-only; restore disabled
- [x] P0.4 Production Evidence Center v1
- [x] Reconcile production baseline: Residence 90 / 291,730 / 9 / 10
- [x] Reconcile production baseline: Passport 90 / 373,839 / 9 / 10
- [x] Canonical deployment evidence: Run #485 / merge `ae1a9bed19b81d954745f06e4ae35dd933e4b079`
- [x] Production smoke: 16/16 PASS
- [x] Dashboard regression: 12/12 PASS
- [x] Export verification: Residence + Passport PASS
- [x] Backup verification: Residence + Passport PASS
- [x] Documentation reconciliation: `PRODUCTION-SMOKE-TEST.md` + `ROADMAP.md`

## Current gate

The production baseline is now verified end-to-end for both the existing Residence Permit dataset and the Passport dataset. Map v1, Export Verification v1, Backup Snapshot Verification v1, Automated Production Smoke Test v1, Passport governance/runtime regression gates, and the GIS First production UI baseline have passed their verification gates.

The current canonical source model remains monthly. Phase 9 has a contract/validator foundation in PR #228 for governed daily input for Residence Permit and Passport through one in-app service-selector form. Gate 9.1 is BLOCKED pending owner approval of measure definitions and operational workflow. The feature remains hard-disabled: no daily writes, staging-sheet creation, or daily UI are authorized yet. See [Gate 9.1 Decision Register](PHASE-9-GATE-9.1-DECISION-REGISTER.md). WhatsApp integration is HOLD and is not a dependency. The canonical monthly pipeline remains protected and must stay green.

The deployment identity evidence chain remains part of the gate: Git commit SHA -> GitHub Actions run -> Apps Script immutable version -> canonical deployment ID -> production smoke -> AUDIT_LOG -> backup snapshot.

## Period Closing & Controlled Correction v1

**Status: IMPLEMENTED + DEPLOYED — production certification pending authenticated runtime UAT.**

Purpose: establish explicit monthly data finality before downstream analytics, exports, and operational automation depend on a period.

Evidence: PR #229 merged as `bcc359ad6ac83288e062c14b876a8aecc99c8bb2`; CI/deployment workflow Run #760 passed; Apps Script version 218 deployed to the canonical deployment ID. The PR fixes a reclose-state defect by clearing all reopen metadata when a previously reopened period is closed again. See [PR #229](https://github.com/galleryabah-source/data-izin-tinggal/pull/229) and [workflow Run #760](https://github.com/galleryabah-source/data-izin-tinggal/actions/runs/38722508768).

- [x] Period closure registry (PERIOD_CLOSURES) with dataset + YYYY-MM grain
- [x] Closed periods reject canonical monthly imports at the single commitImport() write seam
- [x] Permission-gated close/reopen actions require a reason
- [x] Controlled correction requires explicit reopen before correction
- [x] PERIOD_CLOSE / PERIOD_REOPEN audit evidence
- [x] Preserve Residence/Passport contracts, registry identity, importer normalization, and historical data lifecycle
- [x] CI regression gate on the exact PR head
- [x] Forensic diff reviewed; only period-closure state reset and its regression assertion changed
- [x] Canonical deployment: Run #760 / Apps Script version 218
- [ ] Authenticated live UAT: close → import denied → reopen → correction allowed → close again
- [ ] Production runtime evidence and final certification

**Important:** workflow success and deployment prove delivery, not authenticated business-flow UAT. Do not mark this gate production-certified until the full live sequence and audit evidence are verified.

**Boundary:** governance state only. No new service dataset, no schema mutation of Residence/Passport monthly contracts, no daily reconstruction, and no second import path.

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

### Phase 9 — Governed Daily Input (Residence Permit + Passport)

**Status: APPROVED PLANNING BASELINE — implementation not started.**  
**Capture channel:** INTAL WEB APP form with one service selector. **WhatsApp integration: HOLD.**  
**Runtime decision:** extend the existing Apps Script + Google Sheets application first; do not introduce Node.js/PostgreSQL solely for this form.  
**Sequencing:** Gate 9.1 (contract/workflow freeze) may proceed as planning. Before write-path implementation, reconcile the design with the in-delivery monthly Period Closing & Controlled Correction v1 gate so both changes use one governed lifecycle and do not create competing write seams.

### Scope and contract boundary

- [ ] Freeze separate daily contracts for `RESIDENCE_PERMIT_SERVICE_DAILY` and `PASSPORT_SERVICE_DAILY`.
- [ ] Approve the daily meaning, requiredness, zero/missing semantics, reporting cutoff, and total calculation for each service measure.
- [ ] Residence Permit candidate measures: the 13 existing monthly service measures.
- [ ] Passport candidate measures: `biasa_24`, `biasa_48`, `elektronik_48`, `e_polikarbonat`.
- [ ] Logical report identity: `tanggal + kantor_imigrasi + service_family`; revisions use stable `record_id + revision`.
- [ ] Protect both canonical monthly contracts, their registry identities, existing importer seam, historical rows, and totals.

### Gate 9.1 — Workflow and contract freeze

- [ ] Approve operators/reviewers/approvers, correction and void authority, and period-close authority.
- [ ] Freeze contract versions and fixture datasets for both services.
- [ ] Define report cutoff/timezone (`Asia/Jakarta`), office-reference rules, and period states.
- [ ] Confirm no personal/foreign-national fields are needed for aggregate service reporting.

### Gate 9.2 — Staging and reliable write core

- [ ] Add separate service-specific daily staging/revision stores; no universal table with mixed measures.
- [ ] Add a UUID `submission_id` idempotency ledger; retry returns the original outcome.
- [ ] Add lock-guarded identity/revision check + write seam using Apps Script `LockService`.
- [ ] Add server-side contract validation, derived totals, duplicate/conflict detection, and batch sheet I/O.
- [ ] Add audit correlation IDs and consistency checks for orphaned writes, missing audits, invalid transitions, and duplicate active revisions.
- [ ] Document the Google Sheets multi-write atomicity limitation and prove recovery behavior; do not claim ACID guarantees.

### Gate 9.3 — One responsive input workspace

- [ ] Add service selector: Izin Tinggal / Paspor.
- [ ] Render fields from the selected versioned contract.
- [ ] Add draft, submit, validation summary, conflict/retry state, and clear save feedback.
- [ ] Enforce active Office Reference selection, valid date, integer measures >= 0, and server-derived total.
- [ ] Verify mobile/Android and desktop, keyboard navigation, accessible labels, and safe output escaping.

### Gate 9.4 — Review and correction lifecycle

- [ ] Implement `DRAFT -> SUBMITTED -> APPROVED` and `NEEDS_CORRECTION` / authorized `VOID`.
- [ ] Keep submitted/approved revisions immutable; corrections create a new revision.
- [ ] Implement explicit period `OPEN -> REVIEW -> CLOSED`; privileged reopen requires a reason and audit.
- [ ] Enforce separate server-side permissions for read, write, submit, review, approve, correct, void, close, and reopen.
- [ ] Test concurrent submissions and retry after a simulated timeout.

### Gate 9.5 — Approved views and reconciliation

- [ ] Build read-only daily views from the latest approved, non-void revision.
- [ ] Derive monthly/yearly projections only from approved daily records.
- [ ] Reconcile daily-derived months against canonical monthly data by office and measure.
- [ ] Display deltas, missing/unexpected offices, unresolved corrections, and period status.
- [ ] Never automatically overwrite/backfill `RESIDENCE_PERMIT_SERVICE_MONTHLY` or `PASSPORT_SERVICE_MONTHLY`.

### Gate 9.6 — Governance, evidence, and recovery

- [ ] Extend automated tests for both service contracts, schema versions, validation, totals, idempotency, audit, and state transitions.
- [ ] Add RBAC negative tests and unchanged-monthly-baseline regression checks.
- [ ] Verify governed export, backup manifest/checksum, snapshot equality, and recovery evidence.
- [ ] Add production smoke checks for staging integrity and daily approval counts.
- [ ] Record commit SHA, CI run, Apps Script immutable version, canonical deployment ID, smoke result, audit evidence, and backup verification.

### Gate 9.7 — Controlled production UAT

- [ ] Valid input for each service family.
- [ ] Invalid date/office, blank/negative/decimal measures, derived-total correctness.
- [ ] Duplicate click, same-key retry, concurrent submissions, and lost-response recovery.
- [ ] Draft edit, review return, approval, correction revision, void, closed-period rejection, authorized reopen.
- [ ] Unauthorized approval/correction/close denied server-side.
- [ ] Audit trail completeness, export/backup verification, mobile/desktop browser UAT.
- [ ] Confirm canonical monthly row counts, totals, keys, exports, and dashboards are unchanged.

**Release gate:** contract freeze -> fixtures/tests -> CI PASS -> forensic diff PASS -> merge -> canonical Apps Script deployment -> production smoke -> browser UAT -> integrity/export/backup evidence -> roadmap reconciliation. A green CI run alone does not authorize production certification.

Detailed specification: `docs/DAILY-INPUT-BLUEPRINT.md`. Phase design: `docs/PHASE-9-DAILY-OPERATIONAL-DATA.md`.


### Gate 9.1 alignment and implementation guardrails

The earlier source audit found no existing authoritative daily export or approved SOP. The in-app form is a prospective new source; it does not prove daily measure semantics by itself. Gate 9.1 remains **NOT PASSED** until the operational owner approves daily grain, meaning of each measure, zero-versus-missing behavior, reporting cutoff, late entries, role separation, correction/period workflow, and representative normal/correction fixtures.

The UI must reuse `docs/UI-REFERENCE-GIS-FIRST.md` and the existing application shell, with a task-focused Input Harian route (no map/KPI distractions above the form), synchronized service selection, verified Office Reference, and accessible responsive desktop/Android layout. Use contract-first logical modules, server-owned versioned contracts, server-side RBAC, request/correlation IDs, idempotency, append-only revisions, batch I/O, deterministic errors, consistency verification, and recovery tests within the current Apps Script + Sheets runtime.

No synthetic daily history from monthly totals; no direct writes into canonical monthly datasets; no WhatsApp dependency. Any database/runtime migration requires a separate ADR backed by measured limits. See `docs/DAILY-INPUT-BLUEPRINT.md`.

## Phase 10 — Authoritative monthly analytics and application workspaces

**Status:** Phase 10.1 runtime gate **CLOSED / PASS** as of 2026-09-30.

- [x] Define cross-service reporting contract v1
- [x] Implement read-only `service_volume` semantic adapter
- [x] Add production regression gate for cross-service reporting
- [x] Deploy canonical Phase 10.1 runtime
- [x] Execute live production Regression Smoke
- [x] Verify `cross_service_reporting.ok === true`
- [x] Verify historical Residence certification baseline: 80 rows / 258,094 / 8 periods / 10 offices
- [x] Verify historical Passport certification baseline: 80 rows / 327,088 / 8 periods / 10 offices
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
- Passport GIS service-aware metric runtime UAT: PASS, with production evidence showing **Elektronik 48 = 25,255** and the same office's **Total layanan = 29,506**, while the historical Passport certification baseline remains **80 rows / 327,088 services / 8 periods**.
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