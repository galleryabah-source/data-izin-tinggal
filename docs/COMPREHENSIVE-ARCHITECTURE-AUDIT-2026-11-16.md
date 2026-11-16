# Comprehensive Architecture Audit — 2026-11-16

**Repository:** `galleryabah-source/data-izin-tinggal`  
**Audited baseline:** `main` at `bcafbdf5944cde2ae6b5e1035e7fa81ba4ee7f01`  
**Audit type:** static source, blueprint/roadmap and repository-evidence review  
**Runtime certification:** NOT PERFORMED

## 1. Executive disposition

The application has a substantial foundation for canonical monthly residence-permit and passport datasets, import governance, GIS/dashboard reporting, public INTAL TV read surfaces, audit, backup snapshots, and period governance.

The principal release risks are not a need to rebuild the platform. They are:
1. A public Apps Script RPC surface includes setup functionality with schema/security-seeding side effects.
2. Daily Input source in the audited baseline does not enforce the documented Gate 9.1 boundary consistently: the code-level guard is enabled, an owner override can satisfy the gate condition, and a hardcoded staging spreadsheet fallback exists.
3. The Google authentication gateway is a scaffold on a separate draft PR, not an integrated authorization boundary for all protected Apps Script RPCs.
4. Repository documentation does not consistently distinguish source implementation, deployed version, authenticated UAT, and production certification.

This audit does not certify production runtime state.

## 2. Evidence and scope

Reviewed repository source and documentation on `main`, including:
- `gas/Code.gs`, `gas/Auth.gs`, `gas/Config.gs`, `gas/ImportService.gs`, `gas/DashboardService.gs`
- `gas/DailyInputService.gs`, `gas/PublicTvService.gs`, `gas/BackupService.gs`, `gas/PeriodClosingService.gs`, `gas/VerificationService.gs`
- `gas/OfficeReferenceService.gs`, `gas/SourceConnectorService.gs`, `gas/ProductionEvidenceService.gs`, `gas/appsscript.json`
- `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/MULTI-SERVICE-BLUEPRINT.md`, `docs/DATA-CONTRACT-v1.md`
- `docs/DAILY-INPUT-BLUEPRINT.md`, `docs/PHASE-9-DAILY-OPERATIONAL-DATA.md`, Gate 9.1 decision register, owner worksheet and test matrix
- Open draft PR #246, Google authentication gateway scaffold.

This was a static repository review. No production Script Properties, live spreadsheets, Vercel environment variables, OAuth configuration, deployment runtime, or authenticated browser session were inspected. No live penetration test or production UAT was performed.

## 3. Findings by priority

### P0 — Public setup RPC with side effects

In the audited `main` baseline, `gas/Code.gs` declares public global `setupApp()`. It initializes schemas and seeds security and dictionary data. The Apps Script manifest uses `executeAs: USER_DEPLOYING` and `access: ANYONE_ANONYMOUS`. Public global functions can be invoked through `google.script.run`; underscore-suffixed functions are private to that RPC surface.

**Required remediation:** rename the setup entry point to `setupApp_()` (manual editor-only operation) or otherwise remove it from the public RPC surface. Add a regression assertion that the public name is absent. Do not expose a generic setup endpoint.

### P0 — Daily Input Gate 9.1 can be bypassed by configuration

The audited `gas/DailyInputService.gs` baseline has `DAILY_INPUT_GUARD_V1.enabled: true`. The policy accepts `DAILY_INPUT_OWNER_OVERRIDE=APPROVED_WITH_EXCEPTIONS` as an alternative to `DAILY_INPUT_GATE_9_1=PASS`. It also has a hardcoded staging spreadsheet ID fallback.

This conflicts with the Gate 9.1 decision register and daily-input blueprint, which state that Gate 9.1 remains BLOCKED until all operational definitions and policies are approved, and that the code-level kill switch must remain closed.

**Required remediation:** force the code-level guard to false; require the explicit Gate 9.1 PASS value; remove the override path; require an explicitly configured staging spreadsheet ID; reject missing or canonical-colliding IDs. No daily provisioning, UI activation, or writes are authorized by this audit.

### P1 — Gateway authentication is not integrated across RPCs

Legacy `gas/Auth.gs` resolves identity using `Session.getActiveUser().getEmail()`, then checks USERS and PERMISSIONS. The Google identity gateway scaffold exists in draft PR #246, but existing protected RPCs and the browser call adapter do not yet uniformly forward and verify a gateway session.

**Required remediation:** inventory every callable global RPC; define a public read-only allowlist for TV; require explicit session validation before every protected read or mutation; derive identity and permissions server-side; test revoked/inactive users and denial-before-write. Do not merge the scaffold as completed authentication.

### P1 — Status vocabulary and evidence are inconsistent

Repository documents sometimes use implementation/deployment language without a consistent evidence model. A source function, a successful CI run, a deployed Apps Script version, authenticated browser UAT, and production certification are different states.

