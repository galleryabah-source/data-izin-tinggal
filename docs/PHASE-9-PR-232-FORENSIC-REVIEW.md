# PR #232 — Phase 9 Daily Input Forensic Review

**Review date:** 2026-10-16  
**Branch:** `feat/daily-input-workflow-v1`  
**Disposition:** **HOLD — no merge / no production deployment**  
**Review type:** engineering self-review by the implementation author; this is not an independent approval or Gate 9.1 sign-off.

## 1. Exact-head evidence

- Candidate head before this review document: `b218518f156c63e1b716fc2eb39fbd54805e3f1a`.
- GitHub Actions run #794: `npm test` passed; deploy job skipped.
- CI evidence: https://github.com/galleryabah-source/data-izin-tinggal/actions/runs/38845112458
- PR: https://github.com/galleryabah-source/data-izin-tinggal/pull/232
- No production UAT, Apps Script deployment, or live ledger write is claimed.

The review document itself changes the PR head and must receive its own CI result before any later decision.

## 2. Scope and canonical boundary

Reviewed candidate changes cover:

- `gas/DailyInputService.gs`: candidate daily contract, validation, office resolution, draft/submit/review/correction/void lifecycle, audit calls, idempotency, and a closed runtime gate.
- `gas/Code.gs`: permission-scoped daily route and daily bootstrap.
- `gas/Config.gs`: daily permissions for existing role seeds.
- `gas/index.html`: daily-only route, role-aware actions, blocked-state UX, and operator correction of rejected reports.
- `gas/test-shim.js`: syntax, contract, gate, and in-memory lifecycle tests.
- Gate 9.1/roadmap/blueprint documentation.

The candidate implementation does not intentionally modify the monthly importer, canonical monthly dataset contracts, dataset registry identity, monthly period-close logic, historical monthly rows, or dashboard source-of-truth paths. Daily data is not aggregated into monthly datasets by this PR.

## 3. Controls checked

- Code-level `DAILY_INPUT_GUARD_V1.enabled=false` remains a mandatory release kill switch.
- The two CONFIG flags cannot activate persistence while the code-level kill switch is false.
- Ledger creation is behind the same guard as mutations.
- Server permissions are checked at endpoints; the daily route does not grant the ADMIN/SUPERVISOR back-office shell.
- Office selection resolves to exactly one `OFFICE_REFERENCE` record with `status=VERIFIED`.
- Totals are server-derived; incomplete drafts keep a blank total.
- Submission IDs are validated UUIDs; matching retries return the prior outcome and changed-payload ID reuse conflicts.
- Logical-key duplicates are rejected; rejected reports require the correction path; voided keys require an audited reopen workflow.
- Review separation of duties is enforced; correction and void reasons are required.
- Audit failure rollback, submitter/reviewer separation, correction retry, void retry, and rejected-report correction are exercised by in-memory tests.

## 4. Remaining blockers

1. **Gate 9.1 is still BLOCKED.** All 17 per-indicator event/unit/source definitions, exclusions/reversals, requiredness, zero-vs-missing rules, fixtures, and accountable owner sign-off are not complete.
2. **RBAC matrix requires explicit approval.** Role seed defaults in code are not a substitute for owner sign-off of role/action access.
3. **Period lifecycle is not complete.** Close/reopen, closed-period correction policy, and period-level reconciliation need approved rules and implementation/tests.
4. **Storage/audit review remains limited.** In-memory rollback tests do not prove Google Sheets atomicity under all Apps Script failures or external edits.
5. **Concurrency/recovery needs staging evidence.** The script lock and retry tests do not substitute for a controlled concurrent-request test against the actual Apps Script runtime.
6. **Office reference lifecycle needs approval.** Inactive-office behavior and historical office identity retention must be explicit.
7. **Authenticated staging UAT is pending.** Test OPERATOR draft/submit, supervisor reject/approve, correction, void, retry-after-timeout, and audit failure with real authorized accounts in an isolated staging spreadsheet.
8. **Independent forensic review is pending.** The implementation author cannot self-certify the release gate.

## 5. Release decision

Keep the PR as draft and keep the runtime kill switch closed. Do not merge, deploy, create the daily ledger, or enable daily writes until the Gate 9.1 decision register is complete, the accountable owner records PASS, the independent forensic review passes, CI is green on the final head, and isolated staging UAT provides evidence.

## 6. Supplemental review — isolated staging storage boundary (2026-10-16)

The implementation was further hardened after the initial self-review:

- Daily ledger creation now resolves through `DAILY_STAGING_SPREADSHEET_ID`, not `getDb_()`/the canonical application spreadsheet.
- The staging property is rejected when absent, when canonical `SPREADSHEET_ID` is absent, or when staging and canonical IDs are equal.
- Daily audit events are written to `DAILY_INPUT_AUDIT` in the same staging spreadsheet; daily workflow calls no longer use the canonical `appendAudit_` path.
- The policy response reports `stagingReady`; daily writes are considered enabled only when the code-level gate, both CONFIG flags, and a distinct staging identity all pass.
- Regression tests now use separate mock canonical/staging spreadsheets and assert that neither the daily ledger nor daily audit is created in the canonical store, and that a daily audit event lands in staging.
- CI run #804 passed `npm test` on head `e82f8f1345cb5d7e05202c737f756e85d2daf5b0`: https://github.com/galleryabah-source/data-izin-tinggal/actions/runs/38868683276

**Limit of evidence:** this is still code review and mocked CI, not an actual Apps Script staging run. No real staging spreadsheet ID has been configured or verified in the available project evidence. Do not infer Gate 9.2 PASS from these tests. The runtime kill switch remains false, and this review remains a self-review, not an independent release approval.
