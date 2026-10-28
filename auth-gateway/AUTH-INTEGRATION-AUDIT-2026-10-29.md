# Authentication integration audit — 2026-10-29

Status: **BLOCKED — no production authentication claim is made.**

Branch reviewed: `feat/google-auth-gateway-scaffold`.

## Scope scanned

- `gas/Code.gs`
- `gas/Auth.gs`
- `gas/DashboardService.gs`
- `gas/ImportService.gs`
- `gas/PublicTvService.gs`
- `gas/BackupService.gs`
- `gas/DailyInputService.gs`
- `gas/index.html`

This was a source-level inventory, not a live Apps Script runtime test and not a proof that all global functions are safe.

## Confirmed integration gap

The browser currently calls Apps Script through `google.script.run` using `call(fn, ...args)`. The helper has no session-token lifecycle and does not append a token. `GatewayAuth.gs` is a verification seam but is not yet called by protected RPCs. Existing `Auth.gs` identity still depends on `Session.getActiveUser().getEmail()`. Therefore the gateway scaffold is **not end-to-end login** and must not be treated as such.

## Protected RPC families identified

| File | RPCs / family | Existing permission or guard |
|---|---|---|
| `Auth.gs` | `adminCreateUser` | `admin.users` |
| `Code.gs` | `getBootstrap`, `getDailyBootstrap`, running-text administration | back-office / `daily.read` / admin permissions |
| `DashboardService.gs` | dashboards, maps, drilldowns, cross-service reporting, monthly export | `dashboard.read`, `map.read`, `dataset.read`, `dataset.export` |
| `ImportService.gs` | `previewImport`, `commitImport` | `dataset.import` |
| `DailyInputService.gs` | policy/contracts/list, draft, submit, review, correction, void/reopen, provision | `daily.read`, `daily.draft`, `daily.submit`, `daily.review`, `daily.correct`, `daily.void`, `admin.config` |
| `BackupService.gs` | backup config, snapshot create/verify, recovery | includes `admin.config`, `audit.read`; each public entry point still needs explicit token propagation review |
| `PublicTvService.gs` | public TV dashboards/maps/texts/analytics | intentionally public read-only allowlist; retain sanitization and no write access |

## Additional source-review findings

1. The gateway maps stable Google `sub` to `USERS.google_sub`, but the current `USERS` schema does not include that column. Mapping therefore fails closed until an explicit, idempotent schema migration and verified user enrollment are implemented.
2. Existing sheet migration logic must not assume that changing a header constant updates already-created spreadsheets. Migration needs to inspect headers, append only the missing `google_sub` column, preserve existing rows and values, reject duplicate subjects, and be admin-only.
3. `setupApp`, bootstrap helpers, snapshot/backup functions, and other globally declared Apps Script functions need explicit classification as protected RPC, public read-only RPC, or internal-only. A trailing underscore is a naming convention, not an authorization boundary.
4. Public TV functions must remain a small allowlist. Do not make general dashboards, daily input, imports, backups, registry/audit, or administrative methods anonymous as a workaround for Apps Script identity limitations.
5. The existing UI contains import, backup/recovery, audit, registry and daily-input workflows. Each must use one centralized RPC adapter with an explicit in-memory token for protected calls; no bearer token in localStorage/sessionStorage and no shared per-user token in Script Properties/CacheService.
6. The canonical monthly datasets and historical baseline are out of scope for auth integration and must remain unchanged.

## Required next implementation sequence

1. Add a non-destructive, idempotent migration for `USERS.google_sub`, with tests for existing schema, repeated migration, preserved rows, duplicate subject rejection and missing sheet handling.
2. Add a session state and login/logout flow in the browser; login must remain disabled with a clear error until the Google OAuth client ID, origin allowlist and gateway deployment are configured.
3. Update the single RPC adapter to append the token only to classified protected RPCs; explicitly list public TV RPCs.
4. Migrate server-side identity/permission helpers to accept validated identity context, and retrofit every protected RPC—including indirect helpers—without fallback to `Session.getActiveUser()`.
5. Add regressions proving invalid/missing token causes zero writes, permissions are re-evaluated server-side, and existing authorized flows remain functional.
6. Run repository-wide global-function/write-path inventory and end-to-end staging tests; compare canonical registry identity and monthly totals before/after.
7. Only after all gates pass, review the PR and deploy with configured production secrets. CI success alone is not deployment evidence.

## Evidence boundary

This audit does not claim OAuth is configured, the gateway is deployed, Apps Script RPCs are migrated, or production login is fixed. PR validation runs are not production deployment evidence.
