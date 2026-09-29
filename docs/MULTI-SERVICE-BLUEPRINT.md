# Multi-Service Application Blueprint

## Purpose

This document defines the long-term blueprint for evolving **Data Izin Tinggal** from a single-service application into a unified, schema-driven **Keimigrasian Service Data Platform**.

The blueprint is intentionally architectural. It does **not** authorize immediate implementation of all planned features. Delivery remains phased and each phase must preserve the integrity of the canonical production pipeline.

## Core principle

**One application, multiple governed dataset families.**

The user experience remains one application while source datasets remain logically separated by their own contracts, schemas, business keys, validation rules, and lifecycle.

Initial families:

- `RESIDENCE_PERMIT_SERVICE_MONTHLY` — existing production dataset.
- `PASSPORT_SERVICE_MONTHLY` — future dataset family; design only for now.

Future families may include other approved immigration service datasets, but no family is added until its data contract and governance requirements are defined.

## Target logical architecture

```text
                         ONE APPLICATION
                               |
                    +----------+----------+
                    |  Service Selector  |
                    | All / Izin Tinggal |
                    |      / Paspor      |
                    +----------+----------+
                               |
                    +----------+----------+
                    |   Dataset Registry |
                    +----------+----------+
                               |
             +-----------------+-----------------+
             |                                   |
             v                                   v
 RESIDENCE_PERMIT_SERVICE_MONTHLY     PASSPORT_SERVICE_MONTHLY
             |                                   |
     Contract v1.x                           Contract v1.x
             |                                   |
             +-----------------+-----------------+
                               |
                    Query / Filter / Aggregate
                               |
          +--------------------+--------------------+
          |                    |                    |
       Dashboard            Reporting            Map
          |                    |                    |
          +--------------------+--------------------+
                               |
                  RBAC / Audit / Backup
                               |
                     CI/CD + Evidence
```

## Presentation model

The dashboard must support service-scoped presentation without duplicating applications:

1. **All Services**
   - aggregate only metrics that are semantically compatible;
   - clearly identify service family in detailed results;
   - never merge incompatible measures merely because they are numeric.

2. **Residence Permit**
   - show only residence-permit metrics, filters, charts, tables, exports, and map context.

3. **Passport**
   - show only passport metrics, filters, charts, tables, exports, and map context.

4. **Future service families**
   - become selectable only after their contract and UI capabilities are registered.

The service selector is a presentation concern. It must not weaken dataset isolation or authorization.

## Data model principle

Do **not** create one oversized universal table containing every column from every service family.

Instead:

```text
Dataset Registry
   |
   +-- Dataset A -> Contract A -> Sheet/Table A
   |
   +-- Dataset B -> Contract B -> Sheet/Table B
   |
   +-- Dataset C -> Contract C -> Sheet/Table C
```

This preserves schema clarity and allows each family to evolve independently.

## Aggregation principle

Where daily operational data is introduced in the future:

```text
Daily operational records
        |
        +--> daily view
        +--> monthly aggregate
        +--> yearly aggregate
        +--> dashboard
        +--> reporting
```

Monthly and yearly summaries should preferably be **derived aggregates**, not manually maintained duplicate sources.

The existing monthly production contract remains authoritative for the historical baseline unless and until an explicit migration plan is approved.

## Passport dataset design — future

A future passport contract should define, at minimum:

- period/date grain;
- immigration office;
- service categories;
- business key;
- required and optional columns;
- derived totals;
- normalization rules;
- duplicate rules;
- correction/revision rules;
- export semantics;
- audit requirements.

Do not assume passport columns are identical to residence-permit columns.

## Governance boundaries

Every dataset family must pass the same minimum governance gates:

```text
Schema definition
      ->
Contract validation
      ->
Import validation
      ->
Production deployment
      ->
Data integrity verification
      ->
Export verification
      ->
Backup verification
      ->
Runtime smoke evidence
```

A new dataset must not bypass the canonical governance pipeline.

## Security and authorization

Permissions remain server-side.

Potential future permissions may be scoped by dataset family, for example:

- `residence.read`
- `residence.write`
- `passport.read`
- `passport.write`
- `service.export`
- `service.approve`

Exact permission names are intentionally deferred until the passport contract is designed.

## Implementation sequence

### Phase A — Stabilize current production baseline

- Keep the existing residence-permit contract unchanged.
- Close the current production runtime evidence gate.
- Maintain CI/CD and deployment evidence.
- Maintain backup, export, integrity, and smoke verification.

### Phase B — Define multi-service domain model

Documentation/design only:

- service family registry concept;
- service selector behavior;
- cross-service query boundaries;
- compatible versus incompatible aggregate metrics;
- dataset-scoped authorization model.

No production data changes.

### Phase C — Introduce passport contract

- design `PASSPORT_SERVICE_MONTHLY` or an explicitly approved daily contract;
- build source fixtures;
- validate schema and business keys;
- test importer and verification logic;
- deploy only after the contract is reviewed.

### Phase D — Integrate passport into the application

- register the dataset;
- add service-scoped dashboard filtering;
- add service-aware exports;
- add audit coverage;
- add backup/snapshot coverage;
- extend smoke tests without weakening existing residence-permit checks.

### Phase E — Daily operational model

Only after the multi-service contract is stable:

- introduce daily operational data where operationally required;
- derive monthly/yearly aggregates;
- define period closing and correction workflow;
- preserve historical traceability.

### Phase F — Advanced analytics

Only after the data model is stable:

- cross-service reporting;
- trend analysis;
- richer drill-down;
- geographic analytics;
- document/knowledge integration;
- alerting and automation.

## Non-goals for the current phase

The following are **not** part of the immediate implementation gate:

- replacing the current residence-permit dataset;
- merging residence and passport source tables;
- building the passport UI now;
- changing the existing production business key;
- redesigning the dashboard before the current runtime gate is closed;
- adding new features merely to demonstrate extensibility.

## Decision record

The application is intentionally being designed as a **single multi-service platform with isolated dataset contracts**.

The first additional service family under consideration is **Passport Services**.

Implementation remains deferred and must follow the phased roadmap. The current production residence-permit pipeline remains the canonical baseline and must stay green throughout future expansion.
