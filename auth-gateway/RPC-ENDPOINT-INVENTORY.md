# Protected RPC integration inventory — working gate

Status: **BLOCKED — inventory is a reviewed subset, not a complete repository-wide enumeration.**
Branch: `feat/google-auth-gateway-scaffold`
Scope: Apps Script callable functions and browser RPC integration. This document does not authorize merge or production deployment.

## Security boundary

The current browser helper invokes `google.script.run[fn](...args)` without a gateway session token. The legacy server identity helper relies on `Session.getActiveUser().getEmail()`, which is not a dependable authentication boundary for an anonymously accessible Apps Script web app. Therefore, passing the gateway's tests does not mean the Apps Script RPC surface is protected.

Required implementation pattern:
1. A single browser RPC adapter classifies callable methods explicitly; unknown methods fail closed.
2. For protected calls, the adapter appends an in-memory session token as a dedicated final argument. Do not put tokens in localStorage, sessionStorage, URLs, or logs.
3. Each protected server entry point validates the token through the server-side gateway boundary before any read or write.
4. The server maps the validated Google subject to exactly one active user row, verifies the stored email mapping, then evaluates current server-side permissions.
5. Internal service helpers must not be exposed as public RPC entry points. Public TV methods are an explicit, allowlisted exception and return sanitized read-only data.
6. Authentication/authorization failure must occur before any side effect. Avoid accepting a browser-provided identity or role object.

## Known protected entry points reviewed

| File | RPC / function family | Required permission / policy |
|---|---|---|
| `gas/Auth.gs` | `getCurrentUser_`, `adminCreateUser`, `bootstrapAdmin_` | User/admin operations must not trust legacy anonymous identity; bootstrap remains tightly controlled and unavailable to normal anonymous callers. |
| `gas/DashboardService.gs` | `getDashboardSummary`, `getResidencePermitDashboard`, service dashboards/maps, cross-service reporting | `dashboard.read`, `map.read`, or `cross_service_reporting` as applicable; private helpers stay internal. |
| `gas/ImportService.gs` | `previewImport`, `commitImport` | `dataset.import`; authorization must precede any commit/write. |
| `gas/BackupService.gs` | backup configuration and snapshot/export methods | `admin.config` / dataset export permission as defined by each operation; no anonymous access. |
| `gas/DailyInputService.gs` | policy/contract/list/read, draft, submit, review, correct, void/reopen, provision storage | Specific `daily.*` or `admin.config` permission for every operation. Daily records remain in separate staging storage. |
| `gas/GoogleSubjectMigration.gs` | `migrateGoogleSubjectColumnV1`, readiness diagnostic | Admin-only, schema-only; never auto-enroll identities. |
| `gas/PublicTvService.gs` | `getPublicTvResidenceDashboard`, `getPublicTvPassportDashboard`, public map endpoints, public running-text endpoints | Explicit public read-only allowlist only; sanitize all output and do not accept elevated identity. |

This list is deliberately labelled a subset. It does not certify that every global function in every `.gs` file has been classified.

## Required full repository scan before closing the gate

- Enumerate all global function declarations in every `.gs` file.
- For each declaration, record: browser-callable/internal, read/write side effects, required permission, whether token verification occurs before the first side effect, and test reference.
- Trace wrappers into helpers so a protected wrapper cannot call a privileged helper with missing identity context.
- Inspect `doGet`, `doPost`, installable triggers, menu callbacks, and any alternate entry points.
- Test anonymous and malformed-token requests against every protected operation, asserting zero writes.
- Test all public TV operations for absence of user, permission, raw-row, backup, or administrative data.
- Run the existing canonical dataset integrity checks before/after auth regression tests; monthly dataset rows, totals, and registry identity must remain unchanged.

## Current external configuration blockers

- Google OAuth Web Client ID has not been confirmed.
- Gateway deployment and allowed HTTPS origins have not been confirmed.
- Production signing secret and Apps Script-to-gateway shared secret must be provisioned securely.
- Active `USERS` rows require verified Google subject mapping. Do not infer or automatically assign a subject from email alone.

## Gate decision

Keep PR #246 open and unmerged until the full endpoint inventory, RPC bridge, server-side verification, subject mapping, end-to-end regression evidence, and owner-provided production configuration are complete. A passing gateway unit test or Apps Script validation workflow is necessary but not sufficient.
