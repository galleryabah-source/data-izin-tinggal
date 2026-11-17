# RPC Guard and Browser Call-Site Audit — 2026-11-17

## Basis and limitations

Reviewed the P0 branch `fix/p0-security-gates-2026-11-16` at `182b3a27ea7bb8ece5005909a70dd3cd443219c2`. This is a static source review only. No deployed Apps Script runtime, Script Properties, OAuth/Gateway secrets, authenticated browser session, or live user-role matrix was available. Findings below describe source code, not production runtime verification.

## Confirmed legacy authorization pattern

- `getCurrentIdentity_()` derives identity from `Session.getActiveUser().getEmail()`.
- `getCurrentUser_()` resolves an ACTIVE user row by email and returns role plus permissions from the PERMISSIONS sheet.
- `requirePermission_(permission)` rejects unauthenticated users and users lacking the named permission.
- `requireBackOfficeAccess_()` restricts access to ADMIN and SUPERVISOR.
- This is server-side authorization, but it is still the legacy Apps Script session identity model. It does not yet require a Google Gateway session token.
- `GatewayAuth.gs` is not present in the P0 branch tree. The separate gateway scaffold PR therefore cannot be treated as integrated into this P0 branch.

## Audited endpoint guards

| File / endpoint | Source-level guard | Assessment |
|---|---|---|
| `AuditService.gs:listAuditEventsAdmin` | `audit.read` | Protected by legacy permission check |
| `BackupRecoveryService.gs:getBackupRecoveryCenterV1` | `audit.read` | Protected; reads health center through server helper |
| `BackupRecoveryService.gs:verifyBackupRecoverySnapshotV1` | `audit.read` | Protected; delegates to snapshot verifier |
| `BackupService.gs:setBackupFolder` | `admin.config` | Protected |
| `BackupService.gs:getBackupConfig` | `admin.config` | Protected; returns configured folder ID |
| `BackupService.gs:createResidencePermitSnapshot` | `admin.config` | Protected; writes snapshot to Drive and audit log |
| `BackupService.gs:verifyResidencePermitSnapshot` | `audit.read` | Protected |
| `Code.gs:getBootstrap` | `requireBackOfficeAccess_` | Protected to ADMIN/SUPERVISOR |
| `Code.gs:getDailyBootstrap` | `daily.read` | Protected |
| `Code.gs:listRunningTextsAdmin`, `saveRunningText`, `deleteRunningText` | `admin.config` | Protected |
| `Code.gs:getActiveRunningTexts` | `dashboard.read` | Protected; not anonymous despite similar public-TV data |
| `Auth.gs:adminCreateUser` | `admin.users` | Protected |
| `Rbac.gs:hasPermission`, `getMyPermissions` | `getCurrentUser_()` | No explicit throw guard; unauthenticated callers receive false / empty unauthenticated permissions. Authenticated callers can inspect their own role and permissions. Review information disclosure and browser usage. |
| `DatasetHealthService.gs:getDatasetHealthCenterV1` | `audit.read` | Protected |
| `DatasetIdentityService.gs:verifyDatasetRegistryIntegrityV1` | `audit.read` | Protected |
| `DatasetService.gs:listDatasets` | `dataset.read` | Protected |
| `ImportService.gs:previewImport`, `commitImport` | `dataset.import` | Protected |
| `MpasporQuotaService.gs:getMpasporQuotaDashboard` | `requireBackOfficeAccess_` | Protected to ADMIN/SUPERVISOR |
| `OfficeReferenceService.gs:getOfficeReferenceStatus` | `map.read` | Protected |
| Office reference mutation/setup endpoints | `admin.config` | Protected |
| Passport governance verification endpoints | `audit.read` or `admin.config` | Protected; each endpoint has a distinct permission |
| `PassportGovernanceService.gs:exportPassportServiceMonthly` | `dataset.export` | Protected |
| `PassportGovernanceService.gs:repairPassportServiceMonthly2025DerivedTotal` | `dataset.write` | Protected; sensitive write path, retain separate permission |
| `PassportYearOverYearService.gs:getPassportYearOverYearAnalytics` | `dashboard.read` | Protected |
| `PeriodClosingService.gs:listPeriodClosures` | `audit.read` | Protected |
| `PeriodClosingService.gs:closePeriod`, `reopenPeriod` | `admin.config` | Protected; sensitive period mutation |
| `ProductionEvidenceService.gs:getProductionEvidenceCenterV1` | `audit.read` | Protected |
| `SourceConnectorService.gs:listGoogleSourceSheets`, `previewGoogleSourceImport`, `commitGoogleSourceImport` | `dataset.import` | Protected; commit remains a write/import path |
| `VerificationService.gs` verification and smoke endpoints | `audit.read` | Protected |

