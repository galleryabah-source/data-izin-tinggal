# Phase 9 Gate 9.1 — Acceleration and Evidence Pack

**Disposition: WORKING DRAFT — NOT AN APPROVAL, NOT A GATE PASS.**  
**Target branch:** `feat/daily-input-workflow-v1`  
**Scope:** prepare decisions and executable evidence for Gate 9.1 and isolated Gate 9.2 staging.  
**Non-negotiable boundary:** `DAILY_INPUT_GUARD_V1.enabled=false`; no merge/deploy; no production writes; no changes to canonical monthly datasets, importer, registry identity, historical rows, or dashboards.

This pack turns the open decisions into reviewable proposals and concrete evidence requirements. Labels and existing monthly contract keys are not sufficient evidence to infer the legal/operational meaning of a service indicator. No per-indicator event definition is marked approved without an authoritative SOP/source and accountable owner decision.

## 1. Seventeen-measure decision queue

The only common operational decision currently recorded is: count a service when processing is complete or the relevant document is issued; receipt/intake alone does not count. The owner must still choose the exact event code, source-of-truth field, count unit, precedence, reversals, requiredness, and fixtures for every key below.

| # | Family | Key | Label available in current contract | Decision that must be resolved against SOP/source |
|---:|---|---|---|---|
| 1 | Izin Tinggal | `bvk` | BVK | Exact qualifying event/status; whether unit is case, permit, or document; duplicate/reversal/reissue treatment |
| 2 | Izin Tinggal | `voa` | VOA | Exact qualifying event/status; whether unit is case, permit, or document; duplicate/reversal/reissue treatment |
| 3 | Izin Tinggal | `itk` | ITK | Exact qualifying event/status; whether unit is case, permit, or document; duplicate/reversal/reissue treatment |
| 4 | Izin Tinggal | `itk_peralihan` | ITK Peralihan | Exact qualifying event/status; relationship to ITK and transition overlap; unit and reversal treatment |
| 5 | Izin Tinggal | `itas` | ITAS | Exact qualifying event/status; whether unit is case, permit, or document; duplicate/reversal/reissue treatment |
| 6 | Izin Tinggal | `itap` | ITAP | Exact qualifying event/status; whether unit is case, permit, or document; duplicate/reversal/reissue treatment |
| 7 | Izin Tinggal | `itkt` | ITKT | Exact qualifying event/status; whether unit is case, permit, or document; duplicate/reversal/reissue treatment |
| 8 | Izin Tinggal | `alih_status_itk_ke_itas` | Alih Status ITK ke ITAS | Define transition completion event; avoid counting both source and target categories for one unit unless explicitly required |
| 9 | Izin Tinggal | `alih_status_itas_ke_itap` | Alih Status ITAS ke ITAP | Define transition completion event; avoid counting both source and target categories for one unit unless explicitly required |
| 10 | Izin Tinggal | `abg` | ABG | Expand/confirm official label; exact event/status and unit; reversal/reissue treatment |
| 11 | Izin Tinggal | `epo` | EPO | Confirm whether unit is approved/completed EPO case or issued evidence; cancellation/reversal treatment |
| 12 | Izin Tinggal | `imk` | IMK | Expand/confirm official label; exact event/status and unit; reversal/reissue treatment |
| 13 | Izin Tinggal | `skim` | SKIM | Expand/confirm official label; exact event/status and unit; reversal/reissue treatment |
| 14 | Paspor | `biasa_24` | Paspor Biasa 24 | Confirm official product/validity definition and issuance event; replacement, reprint, cancellation treatment |
| 15 | Paspor | `biasa_48` | Paspor Biasa 48 | Confirm official product/validity definition and issuance event; replacement, reprint, cancellation treatment |
| 16 | Paspor | `elektronik_48` | Paspor Elektronik 48 | Confirm official product/validity definition and issuance event; replacement, reprint, cancellation treatment |
| 17 | Paspor | `e_polikarbonat` | Paspor Elektronik Polikarbonat | Confirm official product/validity definition and issuance event; replacement, reprint, cancellation treatment |

