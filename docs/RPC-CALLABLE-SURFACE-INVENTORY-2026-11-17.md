# Callable RPC Surface — Static Inventory (2026-11-17)

## Scope and method

Static scan of top-level named function declarations in all 26 production `.gs` files present on `fix/p0-security-gates-2026-11-16` (commit `182b3a27ea7bb8ece5005909a70dd3cd443219c2`). Functions ending in `_` are omitted from the browser-callable candidate list because Apps Script treats underscore-suffixed server functions as private to `google.script.run`. This is a name-based candidate inventory, not proof that every endpoint is safe or correctly guarded.

**Candidate public function declarations: 85.**

**Special entry point:** `doGet(e)` is a web-app entry point, not a normal `google.script.run` RPC.

**Explicit public-TV family:** 10 functions in `PublicTvService.gs`, plus `getPublicTvMpasporQuota` in `MpasporQuotaService.gs`. These are intended public read endpoints and require a data-minimization review.

**Ambiguous exposure:** `getActiveRunningTexts`, `hasPermission`, and `getMyPermissions` require explicit usage and information-disclosure review; do not automatically classify by name alone.

## Candidate callable declarations by file

### `AuditService.gs`

- `listAuditEventsAdmin`

### `Auth.gs`

- `adminCreateUser`

### `BackupRecoveryService.gs`

- `getBackupRecoveryCenterV1`
- `verifyBackupRecoverySnapshotV1`

### `BackupService.gs`

- `setBackupFolder`
- `getBackupConfig`
- `createResidencePermitSnapshot`
- `verifyResidencePermitSnapshot`

### `Code.gs`

- `doGet`
- `getBootstrap`
- `getDailyBootstrap`
- `listRunningTextsAdmin`
- `saveRunningText`
- `deleteRunningText`
- `getActiveRunningTexts`

### `DailyInputService.gs`

- `provisionDailyInputStorageV1`
- `getDailyInputPolicyV1`
- `getDailyServiceContractV1`
- `validateDailyInputPayloadV1`
- `listDailyInputOffices`
- `listDailySubmissions`
- `saveDailyDraft`
- `submitDailyInput`
- `reviewDailySubmission`
- `correctDailySubmission`
- `voidDailySubmission`
- `reopenDailySubmission`

### `DashboardService.gs`

- `getDashboardSummary`
- `getResidencePermitDashboard`
- `getPassportDashboard`
- `getPassportMap`
- `exportResidencePermitMonthly`
- `getResidencePermitDrilldown`
- `getPassportDrilldown`
- `getResidencePermitMap`
- `getCrossServiceReporting`

### `DatasetHealthService.gs`

- `getDatasetHealthCenterV1`

### `DatasetIdentityService.gs`

- `verifyDatasetRegistryIntegrityV1`

### `DatasetService.gs`

- `listDatasets`

### `ImportService.gs`

- `previewImport`
- `commitImport`

### `MpasporQuotaService.gs`

- `getMpasporQuotaDashboard`
- `getPublicTvMpasporQuota`

### `OfficeReferenceService.gs`

- `ensureOfficeReferenceSheet`
- `getOfficeReferenceStatus`
- `seedOfficeReferenceDraft`
- `prepareOfficeReferenceDraftMetadata`
- `previewOfficeReferenceGeocoding`
- `verifyOfficeReferenceCoordinatesV1`

### `PassportGovernanceService.gs`

- `verifyPassportServiceMonthly`
- `verifyPassportServiceMonthly2026Ytd`
- `exportPassportServiceMonthly`
- `verifyPassportServiceExportV1`
- `createPassportServiceSnapshot`
- `verifyPassportServiceSnapshot`
- `verifyPassportServiceMonthly2025`
- `createPassportServiceMonthly2025Snapshot`
- `verifyPassportServiceMonthly2025Snapshot`
- `repairPassportServiceMonthly2025DerivedTotal`
- `verifyPassportYearOverYearForensic`

### `PassportYearOverYearService.gs`

- `getPassportYearOverYearAnalytics`

### `PeriodClosingService.gs`

- `listPeriodClosures`
- `closePeriod`
- `reopenPeriod`

### `ProductionEvidenceService.gs`

- `getProductionEvidenceCenterV1`

### `PublicTvService.gs`

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

### `Rbac.gs`

- `hasPermission`
- `getMyPermissions`

### `SourceConnectorService.gs`

- `listGoogleSourceSheets`
- `previewGoogleSourceImport`
- `commitGoogleSourceImport`

### `VerificationService.gs`

- `verifyDatasetIntegrityV1`
- `verifyResidencePermitMonthlyIntegrity`
- `verifyResidencePermitExportV1`
- `runDashboardRegressionSmokeV1`
- `runProductionSmokeTestV1`

## Required next audit pass

For each candidate above, inspect the complete function body and every helper it invokes, then record: (1) access class (`protected`, `public_read_only`, `editor_only`, or `web_entrypoint`); (2) server-side guard and required permission; (3) data sensitivity and output minimization; (4) browser call sites; (5) whether the Google Gateway session token is required; (6) negative tests for unauthenticated, expired, wrong-role, and revoked-user access.

No blanket token injection or guard replacement is authorized by this inventory alone. The current application uses legacy `Session.getActiveUser()` checks in protected paths; gateway enforcement is not end-to-end. Public TV endpoints must remain intentionally allowlisted and read-only. Any endpoint not explicitly classified and tested must fail closed before a future gateway rollout.

## Release boundary

- This document changes no application code, spreadsheet, Script Property, or deployment.
- PR #248 P0 controls remain intact on the base branch.
- Daily Input remains code-disabled; Gate 9.1 remains BLOCKED.
- Canonical monthly Residence Permit and Passport datasets are out of scope and unchanged.
