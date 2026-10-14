# Phase 9 — Gate 9.1 Operational Contract Decision Register

**Status: BLOCKED — operational contract not yet signed off**  
**Applies to:** one INTAL WEB APP daily-input form for Izin Tinggal and Paspor  
**Implementation boundary:** contract/validator foundation only; no daily writes, staging-sheet creation, UI, or production deployment is authorized by this register.

## Purpose

Gate 9.1 freezes the meaning and reporting rules of daily operational measures before persistence or workflow code is implemented. Existing monthly datasets remain canonical and untouched. Candidate daily measure keys are not, by themselves, proof that monthly and daily measures have identical operational definitions.

## Decisions requiring explicit owner sign-off

| Decision | Safe proposed default | Gate evidence required |
|---|---|---|
| Daily measure meaning | Approve a written definition for every measure in each service family. Do not infer meaning from key names or monthly labels alone. | Signed-off data dictionary with definition, unit, inclusion/exclusion rules, and examples. |
| Requiredness | Every measure in the approved contract is required at submission. Drafts may be incomplete. | Per-measure required/optional decision; if optional, define the semantic difference between omitted and zero. |
| Zero vs. missing | Explicit 0 means the reporter confirms zero activity. Blank/null means not reported and must not silently become zero. | Approved rule for each measure; validator fixtures for zero, blank, and null. |
| Daily total | Server derives the total from the exact approved measure set. Client-supplied total is never trusted as authoritative. | Formula and expected totals for representative fixtures. |
| Operational date and timezone | Calendar date interpreted in Asia/Jakarta; store/compare the business date separately from audit timestamps. | Confirmation of date cutover, late-entry policy, and timestamp convention. |
| Reporting cutoff | No cutoff is assumed by the current validator. Define when a daily report is due and whether late submission is allowed. | Per-service cutoff and late-submission rule. |
| Office identity | Accept only a stable Office Reference key verified server-side; display names are labels, not identifiers. | Mapping from form options to canonical Office Reference keys, plus unknown/inactive-office negative tests. |
| Duplicate and retry behavior | submissionId is an idempotency key. A retry returns the original result; a second report for the same date + office + service family follows a governed correction/revision path. | Concurrency/retry test cases and approved conflict response. |
| Authorization | Deny by default. Separate permission to create/edit drafts, submit, review/approve, correct after approval, void, close, and reopen periods. dashboard.read does not grant write access. | Role-to-action matrix and negative authorization tests. |
| Review and approval | Submitter cannot approve their own submission unless an explicit separation-of-duties exception is approved and audited. | Reviewer assignment, separation-of-duties rule, rejection/return reasons. |
| Correction and void | Submitted/approved revisions are immutable; correction creates a linked revision. Void is explicit, authorized, reasoned, and audited. | Approved lifecycle transitions and test matrix. |
| Period closing | No daily period is considered closed implicitly. Define open/review/closed states and authorized post-close correction/reopen procedure. | Close/reopen policy and period-level reconciliation checklist. |
| Aggregation | Only the latest approved, non-void revision contributes to daily approved views and any future monthly/yearly projections. No automatic write-back into existing monthly datasets. | Reconciliation examples, treatment of late corrections, and separate approval for any future reporting adapter. |
| Audit and retention | Record actor, timestamps, contract version, submission/idempotency identity, state transitions, and reason for governed changes. | Approved audit fields, retention/access policy, and evidence of audit failure behavior. |

## Candidate service measure inventory

These are implementation candidates, not approved daily definitions.

### Izin Tinggal — 13 candidate keys

bvk, voa, itk, itk_peralihan, itas, itap, itkt, alih_status_itk_ke_itas, alih_status_itas_ke_itap, abg, epo, imk, skim.

For each key, the operational owner must specify: display label; exact service/product counted; unit; event counted (e.g. application, decision, document issued, or another defined event); inclusion/exclusion rules; whether zero is valid; whether the measure is required; and at least one positive, zero, and boundary example.

### Paspor — 4 candidate keys

biasa_24, biasa_48, elektronik_48, e_polikarbonat.

For each key, the operational owner must specify: display label; exact passport service/product counted; unit and event counted; treatment of replacement/reprint/other exceptional cases if applicable; inclusion/exclusion rules; whether zero is valid; whether the measure is required; and positive, zero, and boundary examples.

## Required sign-off record

Do not mark Gate 9.1 PASS until all of the following are recorded in this file or a linked, versioned approval artifact:

- [ ] Izin Tinggal data owner approves all 13 definitions and rules.
- [ ] Paspor data owner approves all 4 definitions and rules.
- [ ] Operations owner approves daily cutover, reporting cutoff, late-entry, and correction policy.
- [ ] Application/security owner approves role-to-action matrix and separation of duties.
- [ ] Data owner approves total formulas and sample reconciliation fixtures.
- [ ] Engineering verifies that every approved rule has a deterministic test.
- [ ] Reviewer confirms the contract version and approval date.

**Approvers:** pending  
**Approval date:** pending  
**Approved contract version:** pending  
**Gate result:** **NOT PASSED**

## Implementation stop conditions

Until the sign-off record is complete:

1. Keep DAILY_INPUT_GUARD_V1.enabled = false.
2. Do not add persistence commands, create sheets, or expose a usable daily-entry form.
3. Do not change DATASET_CONTRACTS, monthly importers, monthly period-close logic, registry identity, historical monthly rows, or existing dashboards.
4. Do not merge/deploy this foundation as a production release unless the full controlled release gate is intentionally run; merging to main triggers the existing Apps Script deployment workflow.
5. Keep WhatsApp integration on HOLD.

## Post-approval engineering sequence

1. Update the versioned service contracts and validator fixtures from the signed-off decisions.
2. Implement isolated staging storage and an idempotent submission ledger with concurrency protection.
3. Implement server-side Office Reference validation and dedicated RBAC checks for each lifecycle action.
4. Implement draft → submitted → needs-correction/approved, revision, void, and period-close behavior with immutable audit evidence.
5. Test retries, concurrent submissions, duplicate logical reports, unauthorized actors, stale revisions, post-close corrections, and audit failures.
6. Only after those tests pass, build the single responsive form with the service selector.
7. Release through CI green → forensic diff PASS → explicit merge decision → canonical deployment evidence → production smoke → browser UAT → regression/integrity evidence.
