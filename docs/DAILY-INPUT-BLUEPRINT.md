# Daily Input Implementation Blueprint

**Status:** contract/validator foundation implemented in PR #228 — Gate 9.1 NOT PASSED; daily writes and UI not implemented  
**Scope:** one in-app input form for daily Residence Permit and Passport service reports  
**Capture channel:** INTAL WEB APP form; WhatsApp integration is **HOLD** and is not a dependency  
**Runtime baseline:** Google Apps Script Web App + Google Sheets, consistent with the current canonical application

## 1. Executive decision

Implement a single responsive **Daily Service Input** workspace with a service-family selector. The same form shell handles both services, but each service retains its own contract, measures, staging storage, validation, approval rules, and aggregation boundary.

The first release is an input-and-governance capability, not an automatic rewrite of monthly data. All new daily records remain in staging until approved. Existing monthly production datasets remain authoritative and read-only from this feature.

- `RESIDENCE_PERMIT_SERVICE_MONTHLY` — protected canonical monthly dataset.
- `PASSPORT_SERVICE_MONTHLY` — protected canonical monthly dataset.
- Proposed daily families: `RESIDENCE_PERMIT_SERVICE_DAILY` and `PASSPORT_SERVICE_DAILY`.
- WhatsApp capture, group reading, bots, and external messaging APIs are excluded from this delivery.

## 2. Product and form behavior

One form shell with service-specific fields:

1. Select service: **Izin Tinggal** or **Paspor**.
2. Select operational date (Asia/Jakarta).
3. Select Kantor Imigrasi from the verified Office Reference; do not accept free-text office names for normal entry.
4. Render the measures defined by the selected daily contract.
5. Derive total on the server and show a client-side preview for convenience.
6. Save draft, submit for review, or open a prior record for a controlled correction.
7. Show a clear result state: saved, submitted, needs correction, approved, rejected by validation, or conflict detected.

The UI must be responsive for desktop and Android/mobile browsers, keyboard accessible, label every field, retain clear validation messages, and prevent accidental double submission. The client is never the authority for validation or authorization.

### Residence Permit measures

Use the existing Residence Permit contract's 13 service measures as the initial candidate set:

`bvk`, `voa`, `itk`, `itk_peralihan`, `itas`, `itap`, `itkt`, `alih_status_itk_ke_itas`, `alih_status_itas_ke_itap`, `abg`, `epo`, `imk`, `skim`.

### Passport measures

Use the existing Passport contract's four service measures as the initial candidate set:

`biasa_24`, `biasa_48`, `elektronik_48`, `e_polikarbonat`.

The daily contracts must explicitly approve whether each existing monthly measure has the same daily meaning and whether zero is a valid reported count. Do not infer daily data by dividing or reconstructing monthly aggregates.

## 3. Data boundary and proposed storage

Keep service-specific storage separate. Do not create a universal daily table with incompatible measure columns and do not register a new canonical monthly dataset as a side effect of opening the form.

Proposed logical stores (physical sheet names are subject to schema review):

- Residence daily staging/revisions.
- Passport daily staging/revisions.
- Daily submission/idempotency ledger.
- Daily period state.
- Validation issues and review decisions, if these cannot be represented cleanly in the revision envelope.
- Audit events using the existing audit pattern, extended only through a reviewed migration.

Every stored record must carry a contract version. Do not change existing monthly sheet schemas, dataset registry identity, monthly importer, or existing business keys as part of this work.

### Record identity

- Logical report identity: `tanggal + kantor_imigrasi + service_family`.
- Revision identity: `record_id + revision`.
- Request idempotency identity: client-generated `submission_id` (UUID), validated and persisted server-side.
- The same `submission_id` retried after a timeout returns the original outcome; it must not create another revision.
- A new submission for an existing logical report must enter the explicit correction/revision path, not silently append a duplicate.

## 4. State machine and correction policy

Report lifecycle:

```
DRAFT -> SUBMITTED -> APPROVED
             |           |
             v           v
      NEEDS_CORRECTION  new revision for correction
                         |
                         +--> SUBMITTED -> APPROVED
VOID is an explicit, authorized, audited terminal decision
```

Period lifecycle:

