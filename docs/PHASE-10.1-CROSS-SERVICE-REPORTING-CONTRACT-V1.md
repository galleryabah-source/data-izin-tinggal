# Phase 10.1 — Cross-Service Reporting Contract v1

**Status:** DESIGN / CONTRACT GATE  
**Scope:** Residence Permit + Passport canonical monthly datasets  
**Source model:** Monthly authoritative data only  
**Runtime impact:** None at contract stage

## 1. Objective

Define a read-only semantic reporting layer that can compare and aggregate Residence Permit and Passport service volumes where the metrics are semantically compatible.

This contract does **not** modify either canonical dataset contract, importer, Dataset Registry identity, historical baseline, or source data.

## 2. Canonical source datasets

### Residence Permit

- dataset key: `RESIDENCE_PERMIT_SERVICE_MONTHLY`
- grain: `periode × kantor_imigrasi`
- measure columns:
  `bvk`, `voa`, `itk`, `itk_peralihan`, `itas`, `itap`, `itkt`, `alih_status_itk_ke_itas`, `alih_status_itas_ke_itap`, `abg`, `epo`, `imk`, `skim`
- derived measure: `total`

### Passport

- dataset key: `PASSPORT_SERVICE_MONTHLY`
- grain: `periode × kantor_imigrasi`
- measure columns:
  `biasa_24`, `biasa_48`, `elektronik_48`, `e_polikarbonat`
- derived measure: `total`

Both source contracts remain authoritative and unchanged.

## 3. Semantic reporting metric

The only cross-service metric approved by v1 is:

### `service_volume`

Definition: count of recorded services represented by the canonical dataset's derived `total` for the selected service, period, and office scope.

It is a reporting metric, not a new stored dataset field.

Mapping:

| Service | Source metric | Reporting metric |
|---|---|---|
| Residence Permit | `total` | `service_volume` |
| Passport | `total` | `service_volume` |

## 4. Compatibility rule

Cross-service aggregation is permitted only when all of the following are true:

1. same reporting period semantics;
2. same office identity semantics;
3. source value is the canonical derived `total`;
4. aggregation is explicitly labeled by service;
5. source dataset provenance is retained;
6. no service-specific category is presented as cross-service equivalent.

The reporting layer must never imply that individual Residence Permit categories are equivalent to individual Passport categories.

## 5. Allowed operations

### A. Service comparison

Return separate values:

```text
periode
kantor
service
service_volume
```

Example:

```text
2026-01 | Kanim A | Residence Permit | ...
2026-01 | Kanim A | Passport        | ...
```

### B. Cross-service total

A combined total is permitted only as:

```text
Residence service_volume
+
Passport service_volume
=
combined_service_volume
```

The response must retain the two service components and provenance.

### C. Time-series comparison

Allowed at common monthly periods:

```text
periode | residence_service_volume | passport_service_volume
```

### D. Office comparison

Allowed where office identity is shared through the verified Office Reference.

## 6. Explicitly prohibited in v1

- creating a new persistent cross-service dataset;
- modifying either source contract;
- modifying `DATASET_REGISTRY`;
- modifying import validation;
- changing historical monthly values;
- reconstructing daily data;
- treating Residence Permit and Passport categories as equivalent;
- silently summing incompatible measures;
- replacing source `total` with client-side recalculation;
- bypassing existing RBAC;
- bypassing audit requirements;
- changing existing dashboard semantics.

## 7. Query boundary

The Phase 10.1 layer is read-only.

```text
Canonical datasets
       │
       ▼
Semantic reporting adapter
       │
       ├── service comparison
       ├── monthly comparison
       ├── office comparison
       └── optional combined service_volume
       │
       ▼
Reporting consumer
```

No write path may originate from this layer.

## 8. Identity and provenance

Every result must preserve:

- `datasetKey`
- `service`
- `periode`
- `kantor_imigrasi`
- source metric identity
- reporting metric identity

The reporting adapter must resolve datasets through the existing canonical Dataset Registry path. It must not introduce an alternate dataset identity mechanism.

## 9. Authorization

Initial implementation requires:

- `dashboard.read` for in-application reporting;
- `dataset.export` if cross-service results are exported.

No new permission is required for v1.

Existing deny-by-default RBAC remains authoritative.

## 10. Audit

Read-only dashboard queries do not create an audit event merely by being viewed.

An explicit cross-service export must use the existing governed export/audit path and identify the reporting scope.

## 11. Regression requirements

The Phase 10.1 implementation must preserve the current production expectations:

### Residence

- 80 rows
- 258,094 services
- 8 periods
- 10 offices

### Passport

- 80 rows
- 327,088 services
- 8 periods
- 10 offices

The new capability must not alter these values.

Existing regression smoke must remain green, including:

- `dataset_registry_identity`
- dashboard summary
- Residence dashboard
- Passport dashboard
- Residence drilldown
- Passport drilldown
- Office Reference readiness
- Residence map
- Passport map

## 12. Acceptance gate

Phase 10.1 may proceed from contract to implementation only when:

- semantic metric mapping is approved;
- source provenance is retained;
- canonical Registry routing is reused;
- no source contract is changed;
- no new persistent dataset is introduced;
- RBAC is enforced;
- regression smoke remains green;
- live production UAT verifies the new read-only reporting behavior.

## 13. Design decision

**Approved design direction:** a read-only semantic adapter over the two existing canonical monthly datasets.

**Not approved:** a third `CROSS_SERVICE_MONTHLY` table, duplicated data, or a second identity/registry path.
