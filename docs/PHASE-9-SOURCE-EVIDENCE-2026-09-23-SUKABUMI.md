# Phase 9 — Operational Source Evidence: 2026-09-23 Sukabumi

**Source:** daily operational report from Kantor Imigrasi Kelas I Non TPI Sukabumi  
**Operational date:** 2026-09-23  
**Location:** Kantor Imigrasi Kelas I Non TPI Sukabumi  
**Evidence type:** daily operational report  
**Gate:** 9.1 source audit evidence

## 1. Observed daily grain

The report represents one daily submission for one immigration office:

```
tanggal = 2026-09-23
kantor_imigrasi = KANIM KELAS I NON TPI SUKABUMI
```

This provides a second independent observation of the `tanggal × kantor_imigrasi` operational grain already observed in Bandung.

## 2. Source template

The Sukabumi report contains 21 numbered operational items. Unlike the Bandung report, every item is explicitly populated with a numeric value, including zero.

This is strong evidence that:

- a reported zero is a meaningful operational value;
- blank and zero must not be conflated without further evidence;
- the daily source can support deterministic numeric normalization if the template convention is confirmed across offices.

## 3. Source observations

| Source item | Count |
|---|---:|
| Perpanjangan ITK | 0 |
| Perpanjangan ITAS | 3 |
| Perpanjangan ITAP | 0 |
| Alih Status ITK-ITAS | 0 |
| Alih Status ITAS-ITAP | 0 |
| Perpanjangan VOA | 1 |
| Pend/Ulang ABG | 0 |
| Faskim Affidavit | 0 |
| Pelaporan ITAP | 0 |
| EPO | 0 |
| MERP | 0 |
| Lapor lahir | 0 |
| SKIM Pasal 19 | 0 |
| Mutasi Paspor | 1 |
| Lapor kematian | 0 |
| ERP Tdk kembali | 0 |
| Perpanjangan ITKT | 0 |
| Mutasi Alamat Masuk | 0 |
| Mutasi Alamat Keluar | 0 |
| Mutasi Alamat Lokal | 0 |
| ITK Peralihan/Bridging | 0 |

Observed source-item sum = **5**.

This is a source-item sum only and is not yet a canonical dashboard total.

## 4. Stronger mapping evidence to monthly measures

Several source labels align closely with existing Residence Permit monthly measures:

| Daily source | Existing monthly candidate | Evidence status |
|---|---|---|
| Perpanjangan ITK | `itk` | strong lexical/semantic candidate; contract approval still required |
| Perpanjangan ITAS | `itas` | strong candidate |
| Perpanjangan ITAP | `itap` | strong candidate |
| Alih Status ITK-ITAS | `itk_alih_status_itk_ke_itas` | strong candidate |
| Alih Status ITAS-ITAP | `alih_status_itas_ke_itap` | strong candidate |
| Perpanjangan VOA | `voa` | strong candidate |
| Pend/Ulang ABG | `abg` | strong candidate |
| EPO | `epo` | strong candidate |
| SKIM Pasal 19 | `skim` | strong candidate |
| ITK Peralihan/Bridging | `itk_peralihan` | strong candidate |
| Mutasi Paspor | none | likely Tikim/passport domain; do not map to Residence Permit |
| Faskim Affidavit | none obvious | separate daily candidate / domain confirmation needed |
| Pelaporan ITAP | none obvious | may be operational status/reporting rather than service count |
| MERP | none obvious | separate candidate; domain confirmation needed |
| Lapor lahir | none obvious | separate candidate |
| Lapor kematian | none obvious | separate candidate |
| ERP Tdk kembali | none obvious | separate candidate |
| Perpanjangan ITKT | none obvious | separate candidate |
| Mutasi Alamat Masuk | none obvious | separate candidate |
| Mutasi Alamat Keluar | none obvious | separate candidate |
| Mutasi Alamat Lokal | none obvious | separate candidate |

The first ten strong candidates align closely with the existing monthly service vocabulary. This is evidence for a possible daily-to-monthly mapping, not final contract approval.

## 5. Cross-office comparison with Bandung

The Bandung report on the same date used a different textual template and included a combined Izin Tinggal + Tikim report.

Sukabumi uses a more standardized 21-item list and explicitly reports zeros.

This establishes two important facts:

1. The operational domain appears substantially shared across offices.
2. The exact presentation/template may differ by office.

Therefore canonicalization should normalize source vocabulary into a contract while retaining source provenance/template information where necessary.

## 6. Zero and blank semantics

The evidence now shows:

- Sukabumi: explicit zero values;
- Bandung: several items were blank.

We **cannot yet conclude** that Bandung blanks always mean zero. The system should therefore distinguish:

```
SOURCE_ZERO
SOURCE_BLANK
```

until the official template/SOP confirms their equivalence.

If the official reporting rule says blank = zero, canonical normalization can convert it deterministically and record the rule/version.

## 7. Domain boundary

The source still contains both Izin Tinggal and Status Keimigrasian/Tikim items, especially `Mutasi Paspor`.

Therefore the daily source should be treated as a **source report containing multiple domain families**, with canonical service contracts separating the domains.

Do not create a universal daily production dataset simply because the source is one report.

## 8. Gate 9.1 progress

Current evidence:

- [x] real daily source identified;
- [x] representative daily report available;
- [x] operational date identified;
- [x] immigration office identified;
- [x] date × office grain observed in two offices;
- [x] explicit-zero behavior observed in Sukabumi;
- [x] multiple strong mappings to existing Residence Permit measures identified;
- [ ] source owner/workflow formally confirmed;
- [ ] exact source template/SOP confirmed;
- [ ] correction workflow evidenced;
- [ ] approval workflow evidenced;
- [ ] period close/reopen workflow evidenced;
- [ ] representative correction sample available;
- [ ] historical overlap/reconciliation completed.

Therefore:

**Gate 9.1 = STRONGLY EVIDENCED BUT NOT PASSED.**

## 9. Next evidence required

Highest-value evidence now:

1. official daily template/SOP used across offices, or
2. another daily report showing a broader set of non-zero services, and
3. one correction/reissued report if such a case exists.

The correction/reissue evidence is particularly important because it determines whether revision history belongs in the source contract or must be introduced by the application.

## 10. Baseline protection

This evidence does not authorize modification of:

- `DATA_RESIDENCE_PERMIT_SERVICE_MONTHLY`
- `DATA_PASSPORT_SERVICE_MONTHLY`

The verified monthly baselines remain authoritative.
