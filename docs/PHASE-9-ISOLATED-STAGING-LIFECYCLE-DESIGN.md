# Phase 9 — Isolated Staging and Lifecycle Design (Proposal Only)

**Status:** DESIGN ONLY — not authorized for implementation or activation  
**Depends on:** Gate 9.1 PASS and approved, versioned daily measure dictionary  
**Target branch:** `feat/daily-input-contract-core`  
**Canonical monthly datasets:** explicitly out of scope and read-only to this feature

## 1. Non-negotiable boundaries

- Keep `DAILY_INPUT_GUARD_V1.enabled = false` until all release gates are passed.
- This document creates no sheet, endpoint, UI, migration, or write path.
- Keep candidate daily contracts outside `DATASET_CONTRACTS` and monthly importer/period-close flows.
- Do not infer business meaning for any of the 17 measure keys from a key or label.
- Do not merge or deploy this proposal. PR #228 remains open/HOLD.
- WhatsApp integration remains HOLD.

## 2. Proposed isolated storage boundary

After Gate 9.1 approval, create a dedicated set of Phase 9 staging tabs within the approved application datastore, separate from all monthly dataset tabs. Proposed names are placeholders until storage owner review:

1. `DAILY_SUBMISSION_LEDGER` — one idempotency record per submission ID.
2. `DAILY_REPORT_REVISIONS` — immutable report revision snapshots and lifecycle state.
3. `DAILY_AUDIT_EVENTS` — append-only audit evidence for state changes and recovery actions.
4. `DAILY_PERIOD_CONTROL` — explicit period state and close/reopen evidence.

Do not reuse monthly dataset tabs, monthly registry rows, monthly importer functions, or monthly period-close state as staging storage. Server code must fail closed if the configured datastore/environment identity is missing or does not match the expected Phase 9 staging target. Sheet names alone are not proof of isolation; tests must assert the actual target spreadsheet identity and that monthly tabs remain byte-for-byte unchanged.

## 3. Proposed logical records

### Owner-approved rules to carry into the schema

- Count only services completed or documents issued, across all 17 candidate indicators; intake/receipt alone is not counted. Exact measure-specific event/unit and edge cases remain a Gate 9.1 blocker.
- Late entry is allowed. Preserve `operational_date` as the original date and store a mandatory `late_entry_reason` when submission is late. Capture `actor_id` and server-generated `audit_timestamp` independently; never derive or overwrite operational date from submission time.
- The current contract foundation is read-only; these are schema requirements for Gate 9.2 after Gate 9.1 passes, not authorization to create storage now.



### Submission ledger

| Field | Purpose |
|---|---|
| `submission_id` | Client-generated UUID; logical idempotency key |
| `payload_hash` | Hash of canonicalized normalized payload and contract version |
| `contract_version` | Exact approved contract version used to validate request |
| `status` | Processing / Completed / Rejected / RecoveryRequired |
| `original_outcome` | Stable response metadata for exact retries |
| `created_at`, `completed_at` | Audit timestamps |
| `actor_id` | Authenticated server-resolved actor |

### Report revision

| Field | Purpose |
|---|---|
| `report_id` | Stable logical report identity |
| `revision_id` | Unique immutable revision identity |
| `revision_number` | Monotonic revision number under serialized write |
| `supersedes_revision_id` | Link to the prior revision, if any |
| `operational_date` | Original date-only business key in Asia/Jakarta; unchanged for late entry |
| `late_entry_reason` | Mandatory for late entry; explains why report arrived after operational day |
| `submitted_at` / `actor_id` | Server-generated audit timestamp and authenticated actor, distinct from operational date |
| `office_key` | Canonical office key resolved server-side |
| `service_family`, `contract_version` | Approved service contract identity |
| `measures_json`, `derived_total` | Normalized values and server-derived total |
| `state` | Draft / Submitted / Returned / Approved / Void, subject to approved lifecycle |
| `actor_id`, `reason`, timestamps | Attribution and governed transition evidence |

Candidate logical uniqueness is `operational_date + office_key + service_family`; owner approval must confirm this before enforcement. It must never silently overwrite an existing report. A new logical report or revision follows the approved conflict/correction policy.

### Audit event

Record event ID, report/revision/submission IDs, authenticated actor, action, prior and next state, reason, contract version, business date, audit timestamp, outcome, and correlation ID. Never update or delete a prior audit event. Define retention and access control at Gate 9.1.

## 4. Idempotency and concurrency protocol

All mutation entry points must authorize the actor before reading or writing business data.

Within a single script lock / serialized critical section:

