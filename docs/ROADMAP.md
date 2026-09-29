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
- [ ] dashboard filters
- [ ] drill-down
- [ ] maps

## Phase 6 — Governance
- [x] audit log
- [x] admin bootstrap
- [ ] backup/export hardening

## Phase 7 — CI/CD
- [x] clasp
- [x] GitHub Actions
- [x] hosted runner path
- [x] production deployment
- [x] canonical Apps Script deployment ID
- [x] CI action runtime hardening
- [ ] automated smoke test

## Current gate
The first real dataset is verified end-to-end. Dashboard v1 is intentionally limited to aggregate views over the verified monthly service contract. Do not add maps, complex filters, or drill-down until this vertical slice is validated against the real dataset in the Web App.
