# Passport Service Data Contract v1

Status: **DRAFT — source-derived, not yet production-authorized**

## 1. Source fixture

Source workbook: `Tabel Layanan Paspor.xlsx`

Observed source structure:

- Sheets: JAN, FEB, MAR, APRIL, MEI, JUNI, JULI, AGUST
- Period coverage: January–August 2026
- 10 operational immigration offices per sheet
- 80 operational rows total
- One subtotal row (`JUMLAH WILAYAH`) per sheet; excluded from the operational dataset
- Source columns:
  - No
  - Kantor Imigrasi
  - Biasa 24
  - Biasa 48
  - Elektronik 48
  - E-Polikarbonat
  - Jumlah

This contract is based on the supplied workbook, not on invented or inferred records.

## 2. Dataset identity

- Dataset key: `PASSPORT_SERVICE_MONTHLY`
- Schema version: `1`
- Grain: **one row per period × immigration office**
- Business key: `[periode, kantor_imigrasi]`
- Primary purpose: monthly aggregate passport service reporting

The source does **not** expose application/replacement reason dimensions. Those dimensions must not be fabricated into v1.

## 3. Canonical columns

| Column | Type | Required | Semantics |
|---|---|---:|---|
| `periode` | YYYY-MM date/string | yes | Reporting month |
| `kantor_imigrasi` | string | yes | Immigration office name as supplied by source |
| `biasa_24` | non-negative integer | yes | Source category `Biasa 24` |
| `biasa_48` | non-negative integer | yes | Source category `Biasa 48` |
| `elektronik_48` | non-negative integer | yes | Source category `Elektronik 48` |
| `e_polikarbonat` | non-negative integer | yes | Source category `E-Polikarbonat` |
| `total` | non-negative integer | derived | Sum of the four category columns |

### Source-only / presentation fields

- `no` is presentation-only and is ignored.
- `Jumlah` is accepted as source evidence but canonical `total` is derived from the four category columns.
- `JUMLAH WILAYAH` subtotal rows are excluded from operational data.

## 4. Validation rules

1. `periode` must be a valid month in YYYY-MM form.
2. `kantor_imigrasi` must be non-empty.
3. All four category values must be integers >= 0.
4. `total = biasa_24 + biasa_48 + elektronik_48 + e_polikarbonat`.
5. No duplicate business keys `periode + kantor_imigrasi`.
6. No blank business-key components.
7. Subtotal/presentation rows must not enter the dataset.
8. The import must reject malformed rows rather than silently coercing them.
9. Row count and aggregate totals must be recorded in import/audit evidence.

## 5. Supplied fixture baseline

The normalized fixture contains:

- 80 rows
- 8 periods
- 10 offices
- 0 duplicate business keys
- 0 row-total mismatches
- Overall total: **327,088**

Monthly totals:

| Period | Total |
|---|---:|
| 2026-01 | 46,917 |
| 2026-02 | 37,749 |
| 2026-03 | 22,930 |
| 2026-04 | 44,990 |
| 2026-05 | 38,550 |
| 2026-06 | 42,695 |
| 2026-07 | 48,273 |
| 2026-08 | 44,984 |

## 6. Import / registry requirements

Production implementation must follow the existing canonical pipeline:

`PASTE/IMPORT → PARSE → HEADER DETECTION → CANONICALIZE → SCHEMA SIGNATURE → VALIDATE → PREVIEW → COMMIT → ENSURE DATASET → REGISTRY → AUDIT`

The Passport implementation must:

- register `PASSPORT_SERVICE_MONTHLY` independently from `RESIDENCE_PERMIT_SERVICE_MONTHLY`;
- preserve dataset isolation;
- use its own schema signature;
- record import statistics and audit events;
- support export verification;
- support backup snapshot verification;
- add a Passport production smoke baseline only after the first production deployment is proven.

## 7. Explicit non-goals for v1

- No modification to the Residence Permit contract.
- No merging of Residence Permit and Passport source tables.
- No passport application/replacement-reason dimension that is absent from the supplied source.
- No dashboard redesign.
- No map changes.
- No production registration or deployment authorization from this document alone.

## 8. Gate to implementation

Before production deployment:

1. Review this contract against the original workbook.
2. Commit the normalized fixture.
3. Implement Passport validator/importer support.
4. Add unit/integration tests.
5. Verify schema signature and import behavior.
6. Import the supplied 80-row fixture in a controlled environment.
7. Verify integrity/export/backup.
8. Deploy and run Passport-specific production smoke evidence.
9. Only then activate Passport in the production service selector.

## 9. Source lineage

Source file supplied by the user:

`Tabel Layanan Paspor.xlsx`

Normalized fixture:

`PASSPORT_SERVICE_MONTHLY_v1.xlsx`

Text fixture committed to source control:

`fixtures/PASSPORT_SERVICE_MONTHLY_v1.tsv`
