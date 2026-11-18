# Authentication Endpoint Inventory — Initial Pass

Status: initial static inventory, not a complete security certification. Reviewed source on `main` for the Google account authentication RFC. Re-run after any endpoint or UI changes.

## Current identity model

- `gas/Auth.gs:getCurrentIdentity_()` uses `Session.getActiveUser().getEmail()`.
- `gas/appsscript.json` currently sets `executeAs=USER_DEPLOYING` and `access=ANYONE_ANONYMOUS`.
- `gas/Code.gs:doGet()` checks authorization for most non-TV page routes, but a page-level check does not protect Apps Script RPC methods.
- TV routes and `gas/PublicTvService.gs` methods are intentionally public-facing and must remain read-only and output-sanitized.
- `gas/Code.gs` currently contains a legacy `password_hash` and `salt` column in USERS. This RFC does not endorse local-password authentication; do not add password login without a separate threat model and password storage review.

## Server entry-point inventory (first pass)

The following public-callable functions need explicit function-level authorization tests. This list is based on the current function declarations and guard calls, not a runtime exploit test.

### Authentication and administration
- `getCurrentUser_`, `getCurrentIdentity_`: identity foundation; currently dependent on Apps Script session email.
- `adminCreateUser`: must require `admin.users`; confirm duplicate-email and normalized identity handling.
- `bootstrapAdmin_`: must remain a setup-only helper, never callable by an untrusted browser. Ensure no public RPC or deployment path can invoke it; consider renaming/private gating and one-time bootstrap controls.

### Page bootstrap and running text
- `getBootstrap`: verify that its guard is applied in the function body for every caller.
- `getDailyBootstrap`: must require `daily.read`.
- `listRunningTextsAdmin`, `saveRunningText`, `deleteRunningText`: admin/config permissions must be enforced in each function.
- `getActiveRunningTexts`: if public, return only explicitly public active content and sanitize output.

### Dashboard, export, import and integrity
- `getDashboardSummary`, `getResidencePermitDashboard`, `getPassportDashboard`, `getResidencePermitDrilldown`, `getPassportDrilldown`, `getResidencePermitMap`, `getPassportMap`, `getCrossServiceReporting`: each protected read must enforce the appropriate read/map permission server-side.
- `exportResidencePermitMonthly`: require `dataset.export`; validate filters and avoid exporting restricted fields.
- `previewImport`, `commitImport`: require `dataset.import`; commit must independently validate and not trust a prior preview.
- `verifyDatasetIntegrityV1`, `verifyResidencePermitMonthlyIntegrity`, `runDashboardRegressionSmokeV1`, `runProductionSmokeTestV1`: verify each function has explicit audit/admin permission and cannot be triggered anonymously.
- `provisionDailyInputStorageV1`: requires `admin.config`; must never be called automatically from a read path.

### Daily-input lifecycle
- `getDailyInputPolicyV1`, `getDailyServiceContractV1`, `listDailyInputOffices`, `listDailySubmissions`: confirm correct read permissions and prevent access to another user's draft unless role/policy allows it.
- `saveDailyDraft`, `submitDailyInput`, `reviewDailySubmission`, `correctDailySubmission`, `voidDailySubmission`, `reopenDailySubmission`: each operation must check the relevant `daily.*` permission inside the server method, enforce record state transitions and actor ownership/role, and write audit entries.
- Every rejected operation must leave both daily staging and canonical monthly data unchanged.

### Public TV exceptions
- `getPublicTvResidenceDashboard`, `getPublicTvPassportDashboard`, `getPublicTvResidenceMap`, `getPublicTvPassportMap`, `getPublicTvRunningTexts`, `getPublicTvAnalyticalRunningTexts`, `getPublicTvPassportYoYContext`, `getPublicTvPassportServiceYoYContext`, `getPublicTvPassportOfficeYoYContext`, `getPublicTvServicePoints`: public only by explicit product decision. Validate that each response is aggregated, read-only, and free of PII, raw source rows, private identifiers, and administrative metadata.

## Required automated checks

1. Parse the source and inventory all globally callable top-level functions; compare with a reviewed allowlist.
2. For every protected endpoint, simulate no identity, unknown user, inactive user, and insufficient permission; assert denial.
3. Invoke protected methods directly (not only through `doGet`) and assert denial.
4. Invoke each public TV endpoint and assert only the approved response schema is returned; scan for emails, passport numbers, names, and raw source fields.
5. Test admin functions, including bootstrap, from browser-callable RPC context; ensure there is no unauthenticated bootstrap path.
6. Test revoked permissions and inactive users on every request; avoid long-lived role claims cached in browser state.
7. Assert that denied requests produce no writes to any spreadsheet and canonical dataset identity, row counts, and totals remain unchanged.
8. Run end-to-end login tests using both personal Gmail and Workspace accounts after the trusted identity gateway exists.

## Current conclusion

The static inventory confirms that the identity/deployment mismatch is real at the configuration level, but it does not prove the behavior of an authenticated Google user. No production authentication change is authorized by this document. Keep protected functions fail-closed and do not deploy an unverified browser-token shortcut.
