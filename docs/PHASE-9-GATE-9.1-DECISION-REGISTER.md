# Phase 9 — Gate 9.1 Operational Contract Decision Register

**Status: IN PROGRESS — owner decisions recorded for counting basis and late entry; remaining Gate 9.1 items still block implementation**  
**Applies to:** one INTAL WEB APP daily-input form for Izin Tinggal and Paspor  
**Implementation boundary:** contract/validator foundation only; no daily writes, staging-sheet creation, UI, or production deployment is authorized by this register.

## Purpose

Gate 9.1 freezes the meaning and reporting rules of daily operational measures before persistence or workflow code is implemented. Existing monthly datasets remain canonical and untouched. Candidate daily measure keys are not, by themselves, proof that monthly and daily measures have identical operational definitions.

## Decisions requiring explicit owner sign-off

| Decision | Safe proposed default | Gate evidence required |
|---|---|---|
| Daily measure meaning | **Owner decision recorded 2026-10-15:** count services completed or documents issued on the operational date. Apply this basis to all 17 candidate indicators; do not count intake/receipt alone. Per-indicator inclusion/exclusion rules still need explicit examples. | Signed-off data dictionary with exact event/unit, inclusion/exclusion, boundary examples and per-measure decision. |
| Requiredness | Proposed technical default: every measure in the approved contract is required at final submit; drafts may be incomplete. Not operationally approved yet. | Per-measure required/optional decision; if optional, define the semantic difference between omitted and zero. |
| Zero vs. missing | Explicit 0 means the reporter confirms zero activity. Blank/null means not reported and must not silently become zero. Proposed invariant pending owner sign-off. | Approved rule for each measure; validator fixtures for zero, blank, and null. |
| Daily total | Server derives total from the exact approved measure set. Client-supplied total is never authoritative. | Formula and expected totals for representative fixtures. |
| Operational date and timezone | Business date is the original operational date in Asia/Jakarta, separate from audit timestamps. **Owner decision recorded 2026-10-15:** late entry is allowed when the original operational date is retained and the reason plus audit evidence are recorded. No backdating to submission time. Exact event-time cutover and timestamp convention remain to be specified. | Deterministic date-boundary/timestamp rules and tests; late-entry reason and audit fields must be mandatory. |
| Reporting cutoff | Late reporting is not rejected solely because the day has ended; preserve original operational date and require reason + audit. A reporting deadline/late label may be used operationally but must not rewrite business date. | Confirm due-time/late-label policy and test that late arrival cannot alter operational date or bypass audit. |
| Office identity | Accept only stable office_key resolved server-side to exactly one OFFICE_REFERENCE record with status=VERIFIED. Reject missing/duplicate/unknown/non-verified keys. Display names are labels, never identifiers. | Confirm office key uniqueness and inactive-office behavior; add negative tests for missing, duplicate, unknown, PENDING, and other statuses. |
| Duplicate logical report | Uniqueness candidate: operational date + canonical office key + service family. A conflict must use a governed revision path, never silent overwrite. Pending owner confirmation. | Approve conflict behavior and fixture for a second report for the same logical key. |
| Retry/idempotency | Same submissionId + same canonicalized payload returns the original recorded outcome; a reused ID with different payload is rejected as an idempotency conflict. Enforce under a lock/atomic ledger operation. | Concurrency/retry test cases, payload-hash policy, and approved conflict response. |
| Authorization | Deny by default. Distinct server-side permissions for draft, edit, submit, review, approve, correction, void, close, and reopen. dashboard.read grants no mutation authority. | Named role-to-action matrix and negative authorization tests. |
| Review and approval | Proposed separation of duties: submitter cannot approve own report; exception must be explicit, narrowly scoped, and audited. | Reviewer assignment, separation-of-duties rule, rejection/return reasons. |
| Revision and void | Submitted/approved revisions are immutable. Corrections create linked revisions with reason and actor. Void is a separate authorized, reasoned, audited transition; no physical deletion of approved evidence. | Approved lifecycle transitions and tests. |
| Period closing | Explicit open → review → closed state; no implicit close. Reopen/post-close correction requires a dedicated permission, reason, and audit trail. Exact cutoffs and authority are pending. | Close/reopen policy and period-level reconciliation checklist. |
| Aggregation | Only latest approved, non-void revision contributes to approved daily views and separately approved future projections. No automatic write-back into existing monthly datasets. | Reconciliation examples, late-correction treatment, and separate approval for any reporting adapter. |
| Audit and retention | Record actor, ISO audit timestamps, business date and timezone, contract version, submission/idempotency identity, revision links, before/after state, reason, and outcome. Fail closed if required audit evidence cannot be persisted. | Approve retention/access policy, exact fields, and audit-failure tests. |
| Staging isolation | No production data writes while Gate 9.1 is blocked. After sign-off, use a separately named and access-restricted staging store/ledger, with no aliases or fall-through to monthly dataset paths. | Staging schema/access review, explicit environment identity assertion, and tests proving monthly stores are untouched. |

## Candidate service measure inventory

These are implementation candidates, not approved daily definitions. Names and labels below are not enough to establish business meaning.

### Izin Tinggal — 13 candidate keys

| Candidate key | Candidate label | Operational event/unit | Inclusion/exclusion | Required? | Zero valid? | Examples | Decision |
|---|---|---|---|---|---|---|---|
| bvk | BVK | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| voa | VOA | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| itk | ITK | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| itk_peralihan | ITK Peralihan | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| itas | ITAS | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| itap | ITAP | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| itkt | ITKT | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| alih_status_itk_ke_itas | Alih Status ITK ke ITAS | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| alih_status_itas_ke_itap | Alih Status ITAS ke ITAP | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| abg | ABG | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| epo | EPO | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| imk | IMK | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| skim | SKIM | Pending owner definition | Pending | Pending | Pending | Pending | Pending |

