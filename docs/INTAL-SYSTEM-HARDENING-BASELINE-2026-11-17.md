# INTAL System Hardening Baseline and Execution Plan

**Date:** 2026-11-17  
**Status:** Engineering baseline / execution contract; not a production certification.  
**Applies to:** INTAL Web App, Apps Script runtime, Google Sheets storage, browser UI, GitHub CI/CD, reporting and operational modules.

## 1. System objective

Operate INTAL as one application with one canonical lifecycle and one source of truth. Every capability must have an explicit owner, identity boundary, permission, data contract, lifecycle, audit trail, failure behavior, test evidence, and release state.

This document coordinates hardening work. It does not authorize production deployment, public disclosure, Gate 9.1 approval, or mutation of canonical monthly datasets.

## 2. Non-negotiable data boundaries

1. `RESIDENCE_PERMIT_SERVICE_MONTHLY` and `PASSPORT_SERVICE_MONTHLY` remain the canonical monthly datasets.
2. Preserve registry identity, importer contracts, business keys, historical rows, derived totals, aggregation and existing production baselines.
3. No Daily Input, Kanwil, OCR, or other intake feature may write to canonical monthly sheets.
4. Daily operational records and Kanwil individual applications require physically and logically isolated storage contracts.
5. Cross-service and Kanwil reporting adapters are read-only projections over approved, validated source records.
6. No automatic inference or silent normalization of names, passport numbers, application numbers, dates, office identity, or service counts.
7. All timestamps must declare their source timezone and normalized storage timezone; application timezone is Asia/Jakarta.

## 3. Trust boundaries and security architecture

### 3.1 Browser is untrusted

- UI visibility, client-side route checks, hidden controls and client-side tokens are not authorization.
- Every exposed Apps Script RPC must be classified and protected server-side.
- Unknown RPC names and unclassified callable declarations fail closed.
- Public TV endpoints are a separate, finite anonymous allowlist; they never inherit a protected-user bypass.

### 3.2 Identity and session

Current repository evidence identifies legacy `Session.getActiveUser().getEmail()` identity plus `USERS` and `PERMISSIONS`. A Gateway token flow is designed but not implemented end-to-end.

Before selecting an identity implementation, verify the actual Apps Script deployment execution mode, Google Workspace domain policy, active-user availability, OAuth audience/issuer, browser token acquisition and server-side verification feasibility. Do not assume Apps Script session email is available or trustworthy in every deployment mode.

Provider-neutral contract:
- immutable external subject mapped to one active internal user;
- server-side account status and current permission resolution;
- short-lived access token, strict issuer/audience/algorithm/key allowlist and time validation;
- revocation/session epoch and key-rotation procedure;
- no refresh token in RPC, Script Properties, Sheets, browser persistent storage or logs;
- normalized unauthenticated/forbidden errors without leaking account existence;
- no permissive legacy fallback after a protected endpoint is migrated.

Gateway rollout must be incremental: one read-only pilot, then negative tests, then endpoint-by-endpoint migration. No dispatcher-only guard may substitute for protecting directly callable RPC functions.

### 3.3 Authorization and scope

- `RPC_MANIFEST_V1` is an inventory and test contract, not a runtime authorization engine.
- Each protected endpoint must enforce its declared permission on the server.
- Role permission data in `PERMISSIONS` is authoritative after controlled migration; revocation must not be silently undone by default-role reseeding.
- Resource scope (office, Kanwil, dataset, period) is checked independently from role membership.
- Privileged mutations re-check authorization immediately before the write.
- Setup, bootstrap, repair, snapshot, import, export and administrative actions require explicit privileged controls and audit evidence.

### 3.4 Public data

Before public certification:
- approve the exact output fields and publication owner;
- reject PII, raw rows, internal identifiers, permission metadata and unapproved source URLs;
- preserve null/pending coordinate states;
- moderate and audit public running text;
- bound filters, result size, cache and request rates;
- verify quota/capacity source authority and freshness.

## 4. Canonical application lifecycle

