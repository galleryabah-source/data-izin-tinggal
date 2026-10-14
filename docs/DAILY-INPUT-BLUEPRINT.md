# Daily Input Implementation Blueprint

**Status:** approved planning baseline — implementation not started  
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