**Required per-key evidence:** authoritative source/SOP version and section; event/status code and source field; count unit; completion-vs-issuance precedence; inclusion/exclusion matrix (rejection, cancellation, void, duplicate, transfer, reissue/reprint, correction after completion); required/optional; zero/blank/null semantics; at least one positive, one non-qualifying, one zero, one missing/null and every applicable edge-case fixture; expected result; named owner; decision date. Until then, each row remains **PENDING**.

## 2. Data-entry semantics proposal (approval required)

- Explicit integer `0` means the reporter confirms no qualifying activity.
- Blank/null/omitted API fields mean unknown/not supplied, never implicit zero. The server rejects final submission when an approved required field is missing.
- Existing source-transcription convention is separate: when transcribing a narrative daily report, a blank/no-number cell may be normalized to numeric zero only if the original source report is retained and that transcription rule applies to the source. Do not use this convention to silently coerce API payloads.
- Final total is server-derived from the approved measure set. Client totals are informational only.
- Operational date is the date of the qualifying event in Asia/Jakarta, independent of `submitted_at`. Late entry preserves the original operational date and requires a reason and server audit event.
- One count is assigned according to the approved per-indicator unit. Completion and issuance for the same underlying unit must not be double-counted unless the owner explicitly approves separate countable units.
- No daily-to-monthly backfill or inferred daily split from monthly aggregates.

## 3. Proposed role/action matrix (must be ratified)

| Action | OPERATOR | SUPERVISOR | ADMIN | AUDITOR / VIEWER |
|---|---|---|---|---|
| Read daily workspace | Yes, scoped | Yes | Yes | Read-only |
| Create/edit own draft | Yes | Yes, subject to policy | Yes | No |
| Submit own report | Yes | Yes, subject to policy | Yes, subject to policy | No |
| Review/return | No | Yes | Yes | No |
| Approve | No | Yes, never own submission | Yes, never own submission | No |
| Correct rejected own report | Yes, reason required | Yes | Yes | No |
| Correct approved report | No | Yes, reason + linked revision | Yes, reason + linked revision | No |
| Void approved report | No | Yes, reason + audit | Yes, reason + audit | No |
| Close period | No | Proposed: yes with reconciliation | Yes | No |
| Reopen closed period | No | Proposed: explicit permission + reason | Yes, explicit permission + reason | No |
| Read audit events | No by default | Limited, if approved | Yes | Yes, read-only |

**Security invariants:** deny by default; permissions enforced server-side; client role values are never authoritative; submitter cannot approve own submission; correction/void never mutate or delete prior submitted/approved revisions; audit failure prevents a successful state transition. Final role mapping, delegated authority, and period-close/reopen authority need named security/operations owner approval.

## 4. Period and office identity proposals (approval required)

### Period lifecycle
- State machine: `OPEN -> REVIEW -> CLOSED`; no implicit close based on date or missing reports.
- Close requires an authorized actor, period identity, reconciliation evidence, unresolved-exception disposition, timestamp, and audit record.
- Ordinary submission/correction is denied when closed. Reopen requires dedicated permission, mandatory reason, linked close event, actor/time audit, and a new immutable revision for subsequent correction.
- Define exact cutoff and who may close/reopen before Gate 9.1 passes. Do not invent a cutoff in code.

### Office identity
- Use stable `office_key`, resolved server-side to exactly one `OFFICE_REFERENCE` record with `status=VERIFIED`.
- Display names are labels, not identifiers. Missing, unknown, duplicate, PENDING, or otherwise non-verified matches fail closed.
- Proposed historical policy: preserve the submitted canonical `office_key` and office-name snapshot on each revision. Inactivating an office prevents new reports after the effective date, but does not rewrite historical records. A historical report may be corrected only under a governed revision path using the original identity; any reassignment to a successor office requires explicit owner-approved mapping and audit.
- Confirm office mergers, splits, renames, and effective-date policy with the reference-data owner.

