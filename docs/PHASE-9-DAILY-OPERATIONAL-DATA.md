# Phase 9 — Daily Operational Data Design v1

**Status:** contract/validator foundation in PR #228; Gate 9.1 BLOCKED pending operational sign-off  
**Scope:** in-app daily input for both Residence Permit and Passport, staging, review, correction/revision, period closing, monthly/yearly derivation, historical traceability.

**Capture channel:** one INTAL WEB APP form with a service selector. **WhatsApp integration: HOLD.** Runtime remains Apps Script + Google Sheets for the initial delivery.

**Current implementation boundary:** PR #228 adds candidate contracts and a pure validator only. The feature is hard-disabled; there are no daily writes, staging-sheet creation, or daily UI. Gate 9.1 remains BLOCKED until the operational definitions and workflow rules are approved. See [Gate 9.1 Decision Register](PHASE-9-GATE-9.1-DECISION-REGISTER.md).

## 1. Decision

Daily operational data, when operationally required, must be introduced as a **separate dataset family**. It must not replace or mutate the verified monthly production datasets:

- `RESIDENCE_PERMIT_SERVICE_MONTHLY`
- `PASSPORT_SERVICE_MONTHLY`

The historical monthly baseline remains authoritative until an explicit, separately approved migration is executed.

Target flow:

```
Daily operational records
        |
        +--> daily approved view
        +--> monthly aggregate
        +--> yearly aggregate
        +--> dashboard / reporting
```

Monthly/yearly outputs are derived projections, not manually maintained duplicate source datasets.

## 2. Grain and dataset boundary

Current monthly contracts have business key `periode + kantor_imigrasi`. A daily contract needs at least `tanggal + kantor_imigrasi` plus service measures.

Do **not** alter the monthly contracts to accommodate daily records.

Proposed service-specific families:

- `RESIDENCE_PERMIT_SERVICE_DAILY`
- `PASSPORT_SERVICE_DAILY`

Initial candidate measures come from the existing service contracts: the 13 Residence Permit measures and the 4 Passport measures. Before code implementation, freeze the daily meaning of each measure, required-versus-optional behavior, whether zero is a valid reported value, reporting cutoff, and correction authority. Do not reconstruct daily values from monthly aggregates.

## 3. Proposed common fields

| Field | Type | Rule |
|---|---|---|
| `tanggal` | DATE | Operational date in Asia/Jakarta |
| `kantor_imigrasi` | TEXT | Required; normalized against Office Reference |
| service measures | INTEGER | Required per service contract; non-negative |
| `total` | INTEGER | Derived from contract measures |
| `record_id` | TEXT | Stable canonical identity |
| `revision` | INTEGER | Monotonic revision number for a stable `record_id` |
| `status` | ENUM | `DRAFT`, `SUBMITTED`, `NEEDS_CORRECTION`, `APPROVED`, `VOID` |
| `submission_id` | TEXT | UUID idempotency key for a submission request |
| `contract_version` | TEXT | Contract version used to validate the record |
| `created_by` / `updated_by` | TEXT | Authenticated actor identities |
| `submitted_at` / `approved_at` | DATETIME | Lifecycle timestamps |
| `closed_at` | DATETIME | Set when the period is closed |
| `closed_by` | TEXT | Actor who closed the period |
| `reason` | TEXT | Required for correction, void, close/reopen where applicable |

This is a design proposal, not an approved production schema.

## 4. Identity and correction

Daily records must be revision-aware. Corrections must not overwrite historical evidence in place.

Logical report identity is `tanggal + kantor_imigrasi + service_family`; stable `record_id` links revisions, while `submission_id` makes retries idempotent.

```
record_id
   +-- revision 1 (immutable after submission/approval)
   +-- revision 2 (controlled correction)
   +-- revision 3 (controlled correction)
```

Report lifecycle:

```
DRAFT -> SUBMITTED -> APPROVED
             |           |
             v           +--> later correction creates a new revision
      NEEDS_CORRECTION
VOID is explicit, authorized, audited, and excluded from approved totals.
```

Drafts may be edited with actor/timestamp attribution. Once submitted, approved, or voided, a revision is immutable. Only the latest approved, non-void revision contributes to approved aggregates. A correction after approval/close creates a new revision and requires the appropriate authorization and audit event.

## 5. Period closing

Recommended period lifecycle:

```
OPEN -> REVIEW -> CLOSED
```

Rules:

1. OPEN: create/revise records subject to RBAC.
2. REVIEW: operational edits are restricted during reconciliation.
3. CLOSED: ordinary writes are rejected.
4. Post-close correction requires a new revision and explicit authorized correction.
5. Closing records actor, timestamp, period, dataset family, and evidence.
6. Reopening a closed period is a privileged, auditable action.
7. The system must never infer closure merely from the calendar date.

## 6. Aggregation

For approved daily records:

### Monthly

```
month = YYYY-MM(tanggal)
GROUP BY month, kantor_imigrasi
SUM(service measures)
SUM(total)
```

### Yearly

```
year = YYYY(tanggal)
GROUP BY year, kantor_imigrasi
SUM(service measures)
SUM(total)
```

Only the latest non-void approved revision contributes. Aggregates must be reproducible from approved daily records.

## 7. Historical baseline protection

For January–August 2026, the verified monthly datasets remain authoritative:

- `RESIDENCE_PERMIT_SERVICE_MONTHLY`
- `PASSPORT_SERVICE_MONTHLY`

If daily records later cover an already-baselined month, maintain two explicit concepts:

- **historical_baseline** — verified imported monthly dataset;
- **daily_derived** — aggregate reconstructed from approved daily records.

No automatic replacement is permitted.

## 8. Reconciliation

Before a daily-derived month is allowed to supersede or coexist as an operational source for a historical month, produce:

