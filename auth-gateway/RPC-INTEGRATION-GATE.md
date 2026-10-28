# Protected Apps Script RPC integration gate

Status: **BLOCKED — gateway scaffold is not end-to-end authentication**.

## Non-negotiable design

1. Every protected Apps Script RPC receives an explicit session token argument from the browser. Do not use a mutable global, cache, or Script Properties value as a per-user session.
2. Validate the token server-side before authorization. Use a configured gateway URL and server-to-server shared secret; fail closed on timeout, non-200 response, malformed JSON, missing identity, or expiry.
3. Resolve the verified Google `sub` to exactly one active row in `USERS`. Reject missing, disabled, duplicate, or ambiguous mappings. Do not authorize by email alone.
4. Resolve permissions from the authoritative `PERMISSIONS` sheet on the server for each protected request. Never trust browser-provided role/permissions or session claims as authorization.
5. Existing helper functions must receive the already-validated identity explicitly when they are called from protected RPCs; they must not silently fall back to `Session.getActiveUser()`.
6. Public TV RPCs remain a separate explicit allowlist. Do not expose administrative, daily-input, import, audit, backup, registry, or canonical dataset operations through public TV methods.
7. An auth failure must happen before any database/sheet mutation. Daily input remains in isolated staging; the canonical monthly datasets and historical baseline must not change.

## Current protected RPC inventory

### `gas/Auth.gs`
- `adminCreateUser` — `admin.users`
- `getCurrentUser_`, `requirePermission_`, `requireBackOfficeAccess_` — authorization helpers requiring an explicit validated identity seam.

### `gas/Code.gs`
- `getBootstrap` — back-office access
- `getDailyBootstrap` — `daily.read`
- `listRunningTextsAdmin`, `saveRunningText`, `deleteRunningText` — administrative permissions
- `setupApp` — setup-only; must not be exposed as a generally callable browser RPC without a dedicated administrative authorization gate.

### `gas/DashboardService.gs`
- `getDashboardSummary`, `getResidencePermitDashboard`, `getPassportDashboard`, `getCrossServiceReporting` — `dashboard.read`
- `getPassportMap`, `getResidencePermitMap` — `map.read`
- `exportResidencePermitMonthly` — `dataset.export`
- `getResidencePermitDrilldown`, `getPassportDrilldown` — `dataset.read` via helper; identity must be propagated to the helper.

### `gas/ImportService.gs`
- `previewImport`, `commitImport` — `dataset.import`. Commit must reject before any write if auth fails.

### `gas/DailyInputService.gs`
- `provisionDailyInputStorageV1` — `admin.config`
- `getDailyInputPolicyV1`, `getDailyServiceContractV1`, `listDailyInputOffices`, `listDailySubmissions` — `daily.read`
- `saveDailyDraft` — `daily.draft`
- `submitDailyInput` — `daily.submit`
- `reviewDailySubmission` — `daily.review`
- `correctDailySubmission` — `daily.correct`
- `voidDailySubmission`, `reopenDailySubmission` — `daily.void`

This list is the known inventory from the current code review, not a substitute for a repository-wide scan of every globally callable Apps Script function. Before marking the gate complete, scan all `.gs` files for global function declarations and direct write operations, then classify every function as protected, explicitly public/read-only, or internal-only.

## Browser integration

The current `google.script.run` helper does not automatically forward gateway cookies or bearer tokens. The browser needs an explicit in-memory session lifecycle and a single RPC adapter that appends the token to protected RPC calls. Do not persist bearer tokens in localStorage/sessionStorage. Login must be disabled with a clear configuration error until the Google OAuth client ID and gateway deployment configuration are available.

The Apps Script server must not rely on a browser-supplied identity object. Only a token validated by the server-side verification boundary can establish the identity.

## Required regression evidence

- Missing token, malformed token, wrong signature, wrong issuer/audience/purpose, expired token, gateway timeout, invalid gateway key, and unconfigured gateway all fail closed.
- Unknown, inactive, duplicate, and unauthorized `USERS` mappings are rejected.
- Permission revocation takes effect on the next request.
- Anonymous/invalid requests cannot read protected dashboard, drilldown, registry, audit, backup, import, or daily-input data.
- Anonymous/invalid requests cannot provision storage, save drafts, submit, review, correct, void/reopen records, import/commit, or administer users/running texts.
- Allowed public TV RPCs return only sanitized public data and never accept an elevated identity.
- Existing authorized flows still pass.
- Canonical monthly totals and registry identity are unchanged before and after the test suite; authentication failures result in zero writes.

## Merge/deployment gate

Do not merge this scaffold as a completed authentication fix and do not deploy it as production login until the RPC bridge, full endpoint inventory, test evidence, OAuth configuration, and end-to-end verification are complete.