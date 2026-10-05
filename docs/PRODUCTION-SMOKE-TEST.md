# Production Smoke Test v2 — Evidence Contract

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
| Dataset rows | 90 |
| Dataset columns | 16 |
| Monthly periods | 9 |
| Immigration offices | 10 |
| Grand total | 291,730 |
| Duplicate business keys | 0 |
| Blank business keys | 0 |
| Total mismatches | 0 |
| Latest import accepted | 10 |
| Latest import rejected | 0 |
| Latest import duplicates | 0 |
| Exported rows | 90 |
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

- `deploymentId` matching the canonical production Apps Script deployment ID;
- `releaseEvidenceVersion: "1"`;

- `ok: true`
- `smokeVersion: "2-growth-safe"`
- `failedChecks: []`
- a production actor identity
- `verifiedAt`
- `latestSnapshotId`

## Audit evidence

Every production smoke execution appends one `PRODUCTION_SMOKE_TEST` event to `AUDIT_LOG`.

The smoke result records the canonical Apps Script deployment ID. The corresponding production deployment must also have a GitHub Actions `deployment-evidence` artifact containing the Git commit SHA, workflow run ID, Apps Script version, deployment ID, ref, and evidence-contract version. The runtime smoke record and CI artifact are the two halves of the release evidence chain.

The audit details contain the smoke result, including PASS/FAILED status, dataset key, expected baseline, check results, failed check names, latest snapshot identifier, actor, and timestamps.

## Current evidence

The canonical production runtime was verified on 2026-10-05 at approximately 14:18 Asia/Jakarta using the deployed Apps Script runtime.

Observed result:

- overall: `PASS`
- `smokeVersion`: `2-growth-safe`
- failed checks: none
- Residence: 90 rows, 9 periods, 10 offices, grand total 291,730
- Passport: 90 rows, 9 periods, 10 offices, grand total 373,839
- Residence export: 90 rows, 291,730, zero value mismatches
- Passport export: 90 rows, 373,839, zero value mismatches
- latest Residence snapshot: `1bPXncDwgMTEhwnzzq-aJ0nI9u11EeoYn6W_8NHNql6o`
- Residence source/snapshot/manifest checksums: identical
- Passport backup snapshot: PASS
- production deployment ID: `AKfycbzwhcpZWp8LhyidPFsvqwBQ6ZrgXjEB60NkyNmaQYsiewsvm9uZ_pwPdrG5xZINF2NK`

This evidence closes the previously stale Residence backup snapshot gap after the canonical dataset grew from 80 to 90 rows.

## Operational rule

Do not claim that CI alone proves production runtime health.

When a production smoke execution is required, verify:

1. the execution ran against the canonical production Apps Script project;
2. the actor is authorized;
3. all required checks passed;
4. the result contains no failed checks;
5. the corresponding `PRODUCTION_SMOKE_TEST` audit event exists;
6. the GitHub Actions deployment-evidence artifact for the deployed release matches the same deployment ID and Apps Script version.

## Future automation boundary

A future CI-triggered runtime smoke may be introduced only after its authentication and authorization boundary is explicitly designed.

It must not expose Apps Script credentials in source, commit OAuth tokens or service-account secrets, weaken Apps Script RBAC, bypass `requirePermission_('audit.read')`, or confuse source-level CI results with runtime production evidence.

Until that boundary is implemented and verified, the current manual production runtime smoke remains the authoritative v1 production evidence path.

## Deployment identity chain

The canonical release evidence chain is:

`Git commit SHA → GitHub Actions run → Apps Script immutable version → canonical deployment ID → production smoke → AUDIT_LOG → backup snapshot`.

GitHub Actions does not receive production runtime credentials for smoke execution. The deployment-evidence artifact is non-secret metadata only. It does not replace runtime smoke; it binds the manual runtime result to the exact CI/deployment release.

## CI trigger verification

This section was added solely to re-emit a `pull_request` activity for CI trigger-path verification. It has no application or runtime behavior impact.
