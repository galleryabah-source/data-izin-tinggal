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
- [ ] drill-down
- [ ] maps
- [ ] map readiness — Office Reference v1 (coordinates must be verified before map UI)

## Phase 6 — Governance
- [x] audit log
- [x] admin bootstrap
- [x] backup/export hardening — governed CSV export + Drive snapshot v1

## Phase 7 — CI/CD
- [x] clasp
- [x] GitHub Actions
- [x] hosted runner path
- [x] production deployment
- [x] canonical Apps Script deployment ID
- [x] CI action runtime hardening
- [x] automated smoke test — syntax, contract, normalization, filter, export, backup-ID invariants

## Current gate
The first real dataset is verified end-to-end. Dashboard v1 and Dashboard Filter v1 are validated against the real Web App:
- baseline: 80 rows / 258,094 services
- period filter January 2026: 10 rows / 33,367 services
- office filter KANIM KELAS I NON TPI BOGOR: 8 rows / 51,366 services
- reset filter: 80 rows / 258,094 services
- period ordering: 2026-01 through 2026-08
- service subtotals reconcile to the filtered grand total

Governance, automated smoke-test, and Drill-down v1 gates are complete. The next gate is Map Readiness: establish a verified Office Reference v1 with authoritative coordinates before implementing map UI.