- baseline row count;
- daily-derived row count;
- baseline total by office;
- daily-derived total by office;
- delta by service measure;
- delta total;
- missing offices;
- unexpected offices;
- unresolved corrections;
- period status.

Differences must remain visible and must not silently update the monthly baseline.

## 9. Audit semantics

Proposed audit events:

- `DAILY_RECORD_CREATE`
- `DAILY_RECORD_APPROVE`
- `DAILY_RECORD_CORRECT`
- `DAILY_RECORD_VOID`
- `PERIOD_OPEN`
- `PERIOD_REVIEW`
- `PERIOD_CLOSE`
- `PERIOD_REOPEN`
- `DAILY_AGGREGATE_BUILD`
- `DAILY_BASELINE_RECONCILIATION`

Each should identify dataset family, period, actor, affected records, revision, and outcome.

## 10. RBAC boundary

Proposed capabilities:

- `daily.read`
- `daily.write`
- `daily.approve`
- `daily.correct`
- `period.close`
- `period.reopen`
- `daily.reconcile`

These names are proposed only; role mapping follows the approved workflow.

## 11. Governance

Daily datasets must pass the same canonical gates:

```
contract
 -> validation
 -> production deployment
 -> integrity verification
 -> governed export
 -> backup snapshot
 -> snapshot verification
 -> runtime smoke
```

Successful import alone is not production readiness.

## 12. Implementation gates

### Gate 9.1 — Workflow and contract freeze
Use the in-app form as the initial capture channel. Confirm roles, reporting cutoff, required measures, zero/missing semantics, business identity, correction scenarios, and representative fixtures for both service families. WhatsApp is out of scope and remains on HOLD.

### Gate 9.2 — Staging, idempotency, and lifecycle core
Create separate service-specific staging/revision stores, submission idempotency ledger, server-side validators, lock-guarded write seam, audit events, and consistency checks. No canonical monthly writes.

### Gate 9.3 — Responsive form workspace
Implement one service-selector form with dynamic Residence/Passport fields, draft/submit states, validation summary, duplicate/retry handling, and accessible mobile/desktop behavior.

### Gate 9.4 — Review, correction, and period governance
Implement review queue, approve/return/void actions, append-only corrections, and explicit OPEN -> REVIEW -> CLOSED period lifecycle with privileged reopen and mandatory reasons.

### Gate 9.5 — Approved projections and reconciliation
Derive daily/monthly/yearly views only from approved revisions. Compare daily-derived monthly results with historical baselines without mutating either canonical monthly dataset.

### Gate 9.6 — Governance and recovery
Add audit completeness checks, governed export, backup/snapshot verification, integrity smoke tests, and recovery evidence. A successful form submission alone is not production readiness.

### Gate 9.7 — Runtime UAT and release certification
Test both service families, validation, concurrency, retries, revisions, period controls, RBAC negative cases, export/backup, and unchanged monthly baselines. Follow CI PASS -> forensic diff PASS -> merge -> canonical deployment -> production smoke -> browser UAT -> evidence reconciliation.

## 13. Non-goals

This design does not authorize:

- changing existing monthly contracts;
- automatic migration of January–August 2026;
- overwriting historical monthly sheets from daily aggregates;
- a universal daily table containing incompatible service measures;
- post-close edits without revision and audit evidence;
- automatic calendar-based period close;
- production daily writes before contract/workflow approval.

## 14. Current decision

**Phase 9 is approved for planning, but not implemented or production-certified.** The initial input source is the governed INTAL WEB APP form, not WhatsApp. Before implementation, approve the daily measure semantics, roles, and representative fixtures.

Use the existing Apps Script + Google Sheets runtime for the first release. Its limitations around multi-sheet atomicity must be addressed through idempotency, lock-guarded writes, append-only revisions, consistency verification, and recovery tests; do not describe it as a full ACID transaction system.

Until the delivery gates pass, the existing monthly production baseline remains unchanged and authoritative. See `docs/DAILY-INPUT-BLUEPRINT.md` for the full technical plan.

## 15. UI/technical reinforcement aligned with existing product architecture

The entry workspace must reuse the approved GIS First global shell and design tokens, but the form itself is task-first: no map or analytics distractions above the entry fields. Implement one responsive Input Harian route with synchronized Izin Tinggal/Paspor selection, verified Office Reference, server-provided field metadata, keyboard/touch accessibility, inline errors and explicit retry/conflict states. Desktop and Android mobile must be tested.

Technical modules should be separated logically into contract registry, validation, authorization policy, command service, repository adapter, idempotency, revision handling, audit adapter, read-only projection, and consistency verifier. Keep them compatible with the existing Apps Script codebase and test shim; do not introduce a new runtime/framework or database merely for novelty. Use versioned server-owned contracts, request/correlation UUIDs, stable error codes, batch I/O, bounded retries, revision conflict detection and recovery tests.

**Gate 9.1 remains a real approval gate.** The earlier source audit found no existing authoritative daily source. The proposed in-app form becomes a new prospective source, but its semantics still need sign-off: daily grain, measure meanings, zero versus missing, reporting cutoff, late entry, role separation, correction, and close/reopen. Candidate fields are not production-authorized until the operational owner approves representative normal and correction fixtures. Never synthesize daily rows from monthly totals.



## 16. Period governance integration dependency

Before implementing daily write commands, compare the daily state machine, period keys, correction reason handling, close/reopen permissions, and audit events with the existing monthly **Period Closing & Controlled Correction v1** implementation. Reuse compatible policy patterns and evidence semantics, but keep daily and monthly storage/write paths isolated. Gate 9.2 must not introduce a second or conflicting period lifecycle. This reconciliation is a prerequisite, not an optional cleanup.