1. Validate request shape and approved contract version.
2. Resolve the authenticated actor and required lifecycle permission.
3. Resolve `office_key` to exactly one server-side `OFFICE_REFERENCE` row with status `VERIFIED`; reject zero or multiple matches and all other statuses.
4. Canonicalize normalized payload deterministically and compute a payload hash that includes contract version and all logical fields.
5. Look up `submission_id` in the ledger.
   - Same ID + same hash + completed result: return the recorded original outcome without creating another revision.
   - Same ID + different hash: reject with an idempotency-conflict result and audit the conflict where safe.
   - Same ID + in-progress/recovery-required: return a stable in-progress/retryable result; do not start a second write.
6. Check the logical report key and approved revision rules.
7. Persist a recoverable processing marker before creating the revision; write the immutable revision and audit event; then mark the ledger completed with the stable outcome.
8. On any partial failure, do not report success. Preserve a recovery-required marker and provide an administrator-only, audited reconciliation path.

A Google Apps Script lock serializes cooperating code paths; it is not a database transaction. The implementation must explicitly test partial-write recovery and must not assume multiple spreadsheet writes are atomic. All paths that mutate these staging records must use the same lock discipline.

## 5. Authorization and lifecycle design

The final role/action matrix must be approved before implementation. Candidate actions to authorize separately:

- create/edit draft
- submit
- review/return
- approve
- create correction revision
- void
- close period
- reopen period / authorize post-close correction
- read operational reports
- administer/reconcile failed writes

Authorization is server-side and deny-by-default. Existing `dashboard.read` does not imply mutation permission. Resolve actor identity server-side; never trust client-supplied role, actor ID, office display name, state, revision number, or total. Enforce submitter/reviewer separation according to the approved policy.

Submitted and approved revisions are immutable. Corrections create linked revisions with reason and actor. Void is a governed state transition, not physical deletion. Only the latest approved, non-void revision may contribute to approved daily views. Any monthly/yearly adapter requires its own approval and must never write back to historical monthly datasets.

## 6. Required deterministic test matrix

- Exact retry returns the original outcome and produces no second revision/audit transition.
- Reused submission ID with a different payload is rejected.
- Concurrent identical submissions result in one accepted ledger record.
- Concurrent different payloads with the same submission ID cannot both succeed.
- Two submissions for the same logical report key follow the approved conflict/revision policy.
- Missing, unknown, duplicate, PENDING, and non-VERIFIED office references are rejected.
- Unauthenticated actor and every unauthorized lifecycle action are rejected before mutation.
- Submitter self-approval is rejected unless a documented exception is approved.
- Stale contract version and stale revision are rejected.
- Correction and void require an authorized actor and reason; prior revisions remain unchanged.
- Period close/reopen and post-close correction follow approved rules.
- Failure injected after each individual persistence step leaves a detectable, recoverable state and never returns false success.
- Audit persistence failure fails closed for the mutation.
- Feature guard remains disabled when configuration flag is true.
- No Phase 9 path invokes monthly importer, monthly registry mutation, monthly period-close mutation, or writes to canonical monthly datasets.
- Test captures hashes/snapshots of canonical monthly data before and after the staging test suite and asserts equality.

## 7. Implementation gate sequence

1. Gate 9.1: all 17 operational definitions and shared rules approved by named owners; contract version and date recorded.
2. Review this staging design with application/security/data owners and approve the datastore identity/access boundary.
3. Implement isolated storage and pure persistence adapter in a separate reviewed change; keep the feature guard hard-disabled.
4. Run unit, integration, concurrency, recovery, authorization, audit-failure, and monthly-baseline invariance tests.
5. Forensic diff and security review; verify no monthly paths changed.
6. Obtain explicit release authorization before merge/deployment. CI green alone is not release authorization.
7. After approved deployment only: production smoke, browser UAT, and integrity regression evidence.

**Current result: NOT IMPLEMENTED / NOT RELEASE-AUTHORIZED. Gate 9.1 remains BLOCKED until owner decisions are signed off.**


## Staging storage boundary update (PR #232)

The candidate service now requires `DAILY_STAGING_SPREADSHEET_ID` to be configured as a distinct Apps Script Script Property from canonical `SPREADSHEET_ID`. Daily ledger and daily audit writes use only that staging spreadsheet. The canonical store remains read-only for the daily feature (office reference and feature/gate configuration reads only). Regression tests assert the canonical spreadsheet does not receive the daily ledger/audit. This is mocked CI evidence; a real staging spreadsheet and Apps Script runtime test are still required before Gate 9.2 can pass.
