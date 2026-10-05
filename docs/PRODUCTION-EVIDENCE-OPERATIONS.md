# Production Evidence & Operational Monitoring v1

## Status

**GREEN — reconciled 2026-10-05.**

This document records the current runtime baseline, the P0 hardening gates, and the rules for keeping repository documentation aligned with production.

## Current production baseline

| Dataset | Rows | Columns | Periods | Offices | Grand total |
|---|---:|---:|---:|---:|---:|
| Residence Permit | 90 | 16 | 9 | 10 | 291,730 |
| Passport | 90 | 7 | 9 | 10 | 373,839 |
| **Combined** | **180** | — | — | — | **665,569** |

Integrity evidence for both datasets:
- duplicate business keys: `0`
- blank business keys: `0`
- invalid periods: `0`
- invalid measures: `0`
- total mismatches: `0`
- latest import: `10 accepted / 0 rejected / 0 duplicates / SUCCESS`
- registry row count matches runtime row count

## Runtime evidence — 2026-10-05

### Production Smoke
`runProductionSmokeTestV1()`:
- `ok: true`
- `smokeVersion: "2-growth-safe"`
- `failedChecks: []`
- **16/16 checks PASS**
- Residence: 90 / 291,730 / 9 / 10
- Passport: 90 / 373,839 / 9 / 10
- deployment ID matches canonical deployment
- release evidence version: `1`

### Dashboard Regression
`runDashboardRegressionSmokeV1()`:
- `ok: true`
- `failedChecks: []`
- **12/12 checks PASS**
- cross-service reporting: PASS
- Residence dashboard/map/drilldown: PASS
- Passport dashboard/map/drilldown: PASS
- office reference readiness: PASS

### Export
- Residence: 90 rows / 291,730 / zero value mismatches
- Passport: 90 rows / 373,839 / zero value mismatches

### Backup
Residence snapshot: 90 rows; manifest rows: 90; source/snapshot/manifest checksum identical:
`3a06493e9042b14121bbdfd024f03cc3905e85fa6b5d2c607f98070aa125c5e0`
Passport backup was also verified by the production smoke gate.

## P0 hardening status

| Gate | Status | Evidence |
|---|---|---|
| P0.1 Governance & Audit Center v1 | GREEN | deployed production read-only audit center |
| P0.2 Dataset Health Center v1 | GREEN | Residence + Passport health runtime verified |
| P0.3 Backup & Recovery Center v1 | DEPLOYED / READ-ONLY | restore explicitly disabled; snapshot verification available |
| P0.4 Production Evidence Center v1 | GREEN | PR #152 → canonical deployment Run #485 → runtime evidence PASS |

P0.3 remains intentionally read-only. Restore activation is not part of the current production capability.

## Deployment evidence
- PR: `#152`
- merge commit: `ae1a9bed19b81d954745f06e4ae35dd933e4b079`
- workflow: `Deploy Google Apps Script`
- production Run: `#485`
- Run ID: `37288469532`
- event: `push`
- branch: `main`
- conclusion: `success`
- canonical Apps Script deployment ID: `AKfycbzwhcpZWp8LhyidPFsvqwBQ6ZrgXjEB60NkyNmaQYsiewsvm9uZ_pwPdrG5xZINF2NK`
- release evidence version: `1`

The deployment workflow completed validation, source push, immutable version creation, deployment, deployment-evidence manifest creation, and artifact upload.

## Evidence chain
`Git commit SHA → GitHub Actions run → Apps Script immutable version → canonical deployment ID → runtime smoke → AUDIT_LOG → backup snapshot`

No link in this chain may be replaced by an assumption. A green CI run alone is not production evidence.

## Documentation reconciliation rule

Whenever a production import changes the authoritative monthly dataset:
1. run dataset integrity verification;
2. refresh backup snapshots and verify checksum/manifest;
3. run dashboard regression smoke;
4. run production smoke;
5. reconcile `docs/PRODUCTION-SMOKE-TEST.md`;
6. reconcile `docs/ROADMAP.md` if a roadmap baseline is affected;
7. preserve historical certification values as historical evidence;
8. never present historical baseline values as current runtime values.

## Monitoring boundary

The current monitoring model is evidence-on-demand through governed Apps Script runtime checks and read-only governance/evidence centers.

No new external monitoring agent, second data path, daily reconstruction, or annual temporal architecture is introduced by this reconciliation.

Future scheduled monitoring may be added only after authentication, authorization, notification, and failure-handling boundaries are explicitly designed.

## Deferred work
- PR #122 annual temporal architecture: **HOLD** until a real production requirement exists.
- Daily operational grain: deferred until an authoritative daily source exists.
- Restore activation: disabled in P0.3.
- Dasmon: separate from this canonical application and not part of this hardening.
- New dashboard capability: not required by this gate.

## Operational principle
The repository documents the state proven by production evidence. It does not redefine production by documentation.

**One canonical lifecycle. One source of truth. Evidence before capability expansion.**