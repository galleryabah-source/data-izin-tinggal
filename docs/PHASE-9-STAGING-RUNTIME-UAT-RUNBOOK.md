# Phase 9 — Staging Setup, Runtime Verification, and UAT Runbook

**Status:** EXECUTION RUNBOOK — NOT EVIDENCE OF EXECUTION OR GATE PASS  
**Applies to:** PR #232, branch `feat/daily-input-workflow-v1`  
**Safety boundary:** keep `DAILY_INPUT_GUARD_V1.enabled=false`; do not merge/deploy or write to production while Gate 9.1/9.2 is blocked.

## 1. Prerequisites — stop if any item is missing

- [ ] Gate 9.1 worksheet records the exact operational event/unit, inclusion/exclusion, requiredness, zero/missing semantics, and fixtures for all 17 measures.
- [ ] Accountable owner decisions and RBAC/period-close decisions are recorded with date and contract version.
- [ ] A dedicated, access-restricted staging Google Spreadsheet has been created by an authorized administrator.
- [ ] The staging spreadsheet ID is independently checked and is not the canonical production spreadsheet ID.
- [ ] An authorized Apps Script test deployment and test accounts exist for operator, supervisor, admin, and read-only/auditor roles.
- [ ] A reviewer other than the change author is assigned to the exact candidate commit.
- [ ] A baseline snapshot/hash and row counts are captured for canonical monthly datasets and registry identity before runtime tests.

Do not put spreadsheet IDs, OAuth tokens, credentials, session cookies, or private user data in this document, a PR comment, or CI logs.

## 2. Configure staging identity safely

In the Apps Script project’s **Project Settings → Script Properties**, configure:

- `SPREADSHEET_ID`: the existing canonical spreadsheet ID, unchanged.
- `DAILY_STAGING_SPREADSHEET_ID`: the dedicated staging spreadsheet ID, verified to be different from `SPREADSHEET_ID`.

Never point the staging property to production as a shortcut. Restrict staging spreadsheet sharing to the smallest authorized test group. Keep production deployment settings and the code-level kill switch unchanged.

Expected guard behavior:

1. Missing canonical ID → daily write policy disabled.
2. Missing staging ID → daily write policy disabled.
3. Staging ID equals canonical ID → daily write policy disabled.
4. Distinct staging ID but code kill switch closed → daily write policy disabled.
5. Only a separately reviewed, explicitly authorized release may change the code kill switch after all gates pass.

Verify the policy response through an authorized test harness; do not expose configuration values in logs or UI.

## 3. Verify the storage boundary before lifecycle tests

Using only the staging test deployment:

- [ ] Confirm `DAILY_INPUT_LEDGER` is created only in the configured staging spreadsheet.
- [ ] Confirm `DAILY_INPUT_AUDIT` is created/written only in the staging spreadsheet.
- [ ] Confirm `OFFICE_REFERENCE` and feature/gate configuration are read-only canonical lookups.
- [ ] Confirm all daily mutation paths fail closed if staging cannot be opened.
- [ ] Capture staging spreadsheet identity, tab names, before/after row counts, and test correlation IDs.
- [ ] Recompute canonical monthly dataset and registry snapshots; all protected values, row counts, contract keys, and identity must match the baseline exactly.

A tab name or mocked unit test alone is not proof of storage isolation. Do not run a test that can mutate the canonical monthly store.

## 4. Runtime test matrix

For each test, record UTC server audit timestamp, Asia/Jakarta operational date, environment label (never secrets), actor role, request/correlation ID, expected result, actual result, and evidence location.

| ID | Scenario | Required pass condition |
|---|---|---|
| RT-01 | Operator creates and edits own draft | Allowed only with required permission; no total is inferred for omitted draft measures |
| RT-02 | Submit a complete report | Server validates the approved contract and derives total; state changes only once |
| RT-03 | Submit with a missing required field | Rejected; missing/null is not silently changed to zero |
| RT-04 | Explicit zero values | Accepted where the approved measure dictionary permits zero |
| RT-05 | Receipt/intake-only event | Not counted as a completed service |
| RT-06 | Late entry | Original operational date retained; reason, actor, and server audit timestamp recorded |
| RT-07 | Unverified/unknown/duplicate office reference | Denied; no report mutation |
| RT-08 | Operator attempts review/approval | Denied server-side |
| RT-09 | Submitter attempts self-approval | Denied; no state change |
| RT-10 | Supervisor returns/rejects with reason | State transition and reason are audited |
| RT-11 | Correction after rejection | Authorized correction creates a linked revision; prior revision retained |
| RT-12 | Correction after approval | Only approved role/action may create a linked immutable revision with reason |
| RT-13 | Void approved report | Authorized, reasoned, audited transition; no physical deletion |
| RT-14 | Exact retry with same ID and payload | Original outcome returned; no duplicate revision/event |
| RT-15 | Same ID with changed payload | Explicit conflict; original record unchanged |
| RT-16 | Parallel same-key submissions | One deterministic accepted outcome; no duplicate active report |
| RT-17 | Inject audit write failure | No false success; no inconsistent untracked mutation; recovery result recorded |
| RT-18 | Interrupt between persistence steps | Partial state detected and recovered/dispositioned through audited procedure |
| RT-19 | Submit concurrently with period close | Only a valid serialized ordering succeeds; no ordinary write after committed close |
| RT-20 | Closed period / unauthorized reopen | Denied unless the exact approved reopen permission and reason are present |
| RT-21 | Feature flags true but code kill switch false | Writes remain disabled |
| RT-22 | Canonical baseline after all tests | Monthly dataset rows, totals, contracts, registry identity, and dashboard source remain unchanged |

Google Apps Script and Google Sheets do not provide a cross-sheet ACID transaction. Treat locks as serialization for cooperating code, not as a transaction guarantee. If a failure produces a partial write, the test fails until a deterministic recovery procedure is implemented and independently verified.

## 5. UAT roles and evidence

Use dedicated test identities, not shared accounts.

- **Operator:** read own scope, create/edit draft, submit, view returned report, correct own rejected report where policy permits.
- **Supervisor:** review, return/reject with reason, approve another actor’s report, perform only explicitly authorized correction/void actions.
- **Admin:** perform only explicitly approved administrative actions and reconciliation.
- **Auditor/viewer:** read-only access; every attempted mutation must be denied.

For every unauthorized action, record the server denial and confirm no state change. Screenshots alone are insufficient: pair UI evidence with server response, staging row snapshots, audit event, and correlation ID.

## 6. Required evidence pack before release

- [ ] Completed and signed Gate 9.1 decision worksheet for all 17 measures.
- [ ] Approved versioned measure dictionary and deterministic fixtures.
- [ ] RBAC and separation-of-duties approval.
- [ ] Period close/reopen and office lifecycle policy approval.
- [ ] Staging identity proof and restricted-access list.
- [ ] Runtime test results RT-01 through RT-22, including negative and fault-injection cases.
- [ ] Before/after canonical baseline comparison with exact equality.
- [ ] Recovery report for every injected partial failure.
- [ ] Independent forensic review of the exact commit.
- [ ] CI green on that exact reviewed commit.
- [ ] Explicit release authorization before merge/deploy.
- [ ] Post-deployment smoke and authorized production UAT after the release is approved.

## 7. Release decision

**Do not merge, deploy, or open the code kill switch** if any prerequisite or test is missing, if an audit event cannot be reconciled, if any unauthorized mutation succeeds, or if canonical monthly baseline changes.

A CI pass establishes automated test success for the tested commit. It does not prove real Apps Script runtime behavior, owner sign-off, staging isolation, independent review, or production UAT.
