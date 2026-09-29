# Data Contract v1 — Residence Permit Service Monthly

**Status:** proposed for first real deployment  
**Version:** 1  
**Dataset key:** `RESIDENCE_PERMIT_SERVICE_MONTHLY`  
**Source evidence:** `Copy of Tabel Layanan Izin Tinggal.xlsx`  
**Coverage in source:** January–August 2026, 10 immigration offices per month, 80 operational rows.

## 1. Grain

One row represents exactly one **month × immigration office** observation.

Business key: `periode + kantor_imigrasi`

The source workbook contains one worksheet per month. Rows labelled `JUMLAH` are monthly subtotals and are **not imported as observations**.

## 2. Canonical columns

| Column | Type | Required | Rule |
|---|---|---:|---|
| `periode` | PERIOD (`YYYY-MM`) | yes | Normalized month period. |
| `kantor_imigrasi` | TEXT | yes | Trimmed office name. |
| `bvk` | INTEGER | yes | Non-negative service count. |
| `voa` | INTEGER | yes | Non-negative service count. |
| `itk` | INTEGER | yes | Non-negative service count. |
| `itk_peralihan` | INTEGER | yes | Non-negative service count. |
| `itas` | INTEGER | yes | Non-negative service count. |
| `itap` | INTEGER | yes | Non-negative service count. |
| `itkt` | INTEGER | yes | Non-negative service count. |
| `alih_status_itk_ke_itas` | INTEGER | yes | Non-negative service count. |
| `alih_status_itas_ke_itap` | INTEGER | yes | Non-negative service count. |
| `abg` | INTEGER | yes | Non-negative service count. |
| `epo` | INTEGER | yes | Non-negative service count. |
| `imk` | INTEGER | yes | Non-negative service count. |
| `skim` | INTEGER | yes | Non-negative service count. |
| `total` | INTEGER | derived | Sum of the 13 service metrics above. |

## 3. Source mapping

The source workbook's visible operational columns B:Q map as follows:

- `No` -> ignored source row number; never part of the business key.
- `Kantor Imigrasi` -> `kantor_imigrasi`.
- `BVK` -> `bvk`.
- `VOA` -> `voa`.
- `ITK` -> `itk`.
- `ITK Peralihan` -> `itk_peralihan`.
- `ITAS` -> `itas`.
- `ITAP` -> `itap`.
- `ITKT` -> `itkt`.
- `ITK ke ITAS` -> `alih_status_itk_ke_itas`.
- `ITAS ke ITAP` -> `alih_status_itas_ke_itap`.
- `ABG` -> `abg`.
- `EPO` -> `epo`.
- `IMK` -> `imk`.
- `SKIM` -> `skim`.
- `Total` -> `total`, but the importer recomputes and validates it.
- The additional rightmost source column outside B:Q is **not part of v1** because its header is not a stable contract field and its values are inconsistent across months.
- The month worksheet name/title supplies the period when preparing the normalized import table; the paste contract itself requires an explicit `periode` column.

## 4. Validation rules

1. Required columns must be present.
2. Unknown columns are rejected for the recognized v1 contract, except the ignored source column `no`.
3. Service metrics must be integers >= 0.
4. `periode` is normalized to `YYYY-MM`.
5. `kantor_imigrasi` must be non-empty.
6. `total` is recomputed from the 13 service metrics.
7. If a supplied `total` exists, it must equal the recomputed total; otherwise the row is rejected.
8. Duplicate business keys inside one import are rejected.
9. A business key already present in the registered dataset is rejected rather than appended again.
10. `JUMLAH` rows are source subtotals and must not be imported as observations.

## 5. Evidence from the real workbook

- 8 monthly sheets contain operational data: JAN, FEB, MAR, APRIL, MEI, JUNI, JULI, AGUST.
- Each contains 10 immigration-office observations.
- `Sheet9` is empty and is not a dataset.
- April has formatting extending the worksheet to approximately 1,001 rows, but only the 10 office rows plus subtotal contain the relevant data.
- June's `JUMLAH` row is blank; monthly totals therefore must be derived from the 10 office observations rather than trusted from that subtotal row.
- The `Total` field for the 80 operational rows equals the sum of the 13 service metrics.

## 6. Normalized import shape

The first real import into the application must use one flat table with this header order:

    periode	kantor_imigrasi	bvk	voa	itk	itk_peralihan	itas	itap	itkt	alih_status_itk_ke_itas	alih_status_itas_ke_itap	abg	epo	imk	skim	total

The normalized table for the supplied workbook is expected to contain **80 rows** and no `JUMLAH` rows.

## 7. Contract boundary

This contract models **aggregate monthly service activity**, not individual foreign-national/residence-permit records. Fields such as passport number, name, nationality, permit issue date, permit expiry date, latitude, and longitude are therefore outside this contract and remain available only for future, separately versioned datasets.

The production dashboard/statistics/map layers must consume this contract through the dataset registry rather than assuming an individual-record schema.