## 5. Isolated Apps Script staging evidence plan

**Implemented fail-closed storage guard:** candidate runtime requires Script Properties `SPREADSHEET_ID` (canonical) and `DAILY_STAGING_SPREADSHEET_ID` (staging), and rejects a missing staging ID or an ID equal to the canonical ID. The daily ledger and `DAILY_INPUT_AUDIT` are written to the staging spreadsheet; office reference and feature/gate configuration are read from the canonical store. The code-level kill switch remains false. No staging ID or runtime credentials are assumed to exist.


Run only after the required Gate 9.1 owner decisions are recorded. Staging must have an explicit environment identity and a dedicated restricted spreadsheet/store; verify that it is not the production spreadsheet and that canonical monthly dataset paths cannot be reached by mutation endpoints.

| Test | Method | Pass evidence |
|---|---|---|
| Role boundary | Test each action as operator, supervisor, admin, auditor, viewer and unauthenticated caller | Server response + audit record; every unauthorized mutation denied |
| Separation of duties | Submitter attempts to approve own record | Denied; no state change; audit event retained |
| Same-key concurrency | Parallel requests for same logical key with same/different idempotency key | Exactly one active revision; deterministic replay/conflict |
| Timeout/retry | Force client timeout after server accepts request; retry with same key and canonical payload | Original result returned; no duplicate revision |
| Idempotency misuse | Reuse submission ID with changed payload | Explicit conflict; original record unchanged |
| Audit write failure | Inject audit failure before/after attempted staging write | No false success; consistency verifier detects/reconciles any partial write; no silent retry append |
| Multi-sheet partial failure | Fail between revision, idempotency ledger and audit writes | Recovery procedure produces a verifiable consistent state; documented platform limitation |
| Correction/void replay | Repeat same approved correction/void request | Same outcome returned; no extra revision or event duplication |
| Period close race | Submit and close concurrently | Exactly one valid ordering; no ordinary write accepted after committed close |
| Office lifecycle | Unknown/duplicate/non-verified/inactive office; rename and successor cases | Fail-closed resolution; historical identity remains stable |
| Canonical isolation | Snapshot protected monthly sheets and registry before/after all staging tests | Hash/row count/contract/registry identity unchanged; no monthly write path invoked |
| Recovery | Interrupt execution at each write boundary, then run consistency verifier/recovery | Orphan, missing audit, duplicate active revision, and invalid transition are detected and dispositioned |

Google Apps Script + Google Sheets do not provide a cross-sheet ACID transaction. Do not describe `LockService` as a transaction. Evidence must include actual runtime execution logs, actor identity, environment ID, correlation/submission IDs, before/after row counts and hashes, and recovery output. In-memory unit tests alone do not satisfy this gate.

## 6. Release gates

1. **Gate 9.1:** all 17 per-key definitions and cross-cutting policy decisions are complete; named owners sign; fixtures pass; exact decision/version recorded.
2. **Gate 9.2 staging:** isolated storage, RBAC, period/office lifecycle, idempotency, concurrency, failure/recovery, and audit evidence pass in actual Apps Script runtime.
3. **Independent review:** reviewer not author of the change examines exact head, source diff, permissions, tests, logs, and canonical-data non-mutation evidence.
4. **Final CI:** run on the exact reviewed commit; no commit movement after review without re-review.
5. **Controlled merge/deploy:** only after the preceding gates pass and release is explicitly authorized.
6. **Production UAT:** authorized accounts only; verify operator draft/submit, supervisor review/approval/rejection, correction, void, timeout retry, audit-failure handling, and canonical monthly baseline unchanged.

**Current status remains BLOCKED.** This document is an acceleration pack for review; it does not replace the operational owner's decisions, signed evidence, actual-runtime tests, or independent review.
