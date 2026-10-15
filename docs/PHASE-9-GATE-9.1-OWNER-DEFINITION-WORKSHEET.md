# Phase 9 — Gate 9.1 Owner Definition Worksheet (17 Measures)

**Purpose:** collect explicit operational definitions needed to close Gate 9.1. This worksheet is a decision aid, not an approval record.
**Status:** OPEN — no per-measure semantics are inferred or approved by this worksheet.
**Owner-approved common rules (2026-10-15):** count a service when processing is complete or the relevant document is issued; intake/receipt alone is not counted. Late entry is allowed only while preserving the original operational date in Asia/Jakarta, recording a reason, and retaining server-generated audit evidence.
**Safety boundary:** no persistence, staging store, daily-entry UI, merge, or deployment until the full Gate 9.1 exit checklist passes. Keep `DAILY_INPUT_GUARD_V1.enabled = false`; do not modify canonical monthly data or import paths.

## How to complete

For each measure, the accountable operational owner must supply concrete examples from the authoritative source system or approved SOP. Avoid using only the measure label as a definition.

- **Qualifying event:** exact final status/event code and the authoritative source field/table.
- **Unit:** what one count represents (e.g. distinct service case, issued document, or another owner-defined unit).
- **Event precedence:** when completion and issuance both exist for the same case, identify the single counting event or explicitly define distinct countable units.
- **Exclusions/reversals:** rejection, cancellation, void, duplicate, transfer, reissue/reprint, correction and post-completion reversal.
- **Requiredness:** required or optional at final submission.
- **Zero/missing:** define whether 0 is valid, and what blank/null means; never silently coerce missing to zero.
- **Fixtures:** at least one positive, one non-qualifying, one zero/missing, and applicable edge-case example with expected count.

## Decision table

| Key | Measure family | Qualifying event + authoritative source | Count unit | Completion/issuance precedence | Include/exclude, cancellation, reversal, reissue/reprint | Required? | Zero vs missing/null | Approved examples / fixture IDs | Owner decision |
|---|---|---|---|---|---|---|---|---|---|
| bvk | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| voa | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| itk | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| itk_peralihan | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| itas | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| itap | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| itkt | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| alih_status_itk_ke_itas | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| alih_status_itas_ke_itap | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| abg | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| epo | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| imk | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| skim | Izin Tinggal | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| biasa_24 | Paspor | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| biasa_48 | Paspor | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| elektronik_48 | Paspor | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| e_polikarbonat | Paspor | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

## Cross-cutting decisions required before Gate 9.1 PASS

- **Operational date:** authoritative event timestamp; timezone handling; exact Asia/Jakarta cutover; what to do when event time is absent or corrected.
- **Late entry:** reason validation; allowed lateness window if any; display/alert policy; post-close permissions. The original operational date must remain separate from `submitted_at`.
- **Office identity:** resolve submitted `office_key` server-side to exactly one `VERIFIED` Office Reference record; define inactive-office handling. Reject missing, unknown, duplicate, PENDING, or otherwise non-verified matches.
- **Logical duplicate:** approve uniqueness key and conflict/revision behavior. Never silently overwrite a submitted/approved report.
- **Idempotency/concurrency:** same submission ID + same canonical payload returns the prior result; same ID + changed payload rejects; concurrent requests cannot create duplicate revisions.
- **Authorization:** explicit role-to-action matrix for draft/edit/submit/review/approve/correct/void/close/reopen; submitter-reviewer separation and any exception must be explicitly approved and audited.
- **Lifecycle and audit:** immutable revisions, correction/void reasons, period close/reopen authority, audit retention/access, server-generated actor/time, and fail-closed behavior when audit evidence cannot be recorded.
- **Totals and aggregation:** server-derived total from the final approved measure set; representative reconciliation fixtures; no write-back into the canonical monthly datasets.
- **Independent evidence:** deterministic CI passes on exact PR head, forensic diff review, and explicit Gate 9.1 PASS recorded before any Gate 9.2 persistence work.

## Sign-off record

| Approval area | Named accountable owner | Evidence / source reference | Decision date | Status |
|---|---|---|---|---|
| Izin Tinggal definitions (13 measures) | Pending | Pending | Pending | OPEN |
| Paspor definitions (4 measures) | Pending | Pending | Pending | OPEN |
| Operations: date/cutoff/late entry/closing | Pending | Pending | Pending | OPEN |
| Security: role/action matrix | Pending | Pending | Pending | OPEN |
| Data owner: total/reconciliation | Pending | Pending | Pending | OPEN |
| Engineering: isolation/idempotency/audit tests | Pending | CI + forensic review required | Pending | OPEN |
| Independent Gate 9.1 reviewer | Pending | Exact-head review required | Pending | OPEN |

**Stop rule:** This worksheet does not itself authorize implementation or mark any criterion complete. Gate 9.1 remains BLOCKED until the existing decision register and test matrix are fully satisfied and the gate is explicitly recorded as PASS.
