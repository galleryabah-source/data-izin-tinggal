# Phase 9 — Narrative Daily Report Normalization Fixtures

**Status:** test evidence only; not an approval of production measure mappings.  
**Source dates:** 2026-10-12 and 2026-10-14 (Asia/Jakarta).  
**Fixture file:** `gas/test-fixtures/daily-report-normalization.json`  
**Normalization rule:** a blank/no-number service field in the supplied narrative report is converted to explicit integer `0`. Keep the original report as source evidence. The rule is scoped to transcription/normalization and does not change app API validation or Gate 9.1 missing/null policy.

## Reconciled examples

| Fixture ID | Office | Operational date | Source indicators | Non-zero indicators | Arithmetic sum |
|---|---|---|---:|---:|---:|
| `karawang-2026-10-14` | Kantor Imigrasi Kelas I Non TPI Karawang | 2026-10-14 | 33 | 7 | 32 |
| `bandung-2026-10-12` | Kantor Imigrasi Kelas I TPI Bandung | 2026-10-12 | 28 | 7 | 31 |
| `bandung-2026-10-14` | Kantor Imigrasi Kelas I TPI Bandung | 2026-10-14 | 28 | 9 | 49 |
| **Combined arithmetic total** | | | **89** | | **112** |

**Correction to the prior conversational summary:** the 2026-10-12 Bandung report sums to **31**, not 30. It contains seven non-zero service indicators. Consequently, the combined arithmetic sum for these three reports is **112**, not 111. The fixture and automated regression test encode the corrected arithmetic.

## Interpretation boundary

- Counts are arithmetic sums of the source indicators after blank-to-zero normalization; they are not certified unique service totals.
- Preserve every source label and its count. Similar labels do not authorize mapping to the 17 candidate daily application measures.
- Items such as `Alih Status Bridging`, `Bridging ITAS ke ITK`, `Altus ITK-ITAS Molina`, and `Altus ITAS - ITAP Molina` must remain distinct until the accountable operational owner approves their definitions.
- `Kendala: Tidak Ada` is a narrative status, not a service-count measure; it is represented as zero only if the normalization schema explicitly encodes it as a numeric field, otherwise preserve it as text.
- This fixture is not a production import, does not create a staging store, and does not authorize changing the monthly baseline.

## Automated controls

The Node test shim checks:
- all three reports are present with the expected office/date identity;
- source indicator counts are 33, 28, and 28;
- all normalized count fields are safe non-negative integers;
- non-zero indicator counts and arithmetic sums reconcile to 32, 31, and 49;
- the combined arithmetic sum is 112; and
- fixture documentation forbids inferred mapping to candidate application measures.

**Release boundary:** PR #228 remains unmerged; `DAILY_INPUT_GUARD_V1.enabled = false`; Gate 9.1 remains BLOCKED until all owner definitions, cross-cutting policies, and independent review requirements pass.