The permission values above are source-level observations. They are not a statement that every role is correctly assigned in the live PERMISSIONS sheet.

## Explicit anonymous Public TV surface

`PublicTvService.gs` declares a public read-only adapter. Its header comment states that anonymous viewers may call only these presentation endpoints. Reviewed adapters:
- `getPublicTvResidenceDashboard`
- `getPublicTvPassportDashboard`
- `getPublicTvResidenceMap`
- `getPublicTvPassportMap`
- `getPublicTvRunningTexts`
- `getPublicTvAnalyticalRunningTexts`
- `getPublicTvPassportYoYContext`
- `getPublicTvPassportServiceYoYContext`
- `getPublicTvPassportOfficeYoYContext`
- `getPublicTvServicePoints`

These adapters intentionally omit permission guards and use presentation projections/sanitizers rather than returning raw sheet rows. The dashboard projection includes aggregate totals, monthly aggregates, office aggregates, service aggregates, and available filter values. The map projection includes office label, coordinates, and aggregate values. The analytical running-text endpoint constructs narrative aggregates from cross-service reporting. This is a deliberate public-data contract and needs a separate field-by-field privacy review; no claim is made here that all values are approved for public release.

`MpasporQuotaService.gs:getPublicTvMpasporQuota` is also an anonymous candidate endpoint and is explicitly named for public TV. It returns a static quota snapshot with office and service-point data. It must be included in the same public output review.

## Web entry-point routing

`doGet(e)` is not an ordinary `google.script.run` RPC:
- `view=tv` and `view=tv-mobile` are intentionally served without a back-office login.
- `view=daily` requires `daily.read`.
- Other views require ADMIN/SUPERVISOR, except an authenticated non-back-office user with `daily.read` is routed to the daily interface.
This routing is source-level only; actual deployment access settings and web-app execution identity were not inspected.

## Browser call-site evidence

Static literal calls found:
- `gas/index.html`: eight explicit Passport governance calls: `verifyPassportServiceMonthly`, `verifyPassportServiceMonthly2025`, `repairPassportServiceMonthly2025DerivedTotal`, `createPassportServiceMonthly2025Snapshot`, `verifyPassportServiceMonthly2025Snapshot`, `exportPassportServiceMonthly`, `createPassportServiceSnapshot`, and `verifyPassportServiceSnapshot`.
- `gas/tv.html`: explicit literal calls to `getPublicTvPassportYoYContext`, `getPublicTvPassportServiceYoYContext`, `getPublicTvMpasporQuota`, `getPublicTvPassportOfficeYoYContext`, `getPublicTvServicePoints`, `getPublicTvRunningTexts`, and `getPublicTvAnalyticalRunningTexts`. Other TV calls are routed through dynamic function variables (for example service/map adapters), so literal-call extraction is incomplete.
- `gas/tv-mobile.html`: explicit literal call to `getPublicTvServicePoints`; service calls also use dynamic function variables.
- `gas/index.html` uses a generic `google.script.run` wrapper that dispatches by function name. No `google.accounts`, Google Identity Services initialization, credential handling, `sessionToken`, or gateway token transport marker was found in the inspected HTML source.

Therefore the current browser adapter does not demonstrate a Google Gateway login/token lifecycle. The explicit calls above are not an exhaustive call-site list; dynamic dispatch must be traced manually before changing the adapter.

## Security conclusions and next implementation gate

1. Most inspected administrative, import, audit, backup, verification, and reporting endpoints already enforce legacy server-side permission checks. Do not replace these with client-only checks.
2. Gateway authentication is not integrated into the P0 branch. No endpoint should be described as Gateway-protected until a token is verified server-side and its mapped active user/permission is used for authorization.
3. Public TV endpoints must remain an explicit, narrow anonymous allowlist. They must never inherit protected admin RPC access or expose user/permission/audit/source-row data.
4. Sensitive writes require dedicated permission tests: imports, backup configuration/snapshot creation, running-text mutation, office-reference setup, period close/reopen, and Passport 2025 derived-total repair.
5. The next code change should add a deny-by-default RPC policy/manifest and CI drift detection first. Then migrate a bounded read-only protected endpoint family end-to-end (browser GIS token acquisition → transport → server verification → permission check → expiry/revocation tests) before migrating writes.
6. `getActiveRunningTexts` currently requires `dashboard.read`; do not confuse it with the anonymous `getPublicTvRunningTexts` endpoint.
7. `hasPermission` and `getMyPermissions` should be deliberately classified as authenticated self-service introspection endpoints, not public business-data endpoints.

## Non-impact declaration

This audit changes documentation only. It does not change application logic, Apps Script properties, Google Sheets, OAuth configuration, deployments, or canonical monthly Residence Permit / Passport datasets. Daily Input remains disabled by the P0 code guard; Gate 9.1 remains BLOCKED.
