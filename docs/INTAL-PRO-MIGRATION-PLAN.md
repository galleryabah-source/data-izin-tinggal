# INTAL Pro — Migration and Cutover Plan

## 1. Objective

Move from the current Data Izin Tinggal production baseline to INTAL Pro without changing certified business semantics or losing provenance.

## 2. Source baseline

The current repository already defines:

- RESIDENCE_PERMIT_SERVICE_MONTHLY;
- PASSPORT_SERVICE_MONTHLY;
- monthly grain;
- business key period + immigration office;
- derived total;
- duplicate rejection;
- contract-driven verification;
- audit events;
- office reference governance.

These rules are treated as migration inputs until explicitly versioned otherwise.

## 3. Migration stages

### M0 — Freeze contract

Record exact:
- dataset contract versions;
- source workbook/file hashes;
- current registry identity;
- current row counts;
- current aggregate totals;
- period coverage;
- office coverage.

### M1 — Extract

Create immutable source extracts.

Never migrate directly from a mutable operational sheet without recording the extraction evidence.

### M2 — Stage

Load extracted data into staging tables.

Attach:
- source hash;
- import batch ID;
- contract version;
- extraction timestamp;
- source metadata.

### M3 — Validate

Run:
- schema validation;
- type validation;
- period validation;
- office validation;
- duplicate business key checks;
- measure non-negative checks;
- derived total checks.

### M4 — Canonical promotion

Use a database transaction.

Either the complete batch becomes canonical or no canonical rows are changed.

### M5 — Parity verification

Compare Legacy and V2 at:
- row level;
- business-key level;
- measure level;
- aggregate level.

### M6 — Shadow runtime

Run V2 in production-like conditions while Legacy remains operational.

Compare:
- dashboard totals;
- period series;
- office series;
- GIS markers;
- exports;
- cross-service reports.

### M7 — Controlled cutover

Use a documented change window.

- backup;
- verify health;
- deploy;
- smoke test;
- compare outputs;
- keep rollback available.

## 4. Rollback

Rollback must never mean deleting evidence.

Rollback means:
- stop V2 traffic/write;
- restore previous application artifact;
- preserve failed deployment logs;
- preserve migration evidence;
- reconcile any externally committed data before retry.

## 5. Cutover gates

A cutover cannot proceed if any of these are unresolved:

- data parity difference;
- broken business-key uniqueness;
- missing office reference;
- authorization regression;
- failed migration reproducibility;
- failed backup/restore;
- failed runtime provenance;
- failed critical UAT scenario.

## 6. Post-cutover

For the first operational period:
- monitor imports;
- monitor errors;
- compare daily/weekly aggregates;
- verify audit events;
- verify backups;
- retain Legacy as read-only fallback if operationally justified.

## 7. Final retirement

Legacy retirement requires a separate evidence package and explicit approval. It is not part of the initial migration implementation.
