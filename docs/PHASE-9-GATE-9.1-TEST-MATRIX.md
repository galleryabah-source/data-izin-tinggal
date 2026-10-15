# Phase 9 — Gate 9.1 Test Matrix for Counting and Late Entry

**Status:** TEST DESIGN — owner decisions recorded 2026-10-15; not evidence of Gate 9.1 PASS.
**Scope:** common policy tests for the 13 Residence Permit and 4 Passport candidate measures.
**Boundary:** no persistence, UI activation, merge, or deployment is authorized.

## 1. Approved policy invariants

1. Count a service when processing is complete or the relevant document is issued. Receipt/intake alone is not a count.
2. A late report is allowed. Preserve the original operational date in Asia/Jakarta and require a reason.
3. Audit time and operational date are separate. Actor identity and audit timestamp must be resolved/generated server-side, not trusted from client payload.
4. A late report must not overwrite an existing submitted/approved revision. It follows the approved duplicate/revision rules.
5. Explicit zero remains distinguishable from missing input; per-measure requiredness and zero/missing semantics still require final owner approval.
6. Existing monthly datasets are read-only to Phase 9.

## 2. Shared counting-basis test matrix

| Case | Fixture | Expected outcome | Gate note |
|---|---|---|---|
| Final service completion | One unique service reaches its approved final-completed state on the operational date | Count exactly once under the approved indicator | Final status/event mapping must be specified per indicator |
| Document issued | One relevant document is issued on the operational date | Count exactly once under the approved indicator | Issuance evidence/event mapping must be specified per indicator |
| Receipt only | Application/request received, but service remains pending | Do not count | Approved common rule |
| In progress | Processing started but not complete and no document issued | Do not count | Approved common rule |
| Rejected/failed | Service does not reach the qualifying completion/issuance event | Do not count unless an indicator-specific rule is explicitly approved | Confirm edge cases per indicator |
| Cancelled/voided | Record cancelled/voided before qualifying completion/issuance | Do not count in approved totals | Confirm post-completion cancellation/reversal rules |
| Duplicate event | Same qualifying service event is delivered twice | Count once; detect duplicate identity | Define stable source/event identity before implementation |
| Correction/reissue/reprint | A completed service later receives a correction or replacement document | Do not automatically add a second count | Owner must approve per-indicator inclusion/exclusion |
| Service completion and issuance both recorded | Same underlying service has both completion and issuance events | Do not double-count the same service merely because two lifecycle events exist | Confirm event precedence per indicator |

## 3. Late-entry test matrix

| Case | Input/condition | Expected outcome |
|---|---|---|
| Same-day entry | Operational date equals server-resolved business date | Accept subject to other validation and authorization |
| Valid late entry | Operational date is earlier than submission business date; reason supplied | Accept subject to other validation; retain original operational date and record late-entry reason |
| Missing reason | Late entry with blank/missing reason | Reject before persistence |
| Whitespace reason | Late entry with whitespace-only reason | Reject before persistence |
| Client attempts to set audit actor/time | Payload supplies actor ID or audit timestamp as authoritative values | Ignore/reject client authority; server derives actor and timestamp |
| Preserve original date | Late report submitted on a later day | Stored/reporting business date remains the original operational date |
| Late duplicate logical report | Existing report already exists for same date + office key + service family | Apply governed conflict/revision policy; never silently overwrite |
| Retry after timeout | Same submission ID and same canonical payload | Return original outcome; do not create another revision |
| Reused ID, changed payload | Same submission ID with different payload | Reject idempotency conflict |
| Late entry to closed period | Operational period is closed | Apply explicit reopen/post-close authorization and revision rules; no implicit reopen |
| Audit failure | Required audit evidence cannot be stored | Fail closed; do not report success |
| Timezone boundary | Event and submission timestamps straddle UTC/Asia-Jakarta date boundary | Resolve operational date under the approved Jakarta rule; exact event-time cutover remains a Gate 9.1 decision |

## 4. Required per-indicator fixture coverage

The following 17 candidate keys must each have positive, receipt-only/pending, explicit-zero, missing/null, invalid-count, duplicate, cancellation/reversal, correction/reissue, and date-boundary fixtures, adjusted where an edge case is not applicable and documented by the owner.

### Izin Tinggal — 13

`bvk`, `voa`, `itk`, `itk_peralihan`, `itas`, `itap`, `itkt`, `alih_status_itk_ke_itas`, `alih_status_itas_ke_itap`, `abg`, `epo`, `imk`, `skim`.

### Paspor — 4

`biasa_24`, `biasa_48`, `elektronik_48`, `e_polikarbonat`.

## 5. Gate 9.1 exit criteria still outstanding

- [ ] For every measure, name the qualifying completion/issuance event and unit.
- [ ] Approve inclusion/exclusion rules, including cancellations, transitions, reissue/reprint, and correction.
- [ ] Approve requiredness and explicit-zero versus missing/null semantics per measure.
- [ ] Approve exact operational date cutover, timestamp convention, reporting deadline/late label, and date-boundary fixtures.
- [ ] Approve office-key uniqueness/inactive-office behavior and test exactly-one-VERIFIED resolution.
- [ ] Approve duplicate/revision policy, idempotency conflict behavior, and concurrency strategy.
- [ ] Approve role/action matrix, submitter-reviewer separation, correction/void, period close/reopen, audit retention and audit-failure handling.
- [ ] Run deterministic CI tests and independent forensic diff review against the exact PR head.
- [ ] Record explicit Gate 9.1 PASS before Gate 9.2 persistence implementation.

**Stop condition:** Until all exit criteria pass, keep `DAILY_INPUT_GUARD_V1.enabled = false`, do not create staging stores or a usable form, and do not merge/deploy.