```
OPEN -> REVIEW -> CLOSED
  ^        |         |
  |        +---------+-- reopening requires privileged authorization,
  +--------------------- mandatory reason, and audit evidence
```

Rules:

- Draft edits may update the draft while retaining timestamps and actor attribution.
- Once submitted, approved, or voided, prior versions are immutable evidence.
- A correction creates a new revision linked to the prior revision; never overwrite approved evidence in place.
- Only the latest approved, non-void revision participates in daily approved views.
- Period closure is explicit; never infer closure from today's date or from missing reports.
- Closed-period corrections require an authorized reopen/correction action and a new revision.
- Every approval, return-for-correction, void, reopen, and close action requires actor, timestamp, reason where applicable, and an audit event.

## 5. Validation and integrity controls

Server-side validation is mandatory:

- authenticated actor and required permission;
- service-family contract and version;
- valid date in the `Asia/Jakarta` operational timezone;
- selected office exists and is active in Office Reference;
- every required measure is present and a finite integer >= 0;
- reject locale-formatted ambiguity, NaN, Infinity, decimal values, and negative counts;
- total derived from that service contract's measure list;
- duplicate logical identity and revision conflict checks;
- period is OPEN for ordinary write actions;
- request idempotency check before any append;
- payload size and rate limits appropriate for Apps Script;
- HTML output escaped; no untrusted content rendered as markup.

Client validation improves usability only; server-side validation is the security and integrity boundary.

## 6. Reliability and concurrency

For the initial Apps Script runtime:

- use `LockService` around idempotency check + identity/revision check + staging write + audit write;
- batch sheet reads/writes rather than issuing a spreadsheet call per field;
- use UUIDs for event, record, revision, and submission identities;
- use bounded retry with the same idempotency key; do not generate a new key for a retry;
- return the original result for duplicate submissions;
- preserve a detectable state if a write succeeds but a later audit/verification operation fails; reconcile it rather than blindly retrying;
- provide a consistency verifier for orphaned submissions, missing audit events, duplicate active revisions, and invalid status transitions.

Google Sheets is not a relational transactional database. Locking and idempotency reduce race conditions but do not create full multi-sheet ACID transactions. The implementation must therefore design writes to be recoverable and add integrity checks; do not claim stronger transactional guarantees than the platform provides.

## 7. Security, privacy, and governance

- Continue the existing Google identity and server-side RBAC model; deny by default.
- Proposed capabilities for review: `daily.read`, `daily.write`, `daily.submit`, `daily.review`, `daily.approve`, `daily.correct`, `daily.void`, `daily.period.close`, `daily.period.reopen`.
- Map capabilities to roles only after workflow approval; never authorize based on client-supplied role values.
- Keep write/approval/close operations separate from read-only dashboard queries.
- Do not collect personal/foreign-national information; this is aggregate operational service reporting.
- Avoid exposing Spreadsheet IDs, privileged configuration, raw exceptions, or internal audit payloads to unauthorized users.
- Audit logs record actor, event, dataset family, record/revision IDs, outcome, timestamp, reason, and correlation/submission ID.
- Governed export and backup/snapshot verification must be included before production certification.

## 8. Aggregation and canonical monthly protection

Daily data may produce read-only daily, monthly, and yearly projections from approved revisions only. The daily-derived monthly result is a separate projection, not a write into either existing monthly dataset.

For a month already represented in the historical monthly baseline, publish a reconciliation showing row counts, totals by office, deltas by measure, missing/unexpected offices, unresolved corrections, and period status. No automatic merge, replacement, or silent backfill is allowed.

The existing monthly datasets must pass regression unchanged before and after deployment. Daily entry must not call the existing monthly `commitImport()` seam and must not alter monthly importer/registry semantics.

## 9. Technology decision

**Keep the existing runtime for the first implementation:** Google Apps Script Web App, Google Sheets as the current persistence layer, existing GitHub Actions + clasp CI/CD, and the existing server-side service/RBAC/audit patterns.

This is the least-risk path because it extends the canonical application rather than introducing a second runtime or write path. Use advanced engineering controls—versioned contracts, idempotency, append-only revisions, explicit state machines, server-side authorization, batch I/O, lock-guarded writes, reconciliation, automated integrity tests, and deployment evidence.