All modules should follow this shared lifecycle pattern:

1. **Authenticate** the principal.
2. **Authorize** the capability and resource scope.
3. **Validate** schema, payload, provenance, date/time and business key.
4. **Acquire concurrency control** for the affected logical key/resource.
5. **Apply idempotency** to retries and duplicate requests.
6. **Persist** the state transition using the module's declared consistency model.
7. **Append audit evidence** with actor, action, correlation ID, reason and outcome.
8. **Return a minimized response** with stable error codes.
9. **Reconcile** partial failures and expose operational health.

Google Sheets is not an ACID relational database. Multi-sheet writes must not be described as atomic transactions. Where Sheets remains the storage engine, use lock-guarded transitions, append-only event evidence, idempotency keys, checkpoints and explicit reconciliation. For workflows requiring stronger transactional guarantees, evaluate PostgreSQL as a separately approved storage foundation rather than silently changing the existing baseline.

## 5. Module contracts

| Module | Data boundary | Required control | Release condition |
|---|---|---|---|
| Monthly Residence / Passport | Canonical monthly datasets | Import contract, business key, derived totals, registry integrity, backup and regression smoke | Existing baseline preserved and production evidence green |
| Daily Input Phase 9 | Separate daily staging ledger and audit | 17 approved measures, original operational date, late-entry reason, idempotency, separation of duties, revision history | Formal Gate 9.1 approval plus isolated staging, security tests and separate release |
| Kanwil Smart Screenshot Entry | Dedicated Kanwil stores | Source provenance, local parser/OCR review, PII masking, scoped duplicate candidates, human commit, append-only revisions | K0-K6 gates, representative approved samples, authorization and retention approval |
| Public TV | Explicit anonymous projections | Output allowlist, publication approval, rate/size bounds, moderation | Public data-owner approval and endpoint tests |
| GIS / Office Reference | Approved office reference and aggregate measures | Coordinate provenance/status, source authority, no inference of office identity | Reference verification and map regression |
| Cross-service reporting | Read-only canonical projections | Semantic compatibility, period alignment, source snapshot and reconciliation | Contract and aggregation parity tests |
| Backup / recovery | Snapshot evidence and restricted storage | Backup identity, integrity verification, restore rehearsal, access audit | Restore evidence and recovery objective approval |

## 6. CI/CD and release controls

Required CI layers:
1. formatting/static source checks and callable-surface drift;
2. syntax and unit tests;
3. Apps Script shim tests with deterministic fixtures;
4. PostgreSQL integration tests where PostgreSQL is used;
5. composed end-to-end tests for browser -> RPC -> authorization -> storage -> audit;
6. security-negative tests: anonymous, expired/revoked identity, wrong role, wrong scope, stale permission, replay, concurrency and malformed payload;
7. deployment artifact verification and environment configuration checks;
8. post-deployment regression smoke and rollback evidence.

A green unit/static workflow is not production certification. Every release record must distinguish:
- implemented;
- CI-passed;
- merged;
- deployed (deployment ID/version and timestamp);
- UAT-passed (tester, scenario and evidence);
- production-certified (owner approval and operational evidence).

Deploy workflows must be protected from pull-request contexts and require explicit environment approvals for production. Secrets must never be exposed to untrusted PR code.

## 7. Operational resilience

- Define SLOs for availability, RPC latency, import completion, error rate and data freshness.
- Instrument correlation IDs across browser, RPC, import batch, audit and provider delivery.
- Never log credentials, bearer tokens, passport numbers or raw sensitive payloads.
- Bound request sizes, row counts, file sizes, execution time and retry attempts.
- Use exponential backoff with jitter only for safe/idempotent operations.
- Provide backup verification and periodic restore drills, not merely backup creation.
- Add health checks for storage identity, schema version, permission integrity, cache, quotas and deployment version.
- Define incident severity, containment, owner notification, evidence preservation and recovery steps.

## 8. Data governance and privacy

