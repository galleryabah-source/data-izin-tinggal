# Passport Service — Data Contract v1

**Dataset key:** `PASSPORT_SERVICE_MONTHLY`  
**Contract version:** `1`  
**Status:** draft derived from real source fixture  
**Production status:** not registered / not deployed

## 1. Purpose

Define the canonical normalized shape for the supplied monthly Passport service workbook without changing the existing Residence Permit contract.

## 2. Grain

One record represents:

`periode × kantor_imigrasi`

The source is a monthly aggregate by immigration office with four passport-category measures.

## 3. Canonical columns

| # | Column | Type | Required | Rule |
|---:|---|---|---|---|
| 1 | `periode` | ISO date / YYYY-MM-01 | yes | normalized reporting month |
| 2 | `kantor_imigrasi` | string | yes | non-blank office name |
| 3 | `biasa_24` | integer | yes | >= 0 |
| 4 | `biasa_48` | integer | yes | >= 0 |
| 5 | `elektronik_48` | integer | yes | >= 0 |
| 6 | `e_polikarbonat` | integer | yes | >= 0 |
| 7 | `total` | integer | no / derived | sum of columns 3–6 |

### Canonical column order

```
periode
kantor_imigrasi
biasa_24
biasa_48
elektronik_48
e_polikarbonat
total
```

## 4. Source mapping

| Source | Canonical |
|---|---|
| `No` | ignored |
| `Kantor Imigrasi` | `kantor_imigrasi` |
| `Biasa 24` | `biasa_24` |
| `Biasa 48` | `biasa_48` |
| `Elektronik 48` | `elektronik_48` |
| `E-Polikarbonat` | `e_polikarbonat` |
| `Jumlah` | `total` |

The source subtotal row `JUMLAH WILAYAH` is not an operational record and must be excluded from imports.

## 5. Business key

`[periode, kantor_imigrasi]`

Rules:

- duplicate business keys are invalid within one import;
- blank business-key components are invalid;
- existing-dataset duplicate behavior must follow the application's import correction policy and must not silently create duplicate monthly-office records.

## 6. Total rule

`total = biasa_24 + biasa_48 + elektronik_48 + e_polikarbonat`

If a source supplies `total`, it must equal the derived value.

The application should prefer deriving the canonical value rather than trusting a presentation formula.

## 7. Validation rules

1. Header must match the canonical contract after source canonicalization.
2. `periode` must normalize to a valid month.
3. `kantor_imigrasi` must be non-blank.
4. All four measures must be integers >= 0.
5. `total` must be absent or equal to the derived sum.
6. Subtotal/presentation rows must not enter the operational dataset.
7. Duplicate business keys must be rejected.
8. Import row count must respect the global application limit.
9. Accepted/rejected/duplicate counts must be written to the import log.
10. A successful commit must create the corresponding audit evidence.

## 8. Source fixture baseline

The supplied source produces:

- 8 periods;
- 10 offices;
- 80 operational records;
- overall total: 327,088;
- row-level total mismatches: 0;
- duplicate business keys: 0;
- negative values: 0.

The normalized fixture is:

`PASSPORT_SERVICE_MONTHLY_v1.xlsx`

## 9. Export contract

Export must preserve the canonical column order and values:

`periode, kantor_imigrasi, biasa_24, biasa_48, elektronik_48, e_polikarbonat, total`

Exports must be governed by `dataset.export` and audited, consistent with the existing platform architecture.

## 10. Backup contract

Once productionized, Passport snapshots must use the same governed backup/snapshot pattern as other datasets:

- configured backup location;
- manifest;
- schema signature;
- row count;
- checksum;
- source/snapshot equality verification;
- audit evidence.

## 11. Runtime evidence

Before Passport is considered production-ready, its deployment must pass the equivalent evidence gates:

`validator/import test → deployment evidence → integrity → export → backup → production smoke`

The smoke baseline for the supplied fixture is:

- rowCount = 80
- monthlyPeriods = 8
- offices = 10
- grandTotal = 327088

These are fixture baselines, not permanent business expectations for future periods.

## 12. Non-goals

This contract does not:

- modify `RESIDENCE_PERMIT_SERVICE_MONTHLY`;
- add Passport production code;
- register the Passport dataset;
- change dashboard behavior;
- change production permissions;
- authorize production deployment.

## 13. Change control

Any future Passport source that introduces additional dimensions, categories, or a different grain must trigger a contract review and version change rather than silently changing v1 semantics.
