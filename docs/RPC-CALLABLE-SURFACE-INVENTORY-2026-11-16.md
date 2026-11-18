# Callable Apps Script RPC Surface Inventory — 2026-11-16

**Baseline:** `main` at `bcafbdf5944cde2ae6b5e1035e7fa81ba4ee7f01`  
**Purpose:** inventory public global Apps Script functions before Google gateway enforcement.  
**Status:** source-level inventory; not a runtime authorization test.

## Classification rules

- A global function whose name does not end in `_` is potentially callable through `google.script.run`.
- An underscore-suffixed helper is private to that RPC surface.
- A direct `requirePermission_` or `requireBackOfficeAccess_` call indicates legacy server-side RBAC, not gateway session validation.
- A function with no direct guard is not automatically unsafe: public TV endpoints and pure validators may be intentionally public. Their exposure must be explicitly allowlisted and reviewed.
- This inventory reflects source on the baseline above. PR #248 proposes privatizing setup/bootstrap helpers; until merged and deployed, main remains unchanged.

## Public functions with legacy server-side RBAC

| File | Callable functions |
|---|---|
| `Auth.gs` | `adminCreateUser` |
| `AuditService.gs` | `listAuditEventsAdmin` |
| `BackupRecoveryService.gs` | `getBackupRecoveryCenterV1`, `verifyBackupRecoverySnapshotV1` |
| `BackupService.gs` | `setBackupFolder`, `getBackupConfig`, `createResidencePermitSnapshot`, `verifyResidencePermitSnapshot` |
| `Code.gs` | `doGet`, `getBootstrap`, `getDailyBootstrap`, `listRunningTextsAdmin`, `saveRunningText`, `deleteRunningText`, `getActiveRunningTexts` |
| `DailyInputService.gs` | `provisionDailyInputStorageV1`, `getDailyInputPolicyV1`, `getDailyServiceContractV1`, `listDailyInputOffices`, `listDailySubmissions`, `saveDailyDraft`, `submitDailyInput`, `reviewDailySubmission`, `correctDailySubmission`, `voidDailySubmission`, `reopenDailySubmission` |
| `DashboardService.gs` | `getDashboardSummary`, `getResidencePermitDashboard`, `getPassportDashboard`, `getPassportMap`, `exportResidencePermitMonthly`, `getResidencePermitDrilldown`, `getPassportDrilldown`, `getResidencePermitMap`, `getCrossServiceReporting` |
| `DatasetHealthService.gs` | `getDatasetHealthCenterV1` |
| `DatasetIdentityService.gs` | `verifyDatasetRegistryIntegrityV1` |
| `DatasetService.gs` | `listDatasets` |
| `ImportService.gs` | `previewImport`, `commitImport` |
| `MpasporQuotaService.gs` | `getMpasporQuotaDashboard` |
| `OfficeReferenceService.gs` | `ensureOfficeReferenceSheet`, `getOfficeReferenceStatus`, `seedOfficeReferenceDraft`, `prepareOfficeReferenceDraftMetadata`, `previewOfficeReferenceGeocoding`, `verifyOfficeReferenceCoordinatesV1` |
| `PassportGovernanceService.gs` | `verifyPassportServiceMonthly`, `verifyPassportServiceMonthly2026Ytd`, `exportPassportServiceMonthly`, `verifyPassportServiceExportV1`, `createPassportServiceSnapshot`, `verifyPassportServiceSnapshot`, `verifyPassportServiceMonthly2025`, `createPassportServiceMonthly2025Snapshot`, `verifyPassportServiceMonthly2025Snapshot`, `repairPassportServiceMonthly2025DerivedTotal`, `verifyPassportYearOverYearForensic` |
| `PassportYearOverYearService.gs` | `getPassportYearOverYearAnalytics` |
| `PeriodClosingService.gs` | `listPeriodClosures`, `closePeriod`, `reopenPeriod` |
| `ProductionEvidenceService.gs` | `getProductionEvidenceCenterV1` |
| `Rbac.gs` | `hasPermission`, `getMyPermissions` |
| `SourceConnectorService.gs` | `listGoogleSourceSheets`, `previewGoogleSourceImport`, `commitGoogleSourceImport` |
| `VerificationService.gs` | `verifyDatasetIntegrityV1`, `verifyResidencePermitMonthlyIntegrity`, `verifyResidencePermitExportV1`, `runDashboardRegressionSmokeV1`, `runProductionSmokeTestV1` |

## Public functions without a direct legacy permission call in the inspected function body

| File | Function | Required treatment |
|---|---|---|
| `Bootstrap.gs` | `bootstrapCurrentUser` | P0: make private/editor-only; proposed as `bootstrapCurrentUser_()` in PR #248 |
| `Code.gs` | `setupApp` | P0: make private/editor-only; proposed as `setupApp_()` in PR #248 |
| `DailyInputService.gs` | `validateDailyInputPayloadV1` | Pure validator; explicitly classify as non-mutating and ensure no identity/data leakage |
| `MpasporQuotaService.gs` | `getPublicTvMpasporQuota` | Public read-only projection; retain only if sanitized and included in public allowlist |

## Intentionally public TV endpoint family

These functions are designed as public read-only presentation endpoints. They must be the only unauthenticated data RPCs after the gateway rollout, together with any separately approved static/pure endpoint.

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
- `getPublicTvMpasporQuota`

The TV allowlist is a design classification, not a substitute for output sanitization and runtime exposure tests.

## Gateway integration requirements

1. Generate the inventory mechanically from every `gas/*.gs` file and fail CI when a new global callable function is added without classification.
2. Add one explicit browser session lifecycle and an allowlisted RPC adapter. Do not persist the session token in localStorage/sessionStorage.
3. Require the gateway session token as an explicit argument for each protected RPC, or route through a single server dispatcher that validates it before dispatch.
4. Validate token signature, issuer, audience, purpose, expiry and server-to-server secret before reading protected data or performing side effects.
5. Resolve `google_sub` to exactly one active user enrollment and confirm email consistency. Derive permissions from the authoritative `PERMISSIONS` sheet on each request.
6. Preserve the public TV allowlist; deny all other unauthenticated RPCs.
7. Test every callable RPC for anonymous, invalid, expired, revoked, inactive, unauthorized and permitted cases; assert denial occurs before any write.
8. Include browser GIS login/logout, personal Gmail and Workspace cases, token expiry, gateway outage and deployment rollback in E2E/UAT.
9. Do not merge or deploy gateway auth as complete until the inventory is exhaustive and the exact PR head passes all automated and runtime acceptance criteria.

## Known limitation

The inventory is based on source function declarations and inspected function bodies. It does not establish Apps Script deployment exposure, actual caller usage in every HTML file, or runtime identity behavior. Those require the callable-surface CI scanner, browser call-site inventory and authenticated Apps Script runtime tests.