Do not add Node.js/PostgreSQL solely for this form. Revisit a database-backed runtime only through a separate architecture decision if measured concurrency, data volume, transactional requirements, quotas, or operational SLOs exceed Apps Script/Sheets capabilities. Any future migration must preserve the same contracts and evidence gates.

## 10. Delivery phases and acceptance gates

### Gate 9.1 — Contract and workflow freeze

- Confirm daily operational semantics and owners for both service families.
- Approve fields, required measures, total calculation, logical key, zero/missing semantics, and timezone.
- Approve who may draft, submit, review, approve, correct, void, close, and reopen.
- Record schema version and representative fixtures.
- No production writes.

### Gate 9.2 — Staging and lifecycle core

- Add separate service-specific staging/revision stores and the idempotency ledger.
- Add server-side validators and explicit state transitions.
- Add RBAC checks, lock-guarded write seam, and audit coverage.
- Add consistency verification; no dashboard integration yet.

### Gate 9.3 — Responsive input workspace

- Add one service-selector form with dynamic contract-driven fields.
- Add draft, submit, validation summary, duplicate/conflict, and retry states.
- Add accessibility and mobile UAT.
- Ensure no client-side path can bypass server validation.

### Gate 9.4 — Review and period governance

- Add review queue and authorized approve/return/void actions.
- Add explicit period review/close/reopen controls with reason and audit.
- Add append-only corrections and concurrency conflict tests.

### Gate 9.5 — Read-only reporting and reconciliation

- Add approved daily views and derived monthly/yearly projections.
- Add reconciliation against the canonical monthly baseline.
- Keep historical monthly datasets read-only from this feature.

### Gate 9.6 — Production governance

- Verify export, backup snapshot, manifest/checksum, and restore/recovery evidence.
- Add smoke checks for form access, RBAC negative cases, staging counts, idempotency, audit, and both service contracts.
- Record the full release evidence chain.

### Gate 9.7 — Controlled production UAT

Test at minimum: valid report; each service family; invalid date; unknown/inactive office; negative/decimal/blank measures; derived totals; duplicate submit; retry after simulated timeout; two concurrent submissions; edit draft; return for correction; approved correction; void; closed period; unauthorized approval; audit completeness; app restart/reload; export/backup verification; and unchanged monthly baseline.

Release sequence is mandatory:

```
contract freeze -> fixtures/tests -> CI PASS -> forensic diff PASS
-> merge -> canonical Apps Script deployment -> production smoke
-> browser UAT -> regression/integrity evidence -> roadmap reconciliation
```

No direct production deployment from an unreviewed branch. A green CI run alone is not production certification.

## 11. Non-goals and explicit holds

- WhatsApp group reading, WhatsApp API selection, bots, and message ingestion: **HOLD**.
- Direct writes from daily form to canonical monthly datasets.
- Automatic replacement/backfill of historical monthly data.
- Universal daily table with mixed service-specific measures.
- Client-only validation or authorization.
- Silent overwrites of approved reports.
- Database/runtime migration in the same change.
- New dashboard features before the input and integrity gates pass.

## 12. Definition of done

The feature is not complete until both service contracts are tested, duplicate/retry behavior is proven, revisions are auditable, unauthorized operations are denied, approved aggregates are reproducible, export/backup verification passes, monthly baselines remain unchanged, and production browser UAT is evidenced against the canonical deployment.

## 13. Alignment with the approved GIS First product design

The daily-input workspace belongs inside the existing INTAL WEB APP shell; it is not a separate application and must not become a new dashboard.

