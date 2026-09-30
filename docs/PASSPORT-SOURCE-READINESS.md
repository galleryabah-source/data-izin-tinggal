# Passport Service — Source Readiness

**Status:** source analysis complete; Contract v1 proposed  
**Dataset target:** `PASSPORT_SERVICE_MONTHLY`  
**Production status:** not implemented

## Purpose

Prepare the Passport service contract from the actual source workbook supplied for this application. The existing Residence Permit contract remains unchanged and is the canonical production baseline.

## Real source analyzed

Source workbook: `Tabel Layanan Paspor.xlsx`

Observed structure:

- 8 monthly sheets: JAN, FEB, MAR, APRIL, MEI, JUNI, JULI, AGUST;
- 10 operational immigration offices per month;
- 80 operational rows in total;
- source columns: `No`, `Kantor Imigrasi`, `Biasa 24`, `Biasa 48`, `Elektronik 48`, `E-Polikarbonat`, `Jumlah`;
- `No` is presentation-only;
- `JUMLAH` subtotal rows are excluded;
- no additional source columns are required for v1.

## Source-to-canonical result

Normalized fixture: `PASSPORT_SERVICE_MONTHLY_v1.xlsx`

Canonical grain: `periode × kantor_imigrasi`

Canonical measures:

- `biasa_24`
- `biasa_48`
- `elektronik_48`
- `e_polikarbonat`
- derived `total`

The source's passport categories are therefore represented as measures in v1 rather than as a separate `jenis_paspor` dimension.

## Validation result

The real source normalized successfully:

- 80 rows;
- 8 periods;
- 10 offices per period;
- 0 duplicate business keys;
- 0 negative values;
- 0 total mismatches;
- overall total 327,088.

## Contract

The formal v1 contract is recorded in `docs/PASSPORT-DATA-CONTRACT-v1.md`.

A normalized text fixture is recorded as `fixtures/PASSPORT_SERVICE_MONTHLY_v1.tsv`.

The XLSX fixture remains the user-facing source-normalization artifact.

## Non-goals

This source-readiness stage does not modify Residence Permit production behavior, register Passport in production, alter production permissions, alter the dashboard, or authorize Passport deployment.

## Next gate

`Real source ✓ → normalized fixture ✓ → Contract v1 ✓ → validator/importer → automated tests → production gates`

The next implementation step is the Passport validator/importer, implemented against this contract and fixture without changing the existing Residence Permit pipeline.
