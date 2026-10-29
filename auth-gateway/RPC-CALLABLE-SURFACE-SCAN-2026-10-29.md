# RPC callable-surface scan — partial findings (2026-10-29)

Status: **BLOCKED**. This is a partial scan of 10 existing Apps Script files on `feat/google-auth-gateway-scaffold`; it is not a certification of every `.gs` file in the repository. The gateway auth helpers are currently a verification seam, not proof that existing RPCs use gateway tokens.

## Directly observed facts

- **Correction to earlier wording:** Apps Script functions ending in `_` are private to `google.script.run`. The scan distinguishes these internal helpers from public global RPC entry points; the underscore suffix is an Apps Script convention enforced by the RPC runtime, not a substitute for authorization on public functions.

- `gas/Auth.gs`: `getCurrentIdentity_()` reads `Session.getActiveUser().getEmail()`; `requirePermission_()` and `requireBackOfficeAccess_()` use this legacy identity path.
- `gas/GatewayAuth.gs`: declares `verifyGatewaySession_()`, `requireGatewayPermission_()`, and `requireGatewayBackOfficeAccess_()`. In the reviewed service files below, no evidence was found that the protected public entry points consistently invoke these gateway functions.
- `gas/Code.gs`: the setup function has been renamed from `setupApp()` to `setupApp_()` in commit `e47c2009049a38b4a256b14da15f609ec782d987`, preventing browser RPC invocation while preserving manual execution in the script editor. `doGet(e)` protects the ordinary backoffice and daily page with legacy helpers, while `tv` and `tv-mobile` views intentionally bypass that backoffice check. The intended public TV boundary must remain limited to explicitly public, sanitized read-only RPCs.
- `gas/Code.gs`: `getBootstrap()`, `getDailyBootstrap()`, `listRunningTextsAdmin()`, `saveRunningText()`, `deleteRunningText()`, and `getActiveRunningTexts()` invoke legacy permission helpers rather than the gateway session boundary.
- `gas/DashboardService.gs`: dashboard entry points call `requirePermission_()`; export/drilldown/map/report methods also need individual review to ensure each public entry point is protected before reads/exports and helper calls are not directly exposed.
- `gas/ImportService.gs`: `previewImport` and `commitImport` require specific review; import commit must be authorized before its first write, and helpers must not be treated as public entry points.
- `gas/DailyInputService.gs`: daily storage, policy, draft, submit, review, correction, void/reopen operations need per-function permission and identity propagation review. The storage isolation guard is not a substitute for caller authorization.
- `gas/BackupService.gs`: backup configuration and snapshot operations use legacy permission checks; they must be brought under the gateway session boundary before production activation.
- `gas/OfficeReferenceService.gs`: observed entry points use legacy `requirePermission_()`; coordinate preparation/geocoding and reference mutation are administrative operations and must remain unavailable to anonymous callers.
- `gas/GoogleSubjectMigration.gs`: migration/readiness are admin-only through the legacy helper. This is schema-only and does not enroll a Google subject.

## Function declaration inventory from the partial scan

- `gas/Code.gs`: `doGet`, `setupApp_` (manual setup only; private to browser RPC), `initializeSchema_`, `seedSecurity_`, `seedDictionary_`, `getBootstrap`, `getDailyBootstrap`, running-text sheet helpers, admin running-text methods.
- `gas/Auth.gs`: legacy identity, permission loading, current-user, permission guards, user administration, bootstrap admin.
- `gas/GatewayAuth.gs`: token verification and gateway permission guards.
- `gas/DashboardService.gs`: dashboard, maps, export, drilldown, cross-service report and internal aggregation helpers.
- `gas/ImportService.gs`: parsing/normalization/validation helpers, preview and commit.
- `gas/DailyInputService.gs`: staging storage, policy, validation, office lookup, submission CRUD/review/revision and audit helpers.
- `gas/BackupService.gs`: backup configuration, snapshot creation and verification.
- `gas/PublicTvService.gs`: public TV dashboard/map/running-text/YoY/service-point endpoints and sanitizers.
- `gas/GoogleSubjectMigration.gs`: Google subject column migration and readiness diagnostic.
- `gas/OfficeReferenceService.gs`: office reference setup/status/draft/geocoding/coordinate verification.

## Required next implementation sequence

1. Finish a repository-wide scan of every `.gs` file, including any files not listed above, and classify every global function as protected RPC, explicitly public read-only RPC, or internal-only.
2. Define an explicit browser RPC allowlist; unknown functions fail closed. Public TV functions are separate from authenticated RPCs.
3. Add the token parameter and server-side gateway verification to every protected RPC entry point. Avoid a global monkey patch: Apps Script `google.script.run` dispatches named global functions, so security must be enforced in the actual server entry points.
4. Propagate validated identity to internal service helpers, then apply current role permissions on every request.
5. Treat underscore-suffixed functions as internal for browser-callability analysis, while still checking direct server-side call paths. Verify all write paths reject before the first side effect when token/permission is invalid. Include user management, running texts, office references, imports, backups, and all daily input state transitions.
6. Add end-to-end regression tests and prove canonical monthly registry identity, row counts, and totals remain unchanged.

## Gate

No merge or production authentication activation until the complete inventory, gateway retrofit, owner-provided OAuth and secret configuration, verified subject mappings, and end-to-end negative/positive tests are all evidenced. No canonical monthly dataset change is authorized by this audit.
