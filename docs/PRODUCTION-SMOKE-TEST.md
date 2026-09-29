# Production Smoke Test v1 — Evidence Contract

## Purpose

`runProductionSmokeTestV1()` is the production runtime integrity gate for the canonical `RESIDENCE_PERMIT_SERVICE_MONTHLY` dataset and its dependent read/export/backup paths.

This document defines what constitutes valid production smoke evidence. It does not add a new application feature or change the deployment credential boundary.

## Layers

The project intentionally separates two test layers:

1. **Source-level CI validation**
   - Runs from GitHub Actions.
   - Executes `npm test`.
   - Validates source syntax and deterministic invariants.
   - Does not prove that the deployed Apps Script runtime, production spreadsheet, Drive backup, or Web App are healthy.
2. **Production runtime smoke verification**
   - Runs against the deployed Apps Script environment.
   - Executes `runProductionSmokeTestV1()`.
   - Uses the real production spreadsheet and configured backup folder.
   - Produces a runtime result and an `AUDIT_LOG` event with action `PRODUCTION_SMOKE_TEST`.

A green source-level CI run must not be treated as a substitute for production runtime evidence.

## Production baseline

| Invariant | Expected |
|---|---:|
| Dataset | `RESIDENCE_PERMIT_SERVICE_MONTHLY` |
| Dataset rows | 80 |
| Dataset columns | 16 |
| Monthly periods | 8 |
| Immigration offices | 10 |
| Grand total | 258,094 |
| Duplicate business keys | 0 |
| Blank business keys | 0 |
| Total mismatches | 0 |
| Latest import accepted | 80 |
| Latest import rejected | 0 |
| Latest import duplicates | 0 |
| Exported rows | 80 |
| Backup checksum relationship | source = snapshot = manifest |

## Required runtime checks

A smoke test is `PASS` only when all checks report `ok: true`:

- `identity`
- `dashboard_summary`
- `dashboard_baseline`
- `drilldown_baseline`
- `office_reference_readiness`
- `map_baseline`
- `dataset_integrity`
- `export_verification`
- `backup_snapshot`

The result must also have:

- `ok: true`
- `smokeVersion: "1"`
- `failedChecks: []`
- a production actor identity
- `verifiedAt`
- `latestSnapshotId`

## Audit evidence

Every production smoke execution appends one `PRODUCTION_SMOKE_TEST` event to `AUDIT_LOG`.

The audit details contain the smoke result, including PASS/FAILED status, dataset key, expected baseline, check results, failed check names, latest snapshot identifier, actor, and timestamps.

## Current evidence

The production smoke test was manually executed from the canonical Apps Script project on 2026-09-29 at approximately 20:48 Asia/Jakarta.

Observed result:

- overall: `PASS`
- all 9 runtime checks: `PASS`
- failed checks: none
- dataset rows: 80
- grand total: 258,094
- latest verified snapshot: `1ptjhuCK1puL-UdfQWaraaZjRcx41pbJCt-VYdWFKBJw`

This evidence demonstrates that the deployed production runtime and its real data/backup dependencies passed the v1 gate.

## Operational rule

Do not claim that CI alone proves production runtime health.

When a production smoke execution is required, verify:

1. the execution ran against the canonical production Apps Script project;
2. the actor is authorized;
3. all required checks passed;
4. the result contains no failed checks;
5. the corresponding `PRODUCTION_SMOKE_TEST` audit event exists.

## Future automation boundary

A future CI-triggered runtime smoke may be introduced only after its authentication and authorization boundary is explicitly designed.

It must not expose Apps Script credentials in source, commit OAuth tokens or service-account secrets, weaken Apps Script RBAC, bypass `requirePermission_('audit.read')`, or confuse source-level CI results with runtime production evidence.

Until that boundary is implemented and verified, the current manual production runtime smoke remains the authoritative v1 production evidence path.

## CI trigger verification

This section was added solely to re-emit a `pull_request` activity for CI trigger-path verification. It has no application or runtime behavior impact.
