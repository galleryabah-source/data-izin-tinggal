# Passport Service — Source Audit v1

**Source file:** `Tabel Layanan Paspor.xlsx`  
**Assessment:** real source fixture received and structurally usable  
**Scope:** source analysis only; no production Passport implementation

## Source structure

| Item | Observed |
|---|---|
| Worksheets | JAN, FEB, MAR, APRIL, MEI, JUNI, JULI, AGUST |
| Reporting periods | 2026-01 through 2026-08 |
| Operational rows per sheet | 10 |
| Operational rows total | 80 |
| Subtotal row | row 16, label `JUMLAH WILAYAH` |
| Meaningful source columns | B:H |
| Source `No` column | presentation-only; excluded |
| Source `Jumlah` | row-level total; equals sum of four passport categories |
| Blank/extra operational rows | none observed |

The workbook therefore has a stable monthly-office grain:

`periode × kantor_imigrasi`

with four service measures.

## Source columns

| Source label | Normalized field | Role |
|---|---|---|
| No | — | ignored / presentation-only |
| Kantor Imigrasi | `kantor_imigrasi` | business dimension |
| Biasa 24 | `biasa_24` | measure |
| Biasa 48 | `biasa_48` | measure |
| Elektronik 48 | `elektronik_48` | measure |
| E-Polikarbonat | `e_polikarbonat` | measure |
| Jumlah | `total` | derived total / verified source total |

The normalized field names preserve the source categories without inventing additional passport type, application reason, or replacement-reason dimensions that are not present in this workbook.

## Structural validation

- 80 operational records extracted.
- 10 offices appear in each monthly sheet.
- No duplicate `(periode, kantor_imigrasi)` business keys.
- No blank business-key values.
- No negative count values.
- 0 row-level total mismatches.
- Every monthly subtotal matches the sum of its 10 operational rows.
- Every source `Jumlah` equals the sum of `Biasa 24 + Biasa 48 + Elektronik 48 + E-Polikarbonat`.

## Verified totals

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
| **Overall** | **327,088** |

## Decision

The real source supports a **wide monthly aggregate contract**, not the provisional four-dimensional candidate grain from the earlier readiness document.

The approved implementation candidate is therefore:

`periode × kantor_imigrasi`

with four passport-category measures and a derived `total`.

This is a source-derived decision, not a copy of the Residence Permit contract.

## Gate result

**Source analysis: PASS**

The source is sufficient to draft `PASSPORT-DATA-CONTRACT-v1.md` and a normalized fixture.

Production implementation remains blocked until the contract, validator/importer tests, deployment, integrity, export, backup, and runtime evidence gates are completed.