**Required remediation:** use the following controlled status vocabulary in roadmap and release evidence:
- `PLANNED`: documented, no implementation evidence.
- `IMPLEMENTED`: source exists and relevant automated tests pass on an identified commit.
- `DEPLOYED`: exact source commit/version is proven deployed to the target environment.
- `UAT_PASSED`: named scenarios pass in the target environment with evidence and actor context.
- `PRODUCTION_CERTIFIED`: deployment, UAT, security, integrity, backup/recovery and smoke evidence are all accepted.
- `BLOCKED`: a required gate or prerequisite is not satisfied.
- `HOLD`: explicitly paused by decision.

Never infer a later state from an earlier one. Record commit SHA, deployment/version ID, environment, test run, evidence link, verifier, and timestamp.

### P2 — Documentation and roadmap alignment

The daily-input roadmap and source implementation are out of sync. Historical status statements should remain available as history, but must be marked with their effective date and evidence. Phase 9 must remain BLOCKED until the full Gate 9.1 decision register and test matrix are approved.

## 4. Architecture areas reviewed

| Area | Static assessment | Release condition |
|---|---|---|
| Canonical monthly contracts and registry | Foundation present | Preserve business keys, derived totals and registry identity |
| Import pipeline | Parser, validation, duplicate checks, preview and commit present | Continue negative, concurrency and recovery testing |
| Dashboard/GIS/drilldown | Read services and Office Reference seams present | Verify office filtering, map identity and authenticated access |
| Cross-service reporting | Read-only composition present | Preserve canonical source datasets and comparable metrics |
| Audit and period governance | Audit and close/reopen services present | Prove audit failure handling and authenticated UAT |
| Backup | Snapshot and verification services present | Certify restore/recovery separately; do not infer from snapshot creation |
| INTAL TV | Public read-only service family present | Verify sanitization and strict endpoint allowlist |
| Daily Input Phase 9 | Candidate lifecycle source exists | Keep blocked until Gate 9.1 PASS and isolated Gate 9.2 evidence |
| Google authentication | Gateway scaffold in draft PR #246 | Full RPC and browser integration plus end-to-end tests |
| CI/CD | Workflow infrastructure present | CI success is not deployment or production certification |

## 5. Data boundary — non-negotiable

- `RESIDENCE_PERMIT_SERVICE_MONTHLY` and `PASSPORT_SERVICE_MONTHLY` remain canonical monthly baselines.
- Daily staging must use an explicitly configured spreadsheet distinct from canonical storage.
- Daily input must not mutate monthly sheets, importer paths, dataset registry identity, or historical monthly rows.
- Monthly projections from daily records are read-only until separately approved and reconciled.
- WhatsApp integration remains HOLD.
- Do not describe Google Sheets plus `LockService` as a cross-spreadsheet ACID transaction.

## 6. Required remediation sequence

1. P0 security PR: privatize setup RPC; close daily code kill switch; remove owner override bypass; remove hardcoded staging fallback; add regression tests.
2. P1 authentication PR: complete callable-RPC inventory, browser session lifecycle, Apps Script gateway verification, per-RPC enforcement, public TV allowlist and negative/positive E2E tests.
3. Roadmap/evidence PR: normalize status vocabulary and reconcile effective status with commit/deployment/UAT evidence.
4. Gate 9.1: finish the 17 indicator definitions, date/cutoff semantics, zero-vs-missing, reversal/correction, role matrix, period policy and owner sign-off.
5. Gate 9.2: only after Gate 9.1 PASS, validate staging isolation, idempotency, concurrency, audit failure/recovery and no-monthly-write invariants in actual Apps Script runtime.
6. Production release: CI PASS → forensic diff PASS → explicit merge → canonical deployment evidence → authenticated smoke → browser UAT → integrity and recovery evidence → production certification.

## 7. Acceptance criteria for P0

- `setupApp()` is absent from the public callable surface; `setupApp_()` remains manually runnable from the Apps Script editor.
- Daily code guard is false in the release branch.
- Owner override cannot satisfy Gate 9.1.
- Daily staging requires an explicit Script Property and fails closed if missing or equal to canonical ID.
- Automated regression tests cover each condition.
- No canonical monthly dataset, importer, registry, or historical row is changed.
- CI passes on the exact PR head and the diff is reviewed before merge.

## 8. Release status

At the audited baseline:
- Gateway auth: `IMPLEMENTED` as an isolated scaffold only; `BLOCKED` for application-wide integration.
- Daily Input: candidate lifecycle code exists; `BLOCKED` for Gate 9.1 and production activation.
- Production deployment and authenticated UAT: not established by this static audit.
- Production certification: not established.

**Audit conclusion:** retain the current application architecture and canonical monthly baseline. Prioritize the P0 security boundary and complete gateway integration before enabling new daily-input workflows.