### Paspor — 4 candidate keys

| Candidate key | Candidate label | Operational event/unit | Inclusion/exclusion (including replacement/reprint) | Required? | Zero valid? | Examples | Decision |
|---|---|---|---|---|---|---|---|
| biasa_24 | Paspor Biasa 24 | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| biasa_48 | Paspor Biasa 48 | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| elektronik_48 | Paspor Elektronik 48 | Pending owner definition | Pending | Pending | Pending | Pending | Pending |
| e_polikarbonat | Paspor Elektronik Polikarbonat | Pending owner definition | Pending | Pending | Pending | Pending | Pending |

## Owner/authority record

| Required approval | Named approver | Evidence / role verification | Status |
|---|---|---|---|
| Izin Tinggal owner — 13 definitions | Pending | Pending | Pending |
| Paspor owner — 4 definitions | Pending | Pending | Pending |
| Operations — date cutover, cutoff, late entry, corrections, closing | Pending | Pending | Pending |
| Application/security — RBAC and separation of duties | Pending | Pending | Pending |
| Data owner — totals and reconciliation | Pending | Pending | Pending |
| Engineering — deterministic tests and isolated storage boundary | Pending | CI evidence required after approved semantics | Pending |
| Independent reviewer — contract version/date | Pending | Pending | Pending |

## Engineering acceptance checklist

- [ ] Each of the 17 measures has a complete, approved operational definition.
- [ ] Required/optional and zero/missing behavior is explicit for every measure.
- [ ] Representative valid, zero, missing, invalid, and boundary fixtures exist.
- [ ] Date boundary, late-entry, duplicate, retry, revision, and period-close cases are tested.
- [ ] Office key uniqueness and exactly-one-VERIFIED-record resolution are enforced server-side.
- [ ] Role/action matrix and negative authorization tests are approved.
- [ ] Totals reconcile from the approved measure list and safe-integer rules.
- [ ] Contract version and named owner approval date are recorded.
- [ ] Staging isolation, idempotency/concurrency, audit-failure and no-monthly-write protections pass.
- [ ] Gate 9.1 review explicitly records PASS before Gate 9.2 persistence implementation starts.

**Gate status: BLOCKED until completed and approved.** This register does not authorize writes, staging-sheet creation, UI activation, merge, or production deployment.

## Requester authorization note — 2026-10-15

The project requester explicitly authorized proceeding and accelerating the Phase 9 work. This authorizes controlled preparation and approval workflow. The requester's organizational role and delegated authority for each operational/data/security owner role have not been independently established in this repository record.

**Effect on gate:** this note does not mark Gate 9.1 PASS and does not replace sign-off for all 17 measure definitions, operational date/cutoff/late-entry rules, Office Reference identity policy, role/action matrix, correction/revision/period-close policy, total formulas, and audit/retention rules.

**Requester authorization date:** 2026-10-15  
**Requester identity/role recorded in this artifact:** not verified  
**Operational owner sign-off:** pending  
**Gate result:** BLOCKED — NOT PASSED

## Implementation stop conditions

1. Keep DAILY_INPUT_GUARD_V1.enabled = false.
2. Do not add persistence commands, create sheets, or expose a usable daily-entry form while Gate 9.1 is blocked.
3. Do not change DATASET_CONTRACTS, monthly importers, monthly period-close logic, registry identity, historical monthly rows, or existing dashboards.
4. Do not merge/deploy this foundation as a production release unless the full controlled release gate is intentionally run; merging to main triggers the existing Apps Script deployment workflow.
5. Keep WhatsApp integration on HOLD.

## Post-approval engineering sequence

1. Freeze the signed-off, versioned service dictionary and regenerate deterministic validator fixtures.
2. Design and review an isolated staging schema plus idempotency ledger; prove environment separation and no path to monthly stores before enabling writes.
3. Implement an atomic/lock-protected submission ledger: same ID/same payload returns original outcome, same ID/different payload rejects, concurrent requests cannot create duplicates.
4. Implement exact-one verified Office Reference lookup and dedicated server-side RBAC per lifecycle action.
5. Implement immutable revision linkage, draft → submitted → review/approved or returned, void, period close/reopen, and mandatory audit evidence.
6. Test retries, concurrent submissions, logical duplicates, unauthorized actors, stale revisions, post-close corrections, audit failures, staging isolation, and unchanged monthly baselines.
7. Only after these tests pass, build the single responsive form with service selector.
8. Release: CI green → forensic diff PASS → explicit merge decision → canonical deployment evidence → production smoke → browser UAT → regression/integrity evidence.


## Owner decisions recorded — 2026-10-15

The project owner explicitly decided:

1. **Counting basis for all 17 candidate indicators:** count services completed or documents issued. Intake/receipt alone is not the daily count. Engineering must still define the precise completion/issuance event, unit, inclusion/exclusion, cancellations/reprints/transitions, and examples separately for each indicator before the measure dictionary is complete.
2. **Late entry:** allowed. Retain the original operational date in Asia/Jakarta and capture a reason plus an auditable record of the late submission (actor and audit timestamp at minimum). Submission time must not silently replace operational date; late entry must not overwrite an existing submitted/approved revision.

These decisions are accepted for Gate 9.1 contract and test design. They do **not** approve the still-pending per-measure edge cases, required/optional and zero/missing rules, Office Reference identity behavior, authorization matrix, idempotency/concurrency behavior, correction/void/period-close rules, total formulas, retention policy, or staging controls.

**Gate result remains BLOCKED** until the complete acceptance checklist passes. No persistence, user-facing daily input, merge, or production deployment is authorized by this record.