- Reuse the approved GIS First shell: dark-navy application header, official identity, global service selector, authenticated user/role menu, permission-aware navigation, typography, spacing, status colors, and shared responsive components.
- Add a dedicated **Input Harian** route/workspace within the existing navigation. Do not put a map, charts, or KPI tiles above the form; the entry task must be fast, focused, and usable on a narrow Android viewport.
- The global service selector and the form's service-family selection must stay synchronized. Changing service family clears incompatible unsaved field state only after a confirmation if data has been entered.
- Use a short, guided workflow: **Konteks laporan → Angka layanan → Validasi → Simpan/Kirim**. On desktop, use a two-column form only where it improves scanability; on mobile, use a single column with large numeric inputs and no horizontal scrolling.
- Reuse the verified Office Reference and stable office identity; display its canonical office name. Do not permit free-text office names or invent branch locations.
- Use the existing design language for status chips, inline validation, confirmation dialogs, toasts, loading states, empty states, and error recovery. Color is never the sole signal; labels and icons must also communicate state.
- Provide a review queue as a separate permission-gated view, not mixed into the operator's entry form. The review queue may later link to approved reporting; it must not alter GIS dashboard behavior before Gate 9.5.
- The form is online-first in v1. On network timeout, retain the same submission UUID and offer safe retry/status recovery; do not silently create a new request. Offline queuing, browser storage of drafts, and background synchronization are excluded until their privacy and conflict behavior are separately reviewed.
- Meet WCAG 2.2 AA-oriented requirements where applicable: semantic labels, keyboard operation, visible focus, sufficient contrast, announced validation summaries, target sizes appropriate for touch, and reduced-motion respect. Verify in current desktop Chrome and Android Chrome.

Reference: `docs/UI-REFERENCE-GIS-FIRST.md`. The UI reference governs shell and visual consistency; it does not authorize changes to canonical data contracts or production release gates.

## 14. Advanced but runtime-compatible technical architecture

Use a **modular, contract-first architecture** inside the existing Apps Script project. “Modern” means explicit boundaries, reproducible behavior, security, observability, and testable delivery—not adding frameworks or infrastructure that the current runtime cannot support.

### Logical modules

| Module | Responsibility | Prohibited coupling |
|---|---|---|
| DailyInputController | Route/API boundary, request parsing, response envelope | No direct sheet mutation from HTML/controller |
| DailyContractRegistry | Versioned Residence/Passport field definitions, labels, requiredness and measure lists | No inferred contract from client payload |
| DailyValidationService | Normalize and validate date, office, measures, totals, status and contract version | No client-only validation |
| DailyAuthorizationPolicy | Capability checks for every operation | No role/permission trust from browser input |
| DailyCommandService | Draft, submit, approve, return, correct, void and period commands | No writes into monthly importer/registry seam |
| DailyRepository | Batched persistence behind one repository interface | No direct spreadsheet calls from UI |
| DailyIdempotencyService | Submission UUID and repeat-request result | No new UUID on a retry of the same intent |
| DailyRevisionService | Immutable submitted/approved history and correction links | No in-place mutation of approved evidence |
| DailyAuditAdapter | Existing audit pattern, correlation IDs and event outcomes | No silent audit failures |
| DailyProjectionService | Read-only aggregates from latest approved, non-void revisions | No automatic monthly baseline overwrite |
| DailyIntegrityVerifier | Detect orphaned writes, duplicate active revisions, invalid transitions and missing audit | No repair without recorded evidence |
| DailyUi | Accessible form shell and state rendering | No authority over permissions, totals or status |

These are logical boundaries, not a mandate to create one file per module if the repository's Apps Script layout or current test shim makes that unsafe. Follow the existing GAS naming, include and test conventions after inspecting them.

### Contract-as-code and API envelope

- Define a versioned server-owned contract per family. The UI receives display metadata from the server; it must not submit arbitrary field names that the server accepts without registry validation.
- Every command request carries `requestId` (UUID), `contractVersion`, `serviceFamily`, and the expected record/revision version when editing. The server returns a stable envelope: `ok`, `requestId`, `code`, `message`, `fieldErrors`, and `data`.
- Use deterministic error codes for validation, authorization, period-closed, duplicate, stale-revision, retryable failure, and internal failure. Never send stack traces, spreadsheet identifiers, or secrets to the browser.
- Use optimistic revision checks plus a short `LockService` critical section for idempotency and identity conflict detection. Keep locks narrow; perform validation and non-mutating reference reads before entering the critical section where safe.
- Use batched range reads/writes and a write-ahead command/intent marker where the current storage pattern can support it. Treat partial multi-sheet writes as a recoverable consistency incident, not as an atomic transaction.
- Make commands idempotent and reads side-effect-free. A repeated request with the same request ID returns the recorded outcome; a request with a stale expected revision returns a conflict and never overwrites newer work.
- Use an explicit feature flag/config gate to keep daily write routes disabled until contract approval, authorization, staging readiness, and smoke tests pass. A hidden menu item is not a security control.

### Reliability, observability, and security

