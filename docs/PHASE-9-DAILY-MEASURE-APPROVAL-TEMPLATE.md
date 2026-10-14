# Phase 9 — Daily Measure Approval Worksheet

**Status:** TEMPLATE ONLY — no measure is approved by this document.  
**Related gate:** Gate 9.1  
**Contract version:** pending owner decision  
**Approval date:** pending  
**Izin Tinggal data owner:** pending  
**Paspor data owner:** pending  
**Operations owner:** pending  
**Security/application owner:** pending

## How to complete this worksheet

For every measure, owners must fill in the operational definition and explicitly choose requiredness and zero/missing semantics. Do not approve based on key names alone. A measure definition must state exactly which event is counted and when that event belongs to the operational date. Add concrete examples and have Engineering turn them into deterministic validator and reconciliation fixtures.

Allowed decision values:
- **Required at submit:** Yes / No (if No, explain how missing differs from zero).
- **Zero valid:** Yes / No (if No, explain the smallest valid value and exceptional cases).
- **Status:** Pending / Approved / Rejected / Needs clarification.

## Izin Tinggal measures

| Candidate key | Display label (owner fills) | Operational event and unit counted | Inclusion/exclusion rules | Required at submit? | Is zero valid? | Positive/zero/boundary examples | Owner decision |
|---|---|---|---|---|---|---|---|
| `bvk` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `voa` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `itk` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `itk_peralihan` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `itas` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `itap` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `itkt` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `alih_status_itk_ke_itas` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `alih_status_itas_ke_itap` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `abg` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `epo` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `imk` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `skim` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Paspor measures

| Candidate key | Display label (owner fills) | Operational event and unit counted | Inclusion/exclusion rules | Required at submit? | Is zero valid? | Positive/zero/boundary examples | Owner decision |
|---|---|---|---|---|---|---|---|
| `biasa_24` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `biasa_48` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `elektronik_48` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| `e_polikarbonat` | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Shared workflow decisions

| Topic | Decision to record | Owner | Status |
|---|---|---|---|
| Operational date boundary | Define when a service event is assigned to a date in Asia/Jakarta. | Operations | Pending |
| Reporting deadline | Specify per-service due time, timezone, and late-entry policy. | Operations | Pending |
| Office identity | Confirm the canonical Office Reference key and inactive-office behavior. | Data owner / Engineering | Pending |
| Duplicate report | Define conflict behavior for an existing date + office + service family. | Operations / Engineering | Pending |
| Retry/idempotency | Confirm that a retry with the same submission ID returns the original outcome. | Engineering | Pending |
| Approval separation | Define who may submit, review, approve, correct, void, close, and reopen; specify self-approval prohibition or approved exception. | Security / Operations | Pending |
| Correction after approval | Define reason requirements, revision linking, and treatment after period close. | Operations / Data owner | Pending |
| Period close | Define review/close criteria, reconciliation evidence, and authorized reopening. | Operations | Pending |
| Total formula | Confirm server-derived total for each service family and expected totals for fixtures. | Data owner / Engineering | Pending |
| Historical baseline | Confirm daily-derived monthly projections never silently replace historical monthly datasets. | Data owner | Pending |

## Engineering acceptance checklist

- [ ] Each of the 17 measures has a complete, approved definition.
- [ ] Required/optional and zero/missing behavior is explicit for every measure.
- [ ] Representative valid, zero, missing, invalid, and boundary fixtures exist.
- [ ] Date boundary, late-entry, duplicate, retry, revision, and period-close cases are tested.
- [ ] Role/action matrix and negative authorization tests are approved.
- [ ] Totals reconcile from the approved measure list.
- [ ] Contract version and owner approval date are recorded.
- [ ] Gate 9.1 review explicitly records PASS before Gate 9.2 implementation starts.

**Gate status: BLOCKED until completed and approved.** This worksheet does not authorize writes, staging storage, UI activation, merge, or production deployment.
