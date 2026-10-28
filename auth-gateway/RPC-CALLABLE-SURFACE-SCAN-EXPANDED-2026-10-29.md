# Callable Apps Script surface scan — expanded inventory (2026-10-29)

Status: BLOCKED. This is an expanded scan of primary application/service files, not certification of every .gs file or every side effect. Apps Script functions whose names end in an underscore are private to google.script.run; do not count them as browser-callable RPCs. Public global functions without the suffix remain callable by name and still require authorization.

## High-priority findings
1. GatewayAuth.gs provides explicit-token verification helpers, but they are not yet the common authorization boundary for all protected RPCs.
2. Auth.gs retains the legacy Session.getActiveUser().getEmail() identity path.
3. Protected services currently call requirePermission_() / requireBackOfficeAccess_(), not the gateway token verifier.
4. Code.gs originally exposed setupApp() with schema/security seeding side effects. It has now been renamed setupApp_() so it is not callable through google.script.run; it remains manually runnable by an authorized script editor. This narrow change does not secure other protected RPCs.
5. Internal helpers ending in an underscore are private to google.script.run. Public global methods still need server-side authorization; browser dispatch should also use explicit allowlists as defense in depth.
6. PublicTvService.gs has no permission-guard calls in the scanned file. That is expected only for intended public TV methods; each response still needs sanitization and tests proving no sensitive fields leak.
7. Code.gs protects ordinary page routing with legacy guards. Public tv/tv-mobile views are intentional exceptions; public page rendering does not authorize protected RPCs.

## Enumerated global declarations

### gas/Code.gs
doGet, setupApp_ (manual editor setup; private to google.script.run), initializeSchema_, seedSecurity_, seedDictionary_, getBootstrap, getDailyBootstrap, ensureRunningTextSheet_, getRunningTextSheet_, normalizeRunningTextRow_, listRunningTextsAdmin, saveRunningText, deleteRunningText, getActiveRunningTexts, getActiveRunningTexts_.

### gas/Auth.gs
getCurrentIdentity_, ensureDailyPermissionMigration_, getRolePermissions_, getCurrentUser_, requirePermission_, requireBackOfficeAccess_, adminCreateUser, bootstrapAdmin_.

### gas/GatewayAuth.gs
verifyGatewaySession_, requireGatewayPermission_, requireGatewayBackOfficeAccess_.

### gas/DashboardService.gs
getDashboardSummary, getResidencePermitDashboard, getResidencePermitDashboard_, getPassportDashboard, getServiceDashboard_, getPassportMap, getServiceMap_, csvEscape_, exportResidencePermitMonthly, getResidencePermitDrilldown, getPassportDrilldown, getServiceDrilldown_, getResidencePermitMap, getCrossServiceReporting, getCrossServiceReporting_, buildCrossServiceReport_, indexCrossServiceRows_, uniqueSortedKeys_, crossServiceRow_.

### gas/ImportService.gs
parseDelimited_, parseDelimitedLine_, normalizePeriod_, normalizePeriodCell_, normalizeInteger_, validateRows_, previewImport, commitImport.

### gas/DailyInputService.gs
dailyConfig_, dailyStagingId_, dailyStagingReadinessV1_, provisionDailyInputStorageV1, dailyStagingReady_, getDailyStagingDb_, dailyAppendAudit_, getDailyInputPolicyV1, assertDailyInputEnabled_, getDailyServiceContractV1, dailyMeasureLabelV1_, validateDailyInputPayloadV1, ensureDailyInputSheet_, dailyHeaderIndex_, dailyRows_, dailyOffice_, listDailyInputOffices, dailyPayloadHash_, dailyRowArray_, dailyLogicalKey_, dailyLatestLogical_, dailyFindByRecord_, dailyPublicRecord_, listDailySubmissions, dailyValidateDraft_, assertDailyOperationalDate_, saveDailyDraft, submitDailyInput, reviewDailySubmission, correctDailySubmission, voidDailySubmission, reopenDailySubmission.

### gas/BackupService.gs
backupConfig_, normalizeDriveFolderId_, setBackupFolder, getBackupConfig, csvEscapeBackup_, sha256Hex_, createResidencePermitSnapshot, verifyResidencePermitSnapshot.

### gas/PublicTvService.gs
getPublicTvResidenceDashboard, getPublicTvPassportDashboard, getPublicTvResidenceMap, getPublicTvPassportMap, getPublicTvRunningTexts, sanitizePublicTvFilters_, sanitizePublicTvDashboard_, sanitizePublicTvMap_, getPublicTvAnalyticalRunningTexts, getPublicTvPassportYoYContext, getPublicTvPassportServiceYoYContext, getPublicTvPassportOfficeYoYContext, getPublicTvServicePoints.

### gas/GoogleSubjectMigration.gs
migrateGoogleSubjectColumnV1, getGoogleSubjectMappingReadinessV1.

### gas/OfficeReferenceService.gs
ensureOfficeReferenceSheet, getOfficeReferenceStatus, getOfficeReferenceStatus_, seedOfficeReferenceDraft, prepareOfficeReferenceDraftMetadata, previewOfficeReferenceGeocoding, verifyOfficeReferenceCoordinatesV1.

## Browser call surface observed
- gas/index.html defines generic call(fn,...args) dispatching google.script.run[fn](...args); it does not add a session token automatically.
- gas/tv.html and gas/tv-mobile.html also define generic name-based RPC wrappers for public display data.
- Secure retrofit: replace generic back-office dispatch with a strict allowlist of protected RPCs and a separate strict allowlist of public TV RPCs. Do not require a session for public TV calls, and do not let TV clients call protected methods.

## Remediation priority
1. P0: enumerate every global function across every .gs file, identify direct writes/external effects, classify each as protected RPC, explicitly public read-only RPC, or internal helper; check call sites in all HTML files.
2. P0: setupApp_ is now private to google.script.run; separately review all public setup/admin entry points and eliminate legacy identity fallback for protected endpoints. bootstrapAdmin_ already ends in underscore and is not browser-callable through google.script.run.
3. P0: pass session token explicitly into every protected entry point; verify server-side before reads/writes; map active user by unique google_sub; check live server-side permissions; pass validated identity to helpers.
4. P1: keep only approved public TV endpoints; test output sanitization and ensure no user, audit, registry, backup, or staging data leaks.
5. P1: test invalid/missing/expired token, gateway outage, unknown/inactive/duplicate subject, permission revocation, zero-write rejection, and authorized role-specific flows.
6. P1: compare canonical registry identity, row counts, and totals before/after tests. Do not alter canonical monthly data; daily data stays in separate staging.

## Gate decision
No merge or production rollout as a completed authentication fix until the inventory is exhaustive, all protected entry points use the gateway, public TV allowlists are tested, and end-to-end evidence passes. This document records findings only; it does not assert runtime security.