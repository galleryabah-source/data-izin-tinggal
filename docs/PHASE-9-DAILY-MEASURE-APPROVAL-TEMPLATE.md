# Phase 9 — Daily Measure Approval Worksheet

**Status:** OWNER AUTHORITY CONFIRMED IN CHAT — operational decisions still require explicit values below; this is not blanket approval of candidate semantics.  
**Owner authority record:** On 2026-10-15, the project owner stated: “Iya saya berwenang karena saya owner dan pemilik data.” This records authority to decide, not approval of unfilled measure definitions or workflow policies.  
**Related gate:** Gate 9.1  
**Contract version:** pending owner decision  
**Partial decision date:** 2026-10-15 (counting basis and late-entry policy only)  
**Izin Tinggal data owner:** common counting basis approved; per-measure edge-case sign-off pending  
**Paspor data owner:** common counting basis approved; per-measure edge-case sign-off pending  
**Operations owner:** pending  
**Security/application owner:** pending

## How to complete this worksheet

For every measure, owners must fill in the operational definition and explicitly choose requiredness and zero/missing semantics. Do not approve based on key names or display labels alone. A measure definition must state exactly which event is counted, the unit, and when that event belongs to the operational date. Add concrete examples and have Engineering turn them into deterministic validator and reconciliation fixtures.

For each measure, complete every column:
- **Operational event/unit:** exact counted event and unit (for example, applications received, decisions made, or documents issued — select only after owner confirms).
- **Inclusion/exclusion:** duplicate, cancellation, reprint/replacement, transition, correction, and any other applicable edge cases.
- **Required at submit:** Yes / No. If No, explain how omitted differs from zero.
- **Zero valid:** Yes / No. If No, explain smallest valid value and exceptional cases.
- **Examples:** positive, explicit zero, boundary/exception, and rejected example.
- **Owner decision:** Approved / Rejected / Needs clarification, with approver and date.

**Owner-approved common counting basis (2026-10-15):** all 17 candidate indicators count services completed or documents issued on the original operational date; intake/receipt alone is not counted. **Owner-approved late-entry rule (2026-10-15):** late entry is allowed if the original operational date is preserved and the reason, actor, and audit timestamp are recorded. These common rules do not complete each indicator's definition. Display labels below remain candidate labels only.

## Izin Tinggal measures — 13 candidates

| Candidate key | Candidate display label | Operational event and unit counted | Inclusion/exclusion rules | Required at submit? | Is zero valid? | Positive/zero/boundary examples | Owner decision / approver / date |
|---|---|---|---|---|---|---|---|
| `bvk` | BVK | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `voa` | VOA | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `itk` | ITK | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `itk_peralihan` | ITK Peralihan | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `itas` | ITAS | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `itap` | ITAP | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `itkt` | ITKT | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `alih_status_itk_ke_itas` | Alih Status ITK ke ITAS | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `alih_status_itas_ke_itap` | Alih Status ITAS ke ITAP | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `abg` | ABG | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `epo` | EPO | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `imk` | IMK | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `skim` | SKIM | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |

## Paspor measures — 4 candidates

| Candidate key | Candidate display label | Operational event and unit counted | Inclusion/exclusion (including replacement/reprint) | Required at submit? | Is zero valid? | Positive/zero/boundary examples | Owner decision / approver / date |
|---|---|---|---|---|---|---|---|
| `biasa_24` | Paspor Biasa 24 | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `biasa_48` | Paspor Biasa 48 | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `elektronik_48` | Paspor Elektronik 48 | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |
| `e_polikarbonat` | Paspor Elektronik Polikarbonat | Count completed service or document issuance; exact event/unit pending | Inclusion/exclusion pending | Pending | Pending | Pending | Pending |

## Shared workflow decisions

Values in the “Proposed technical baseline” column are engineering proposals for owner review only. They do not constitute operational approval.

| Topic | Proposed technical baseline for owner review | Decision / exception required from owner | Owner | Status |
|---|---|---|---|---|
| Operational date boundary | Business date is a date-only key in Asia/Jakarta; audit timestamps are separate. | Exact event-time cutover and timestamp convention. | Operations | Pending |
| Reporting deadline | No deadline is currently enforced. | Due time per service family, timezone, late-entry permission, and late-entry labeling. | Operations | Pending |
| Office identity | Resolve submitted office_key server-side to exactly one OFFICE_REFERENCE row with status VERIFIED; reject missing, duplicate, unknown, or non-verified keys. | Confirm canonical key, uniqueness, and behavior for inactive offices. | Data owner / Engineering | Pending |
| Duplicate logical report | Candidate logical key: operational date + office_key + service family; never silently overwrite. | Conflict response and when a new revision is allowed. | Operations / Engineering | Pending |
| Retry/idempotency | Same submissionId and same canonical payload returns the original outcome; same ID with a different payload is rejected. | Confirm conflict behavior and canonical payload hash/version approach. | Engineering | Pending |
| Authorization | Deny by default; dashboard.read grants no write access; permissions are separated by lifecycle action. | Named role-to-action matrix and any approved exception. | Security / Operations | Pending |
| Approval separation | Proposed default: submitter cannot approve own report. | Confirm rule, reviewer assignment, and rejection/return reasons. | Security / Operations | Pending |
| Correction after approval | Approved/submitted revisions immutable; correction creates linked revision with reason and actor. | Correction reasons and post-close handling. | Operations / Data owner | Pending |
| Void | Explicit, authorized, reasoned and audited state transition; no physical deletion of approved evidence. | Eligible states and authorized roles. | Operations / Security | Pending |
| Period close | Explicit open → review → closed; no implicit close. | Close criteria, reconciliation evidence, reopen authority, and post-close correction procedure. | Operations | Pending |
| Total formula | Server derives total from the exact approved measure list; client total is never authoritative. | Confirm formula and expected fixture totals for both service families. | Data owner / Engineering | Pending |
| Aggregation / historical baseline | Latest approved, non-void revision only; no automatic write-back to canonical monthly datasets. | Reconciliation examples and separate approval for any reporting adapter. | Data owner | Pending |
| Audit and retention | Capture actor, audit timestamp, business date/timezone, contract version, submission ID, revision links, state transitions, reasons, and outcomes; fail closed if required audit evidence cannot be stored. | Exact fields, retention duration, access policy, and audit failure handling. | Security / Data owner | Pending |
| Staging isolation | After Gate 9.1 only: separate restricted staging store/ledger; no fallback path to monthly datasets. | Environment identity, access list, and explicit proof monthly stores are untouched. | Engineering / Security | Pending |

## Engineering acceptance checklist

- [ ] All 17 measures have complete, approved operational definitions.
- [ ] Required/optional and zero/missing behavior is explicit for every measure.
- [ ] Positive, explicit-zero, missing, invalid, exception, and boundary fixtures exist for every measure.
- [ ] Date boundary, cutoff, late-entry, duplicate, retry, revision, void, and period-close cases are tested.
- [ ] Office key resolves to exactly one VERIFIED Office Reference row; negative tests cover missing, duplicate, unknown, PENDING, and other statuses.
- [ ] Named role/action matrix and negative authorization tests are approved.
- [ ] Totals reconcile from the approved measure list and safe-integer rules.
- [ ] Contract version, named approvers, approval date, and review evidence are recorded.
- [ ] Staging isolation, idempotency/concurrency, audit-failure, and no-monthly-write protections pass.
- [ ] Gate 9.1 review explicitly records PASS before Gate 9.2 persistence implementation starts.

**Gate status: BLOCKED until completed and approved.** This worksheet does not authorize writes, staging storage, UI activation, merge, or production deployment.
