# Phase 9 — Operational Source Evidence: 2026-09-23 Bandung

**Source:** daily operational report from Kantor Imigrasi Kelas I TPI Bandung  
**Operational date:** 2026-09-23  
**Location:** Kantor Imigrasi Kelas I TPI Bandung  
**Evidence type:** daily operational report  
**Gate:** 9.1 source audit evidence

## 1. Observed daily grain

The report represents one operational-day submission for one immigration office:

```
tanggal = 2026-09-23
kantor_imigrasi = KANIM KELAS I TPI BANDUNG
```

This is direct evidence that the operational reporting unit can be modeled at least as:

```
tanggal × kantor_imigrasi
```

It does **not yet prove** that this is the only possible source grain, nor that every office uses exactly the same template.

## 2. Non-zero observations

The report contains the following non-zero services/counts:

| Source item | Count |
|---|---:|
| Sertifikat ABG | 1 |
| Mutasi paspor | 1 |
| Mutasi Alamat | 1 |
| ERP Tidak Kembali | 2 |
| Perpanjangan VoA Molina | 5 |
| Perpanjangan ITAS Molina | 3 |
| Alih Status Bridging | 4 |

All other listed service items are blank in this report. The source explicitly states **Kendala: Tidak Ada**.

Observed non-zero count across these seven reported items = **17**.

Important: blank is interpreted here only as "no value reported" in the source. It must not yet be normalized to zero in a production contract until the source convention is confirmed.

## 3. Direct mapping to existing monthly contract

The current monthly Residence Permit contract contains these measures:

```
bvk
voa
itk
itk_peralihan
itas
itap
itk_alih_status_itk_ke_itas
alih_status_itas_ke_itap
abg
epo
imk
skim
total
```

The daily source does not use the same vocabulary.

Potentially related examples:

| Daily source | Monthly field candidate | Decision |
|---|---|---|
| Sertifikat ABG | `abg` | plausible semantic match; needs domain confirmation |
| EPO | `epo` | direct name match when non-zero/blank |
| Perpanjangan VoA Molina | `voa` | plausible, but "perpanjangan" + Molina needs confirmation |
| Perpanjangan ITAS Molina | `itas` | plausible, but needs confirmation of monthly definition |
| Alih Status Bridging | `itk_alih_status_itk_ke_itas` or another status field | **not approved** |
| Mutasi Alamat | none obvious | separate daily measure candidate |
| ERP Tidak Kembali | none obvious | separate daily measure candidate |
| Mutasi paspor | none obvious | likely Tikim-side operational measure, not a Residence Permit monthly measure |

No mapping is approved merely because names appear similar.

## 4. Important domain finding

The report is titled as a combined operational report for:

- Seksi Izin Tinggal; and
- Seksi Tikim.

Therefore the daily source contains **more than the current Residence Permit monthly service domain**.

This is a strong reason not to create one universal daily table that blindly mirrors the report.

A safer architecture remains service-family-specific:

```
Daily source report
      |
      +--> Residence Permit daily domain
      |
      +--> Tikim/passport-related daily domain
```

The split must be approved from the operational workflow.

## 5. Total semantics are not yet established

The report has no explicit `Total` field.

The seven non-zero source items sum to:

```
1 + 1 + 1 + 2 + 5 + 3 + 4 = 17
```

This **17 is an observed source-item sum only**. It must not be treated as a canonical dashboard total because:

1. blank-vs-zero semantics are not yet confirmed;
2. some items may belong to different service families;
3. some items may map to existing monthly categories differently;
4. the monthly dashboard has a separate `Total Dashboard` concept;
5. the source may contain operational items that are intentionally excluded from the monthly dashboard.

## 6. Fields that require explicit daily contract decisions

The source demonstrates candidate fields beyond the existing monthly contract:

- `mutasi_paspor`
- `mutasi_alamat`
- `erp_tidak_kembali`
- `pencabutan_dokumen`
- `lapor_kematian`
- `skim`
- `alih_jabatan`
- `perubahan_lain_kanim`
- `duplikat_itap`
- `alih_penjamin`
- `perpanjangan_mrep`
- `lapor_lahir`
- `rangkap_jabatan`
- `penolakan`
- `lapor_itap`
- `itap_baru`
- `perubahan_identitas`

These should not be added to production schema until the source owner confirms which are reportable measures, which are exception/status fields, and which belong to another service family.

## 7. Gate 9.1 status

This evidence improves Gate 9.1 substantially:

- [x] real daily source identified
- [x] representative daily report available
- [x] operational date identified
- [x] immigration office identified
- [x] one-day operational grain observed
- [ ] source owner/workflow formally confirmed
- [ ] all source fields semantically mapped
- [ ] correction workflow evidenced
- [ ] approval workflow evidenced
- [ ] period close/reopen workflow evidenced
- [ ] representative correction sample available
- [ ] historical overlap/reconciliation completed

Therefore:

**Gate 9.1 = PARTIALLY EVIDENCED, NOT PASSED.**

## 8. Next evidence required

The highest-value next evidence is either:

1. the same daily report for another date and office, preferably showing different/non-zero categories; or
2. the official daily reporting template/SOP that defines the meaning of every item and how blank values are interpreted; and
3. if available, one corrected/reissued daily report.

Once these are available, the source-specific daily contract can be drafted without guessing.

## 9. Baseline protection

This evidence does not authorize any modification of:

- `DATA_RESIDENCE_PERMIT_SERVICE_MONTHLY`
- `DATA_PASSPORT_SERVICE_MONTHLY`

The verified monthly baselines remain authoritative.
