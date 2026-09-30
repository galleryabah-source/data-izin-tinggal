# GIS First Production UAT — 2026-09-30

**Status:** PASS — production visual UAT evidence captured  
**Scope:** GIS First dashboard for Residence Permit  
**Environment:** Canonical Google Apps Script production deployment  
**Evidence date:** 2026-09-30

## 1. UAT result

A live production screenshot was captured after the canonical production deployment of PR #51.

Observed successfully:

- Total layanan: **258,094**
- Total record: **80**
- Periode: **8**
- Kantor: **10**
- GIS map with immigration-office markers
- Monthly trend chart
- Office ranking
- Service distribution
- Data Explorer with operational records
- Import Data textarea with usable expanded height
- Dataset Registry
- Governance & Monitoring

The observed dashboard totals match the locked Residence Permit production baseline.

## 2. Deployment evidence

- Repository: `galleryabah-source/data-izin-tinggal`
- Production baseline merge: `81534438d55efc7f37e9ccb3156326d99cdd25f9`
- Canonical workflow run: `36686639684`
- Validate job: **success**
- Deploy job: **success**
- Apps Script canonical deployment target: configured by `.github/workflows/deploy-gas.yml`
- PR #51: merged
- Open PRs at checkpoint: **0**

## 3. Screenshot evidence

The screenshot supplied during UAT is the primary visual evidence for this checkpoint.

SHA-256:

`f369ee5bd380815033f01ed6f4ba65bd6c75f11ea4e9defa358ea06cada00c2b`

The screenshot shows the production dashboard populated with the expected canonical Residence Permit values and analytical surfaces.

## 4. Architecture boundary

This UAT result does not authorize new data-model or production-feature changes.

The following remain unchanged:

- canonical dataset contract
- Dataset Registry routing
- import validation
- duplicate/business-key validation
- RBAC
- audit trail
- Office Reference map source
- canonical CI/CD deployment chain
- Residence Permit / Passport dataset isolation

## 5. Baseline decision

GIS First is now considered the **locked production UI baseline**.

Further implementation should be driven only by a concrete operational requirement or a new reproducible UAT defect.

Do not add features solely because they appear in the visual reference.

## 6. Next gate

No feature PR is required from this checkpoint.

The next engineering change should begin only when a concrete operational requirement is defined, with the same sequence:

`requirement → contract/architecture impact → minimal implementation → CI → canonical deployment → live UAT → evidence`