For each dataset, record owner, purpose, legal/source authority, classification, permitted roles, retention period, export policy, backup access and deletion procedure. Mask passport number and date of birth by default. Keep PII out of public TV, analytics, URL parameters, telemetry and error summaries. Retention and source authorization must be approved before Kanwil production intake.

## 9. Execution order and gates

### P0 — Close immediate security exposure
- Keep setup/bootstrap functions private to browser RPC.
- Preserve Gate 9.1 code guard and remove configuration/owner bypasses.
- Complete RPC inventory and verify every direct callable guard and browser callsite.
- Validate privileged administrative functions and public anonymous endpoints.
- Obtain full CI evidence for the exact head SHA.
- Do not merge/deploy solely because static tests pass.

### P1 — Identity and Gateway contract
- Verify deployment mode and approved identity provider.
- Implement a provider adapter and server-side token validation only after issuer, audience, key-discovery/pinning, subject mapping, revocation and secret-storage contracts are confirmed.
- Pilot one read-only RPC end-to-end.
- Add negative tests before migrating further endpoints.

### P2 — Authorization and RPC enforcement
- Move to endpoint-specific enforcement with exact manifest permission and resource scope.
- Add dynamic dispatcher and direct-RPC tests.
- Verify privilege separation and permission revocation.
- Add audit correlation and safe error normalization.

### P3 — Data integrity and resilience
- Verify canonical monthly contracts and snapshot/restore evidence.
- Add idempotency/concurrency/reconciliation tests to every mutation path.
- Verify schema migrations and rollback behavior.
- Keep Daily and Kanwil storage isolated.

### P4 — Public surface and reporting
- Approve anonymous TV fields and add exact output-key tests.
- Validate GIS coordinate status and source provenance.
- Certify cross-service reporting semantics and snapshot freshness.

### P5 — Daily Input Gate 9.1 / 9.2
- Gate 9.1 remains BLOCKED until formal owner approval evidence is attached.
- Preserve the owner-approved counting basis: service completed or document issued.
- Late reports may use the original operational date with reason and audit.
- After approval, test isolated staging, identity, access control, idempotency, revisions, audit and failure recovery.
- No daily-to-monthly backfill without a separately approved semantic contract.

### P6 — Kanwil Smart Screenshot Entry
- Freeze the 17-column source contract only after source samples and semantics are confirmed.
- Verify timezone, Kanwil scope, application-number uniqueness, status vocabulary, source authorization and retention.
- Keep OCR review-only; no auto-commit or fuzzy identity correction.
- Build persistence only after Gateway and scope authorization are certified.

### P7 — Production certification
- Run full CI, security tests, restore drill, load/quota tests and browser UAT.
- Record deployment ID/version, environment, smoke results and rollback evidence.
- Obtain explicit owner sign-off for production certification.

## 10. Current known status at baseline

- P0 PR #248 contains the setup/daily guard changes, RPC manifest and static drift/guard tests.
- The latest known P0 head is `2e8e499ecda4c20831184bef4d6ed9d863c26c37`; its recorded validate and RPC contract jobs passed. The deploy job was skipped.
- Gateway authentication remains design-only; no end-to-end issuer/token verification is evidenced.
- Public TV anonymous data review is static and is not publication approval.
- Daily Input code guard remains disabled and Gate 9.1 remains BLOCKED.
- PR #250 Kanwil intake remains draft/local parsing and contract work; no persistent storage RPC or production route is certified.
- Canonical monthly data and historical baseline must remain unchanged.

## 11. Evidence required to change a gate

A gate can move only with a linkable artifact: exact commit SHA, CI run/job, test fixture/result, reviewed diff, approval record, deployment/version, UAT scenario, backup/restore result, or production smoke evidence. A narrative assertion or a green static test alone is insufficient.

## 12. Change-control rule

Any change to canonical schema, registry identity, importer, monthly aggregation, historical baseline, public disclosure, authentication provider, permission semantics, or operational counting basis requires a separately reviewed contract and regression evidence. No cross-module convenience shortcut may bypass this rule.