- Add a correlation ID from browser request through command result and audit record; record event name, family, record/revision ID, actor, duration, outcome, and sanitized error category.
- Do not log full submitted payloads. Aggregate counts may still be operationally sensitive; logs should contain IDs and diagnostics, not unnecessary row contents.
- Use bounded retries only for retryable failures, with backoff and the same request ID. Never blindly retry a command after an ambiguous write; query the idempotency ledger and run consistency verification.
- Apply deny-by-default RBAC on every server command, including detail reads, draft reads, exports, approvals, correction, void, close and reopen. Test both allowed and denied paths.
- Escape output and render user-facing text as text, not HTML. Validate dates against the canonical Asia/Jakarta business date and reject malformed or out-of-range input.
- Do not add external JavaScript/CDN dependencies, a second database, or a new runtime without a reviewed ADR, security assessment, version pinning, and measurable justification. The current GAS + Sheets boundary remains the v1 delivery target.

### Test pyramid and quality gates

1. **Contract tests:** exact required fields, measure allowlists, contract version, total derivation, zero/missing semantics, and deterministic error codes for both families.
2. **Pure unit tests:** date/period normalization, integer validation, derived totals, status transitions, permissions, revision checks, and projection calculations.
3. **Repository/adapter tests:** sheet headers/schema signatures, batch writes, lock conflict behavior, idempotency ledger, partial-write recovery and audit coverage using the existing test shim.
4. **Negative/security tests:** unauthenticated request, missing capability, spoofed role, unknown/inactive office, injected field name, stale revision, closed period, replayed request and unauthorized export.
5. **Regression tests:** existing import, canonical monthly dataset identity, dashboard, GIS, office reference, export, backup/snapshot and production smoke remain unchanged.
6. **Browser UAT:** 1440px/1920px desktop and Android mobile widths, keyboard-only entry, long office names, slow network, duplicate tap, reload after timeout, and clear validation recovery.

The existing `npm test`/GitHub Actions path remains the first required CI gate. Expand it with deterministic contract and lifecycle tests before adding browser automation. Browser automation may be introduced as a separately reviewed test dependency; it must not be added to the deployed GAS runtime.

## 15. Gate 9.1 — exact stop conditions

The prior source audit found no existing daily spreadsheet/export or approved SOP that proves operational daily semantics. Introducing the in-app form establishes a **new prospective capture source**, but it does not automatically prove that the proposed daily fields mean the same thing as the monthly fields.

Before enabling writes, the contract owner must approve and attach evidence for each family. In addition, the daily lifecycle must be reconciled with the existing monthly **Period Closing & Controlled Correction v1** implementation so period-state semantics, correction reasons, audit vocabulary, and authorization boundaries do not diverge or create competing write seams:

- what one report represents (candidate: one operational date × one verified immigration office × one service family);
- whether a date with no service is a valid zero report, a missing report, or not reportable;
- whether every listed measure is daily-reportable and what each measure counts;
- whether a report can be split across units/shifts and how those reports combine;
- reporting cutoff, late submission, duplicate detection, corrections, and period close/reopen;
- required roles and separation of operator, reviewer, approver, and auditor;
- a normal fixture and a correction fixture, signed off by the responsible operational owner.

Until those semantics and owners are approved, the contracts in this document remain **candidate v1 contracts**, not production-authorized schemas. No historical daily backfill may be synthesized from monthly totals. New prospective entries must begin only from an explicitly approved effective date; monthly historical data remains authoritative and unchanged.

## 16. Explicit implementation order

1. Freeze and approve Gate 9.1 contract decisions and fixtures.
2. Reconcile the daily period/revision model with the existing monthly Period Closing & Controlled Correction v1 gate; reuse compatible policy/audit patterns without sharing incompatible dataset writes.
3. Add server-owned contract registry, validators, capability checks, repository seam, idempotency ledger and audit integration.
4. Add staging/revision storage behind a feature flag; prove integrity and recovery tests.
5. Implement the GIS First-aligned responsive input workspace.
6. Implement review/correction/period governance.
7. Implement read-only approved projections and baseline reconciliation.
8. Complete export, backup/snapshot, recovery, production smoke and browser UAT evidence.
9. Only then consider enabling daily reporting to operational users.

No phase may be skipped because the UI looks complete or CI is green.

