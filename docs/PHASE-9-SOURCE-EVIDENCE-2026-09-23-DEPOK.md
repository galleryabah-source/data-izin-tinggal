# Phase 9 — Operational Source Evidence: 2026-09-23 Depok

**Source:** daily operational report from Kantor Imigrasi Kelas I Non TPI Depok  
**Operational date:** 2026-09-23  
**Location:** Kantor Imigrasi Kelas I Non TPI Depok  
**Evidence type:** daily operational report  
**Gate:** 9.1 source audit evidence

## 1. Grain confirmation

The report is a daily submission for one immigration office:

```
tanggal = 2026-09-23
kantor_imigrasi = KANIM KELAS I NON TPI DEPOK
```

This is the third independent office observation supporting the operational grain:

```
tanggal × kantor_imigrasi
```

## 2. Depok source vocabulary

The report contains 35 numbered items and explicitly supplies zero for the reported zero-valued items.

Non-zero items:

| Source item | Count |
|---|---:|
| Perpanjangan ITK | 2 |
| Perpanjangan ITAS I sd III | 5 |
| Perpanjangan ITAP | 1 |
| Alih Status ITAS-ITAP | 1 |
| Sertifikat ABG | 1 |
| Mutasi Paspor | 1 |
| Mutasi Alamat | 1 |

Observed source-item sum = **12**.

This is an operational source sum only and is not a canonical dashboard total.

## 3. New evidence: source granularity exceeds monthly granularity

Depok explicitly separates:

- Perpanjangan ITAS I sd III;
- Perpanjangan ITAS IV;
- Perpanjangan ITAS V;
- ITAS Baru;
- Pemberian ITAS;
- Alih Status ITK-ITAS;
- Alih Status ITAS-ITAP.

The existing monthly contract has a single `itas` measure plus separate status-transition measures.

Therefore the daily contract cannot simply copy monthly columns one-to-one.

A normalization rule will be required, for example:

```
daily source vocabulary
        ↓
canonical daily measures
        ↓
monthly contract mapping
```

The exact grouping of ITAS subcategories must be confirmed from the official reporting definition.

## 4. Candidate mappings

| Daily source | Existing monthly candidate | Status |
|---|---|---|
| Perpanjangan ITK | `itk` | strong candidate |
| Perpanjangan ITAS I sd III | `itas` | strong candidate but aggregation rule needed |
| Perpanjangan ITAS IV | `itas` | candidate; confirm inclusion |
| Perpanjangan ITAS V | `itas` | candidate; confirm inclusion |
| Perpanjangan ITAP | `itap` | strong candidate |
| Alih Status ITK-ITAS | `itk_alih_status_itk_ke_itas` | strong candidate |
| Alih Status ITAS-ITAP | `alih_status_itas_ke_itap` | strong candidate |
| Sertifikat ABG | `abg` | strong candidate |
| Perpanjangan VOA | `voa` | strong candidate |
| EPO | `epo` | strong candidate |
| SKIM | `skim` | strong candidate |
| Izin Tinggal Kunjungan Peralihan | `itk_peralihan` | strong candidate |
| Mutasi Paspor | none in Residence Permit contract | Tikim/passport domain candidate |
| Mutasi Alamat | none obvious | separate operational measure / domain confirmation |
| MERP | none obvious | separate operational measure |
| Affidavit | none obvious | separate operational measure |
| ERP Tidak Kembali | none obvious | separate operational measure |
| Lapor Lahir | none obvious | separate operational measure |
| Pelaporan ITAP | none obvious | separate operational/status measure |
| Alih/Rangkap Jabatan | none obvious | separate operational measure |
| Concurrent Activity | none obvious | separate operational measure |
| Pencabutan Dokim jadi WNI | none obvious | separate operational measure |
| Alih sponsor/penjamin | none obvious | separate operational measure |
| Alih penjamin ITAP | none obvious | separate operational measure |
| Penolakan dan alasannya | none obvious | exception/status field, not yet a service measure |
| Kendala | none obvious | operational status, not a service measure |
| Change data profile | none obvious | separate operational measure |
| Change Data Activity | none obvious | separate operational measure |
| Pendaftaran ABG | `abg` candidate | aggregation semantics required |
| Pendaftaran Ulang ABG | `abg` candidate | aggregation semantics required |

No mapping is approved solely from lexical similarity.

## 5. Cross-office normalization finding

Comparison of the three 2026-09-23 reports shows that offices use different templates:

- Bandung: 28-item mixed Izin Tinggal + Tikim report, with many blank values.
- Sukabumi: 21-item report with explicit numeric zeros.
- Depok: 35-item report with finer ITAS/ABG/activity categories.

Therefore the daily contract must normalize **source vocabulary**, not assume identical source columns across offices.

The source adapter should retain provenance:

```
source_office
source_report_date
source_item_label
source_value
```

before canonical aggregation.

## 6. Zero semantics

Depok, like Sukabumi, explicitly reports zero values.

This strengthens the rule that explicit zero is meaningful.

Bandung's blanks remain unresolved. Until an official template/SOP confirms the convention, the canonicalizer should preserve the distinction between:

- explicit zero;
- blank/not reported.

## 7. Domain separation

The report title says Izin Tinggal and Status Keimigrasian, and includes `Mutasi Paspor`.

Therefore the source is a multi-domain operational report.

The canonical daily model should separate service families rather than force every source item into Residence Permit measures.

## 8. Gate 9.1 progress

- [x] real daily source identified;
- [x] representative reports from three offices available;
- [x] operational date identified;
- [x] immigration office identified;
- [x] date × office grain observed in three offices;
- [x] explicit-zero behavior observed in Sukabumi and Depok;
- [x] strong mappings to several existing Residence Permit measures identified;
- [x] source-template variation observed;
- [x] daily granularity exceeding monthly granularity observed;
- [ ] official source template/SOP confirmed;
- [ ] source owner/workflow formally confirmed;
- [ ] correction/reissue workflow evidenced;
- [ ] approval workflow evidenced;
- [ ] period close/reopen workflow evidenced;
- [ ] correction sample available;
- [ ] historical overlap/reconciliation completed.

Therefore:

**Gate 9.1 = STRONGLY EVIDENCED, NOT PASSED.**

## 9. Design implication

Phase 9 should not implement a daily schema that is merely the monthly schema with `periode` replaced by `tanggal`.

A proper canonicalization layer is required:

```
office-specific daily report
        ↓
source vocabulary normalization
        ↓
service-family separation
        ↓
canonical daily contract
        ↓
approved revisions
        ↓
monthly/yearly aggregation
```

## 10. Baseline protection

This evidence does not authorize modification of:

- `DATA_RESIDENCE_PERMIT_SERVICE_MONTHLY`
- `DATA_PASSPORT_SERVICE_MONTHLY`

The verified monthly baselines remain authoritative.
