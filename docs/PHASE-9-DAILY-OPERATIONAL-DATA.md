# Phase 9 — Daily Operational Data Design v1

**Status:** design gate — proposed, not yet implemented  
**Scope:** daily operational data, period closing, correction/revision, monthly/yearly derivation, historical traceability.

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

The exact measures must be approved from a real operational source before implementation.

## 3. Proposed common fields

| Field | Type | Rule |
|---|---|---|
| `tanggal` | DATE | Operational date in Asia/Jakarta |
| `kantor_imigrasi` | TEXT | Required; normalized against Office Reference |
| service measures | INTEGER | Required per service contract; non-negative |
| `total` | INTEGER | Derived from contract measures |
| `record_id` | TEXT | Stable canonical identity |
| `revision` | INTEGER | Starts at 1; increments on correction |
| `status` | ENUM | `DRAFT`, `APPROVED`, `VOID` |
| `closed_at` | DATETIME | Set when the period is closed |
| `closed_by` | TEXT | Actor who closed the period |

This is a design proposal, not an approved production schema.

## 4. Identity and correction

Daily records must be revision-aware. Corrections must not overwrite historical evidence in place.

Logical identity:

```
record_id
   +-- revision 1
   +-- revision 2
   +-- revision 3
```

Only the latest valid revision participates in the approved aggregate. A VOID revision remains evidence and is excluded from approved totals.

Lifecycle:

```
DRAFT -> APPROVED -> CLOSED
```

A correction after approval/close creates a new revision and requires the appropriate authorization and audit event.

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

### Gate 9.1 — Operational source audit
Identify the real daily source, users, workflow, correction scenarios, and required measures.

### Gate 9.2 — Contract approval
Freeze exact columns, grain, business identity, revision semantics, and validation rules.

### Gate 9.3 — Lifecycle implementation
Implement OPEN -> REVIEW -> CLOSED and correction/revision handling.

### Gate 9.4 — Aggregate implementation
Derive monthly/yearly views exclusively from approved daily records.

### Gate 9.5 — Reconciliation
Compare daily-derived periods with historical monthly baselines without mutating them.

### Gate 9.6 — Governance
Add export, backup, audit, and production smoke evidence.

### Gate 9.7 — Runtime UAT
Validate the workflow using representative real daily data.

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

**Phase 9 is a design gate, not a production implementation.**

The next required input is the **actual daily operational workflow/source**. Once known, this proposal can be specialized into a versioned contract and fixture.

Until then, the existing monthly production baseline remains unchanged and authoritative.
