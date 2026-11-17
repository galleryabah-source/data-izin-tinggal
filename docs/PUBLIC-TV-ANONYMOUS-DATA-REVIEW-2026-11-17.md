# Public TV Anonymous Data Review — INTAL

Date: 2026-11-17
Status: static source review; not a legal/privacy approval and not production certification.

## Scope
Reviewed the anonymous presentation adapters in PublicTvService.gs and getPublicTvMpasporQuota in MpasporQuotaService.gs. The review is based on returned object construction and source-level sanitizers, not a live HTTP response capture.

## Endpoint inventory and output boundary

| Endpoint | Output projection | Review note |
|---|---|---|
| getPublicTvResidenceDashboard | dataset key, aggregate totals, monthly totals, office aggregates, service totals, filter choices | Aggregated operational data; confirm publication authorization and filter bounds. |
| getPublicTvPassportDashboard | Same aggregate dashboard projection | Aggregated operational data; confirm publication authorization. |
| getPublicTvResidenceMap | dataset key, aggregate counts, office marker coordinates and totals | Coordinates and office-level volumes are exposed; verify they are approved public reference data. |
| getPublicTvPassportMap | Same aggregate map projection | Same review requirement. |
| getPublicTvRunningTexts | Active running-text content | Content is editor-controlled; require moderation and prohibit personal/sensitive information in published text. |
| getPublicTvAnalyticalRunningTexts | Cross-service monthly and office aggregates, rankings and narrative text | No raw rows or identities in the adapter; verify every source field remains aggregate-only. |
| getPublicTvPassportYoYContext | Monthly and office aggregates for 2025/2026 | Historical office-level statistics are disclosed; publication approval required. |
| getPublicTvPassportServiceYoYContext | 2026 service category totals; 2025 comparison explicitly NOT_COMPARABLE | Preserve null comparison fields; do not imply a valid historical mapping. |
| getPublicTvPassportOfficeYoYContext | One office's monthly and total year-over-year aggregates | Office is caller-selectable; still aggregate, but publication scope must be approved. |
| getPublicTvServicePoints | Static office/service-point name, address, coordinates, capacity, booth count, hours, status and map URL | Contains operational capacity and location metadata; source and publication authorization need confirmation. Several coordinates are pending/null and must not be presented as verified. |
| getPublicTvMpasporQuota | Period totals, office quotas and location quota aggregates; markers include office address, coordinates and source URL | Public disclosure of quota/capacity by office and service location. Validate source document rights, period freshness, source URL exposure, and coordinate verification. |

## Static safety observations

- PublicTvService dashboard and map methods use explicit projection functions; the projected shape omits raw sheet rows, user identities and permission records.
- Public TV methods are anonymous by design and do not call requirePermission_. They must remain a finite allowlist of read-only presentation adapters.
- getPublicTvMpasporQuota constructs an aggregate projection, but it reads OFFICE_REFERENCE and returns address, coordinates and source_url for verified office markers. This is not a raw row dump, but it is a distinct disclosure surface and needs explicit publication approval.
- getPublicTvServicePoints is a static data endpoint. It includes dailyCapacity, boothCount, service status and detailed locations. Coordinate statuses explicitly distinguish verified locations, reference points and pending coordinates. The UI must preserve those distinctions.
- Running text is free-form content and therefore needs an editorial policy even though the service only returns active rows.
- No endpoint in this review is shown to mutate data. This conclusion is from static function bodies only.

## Required controls before public certification

1. Obtain data-owner approval for publication of office-level monthly volumes, year-over-year aggregates, quota allocations, service-point capacities, addresses, coordinates and operating schedules.
2. Confirm source-document publication rights and a refresh/expiry process for the October 2026 M-Paspor quota snapshot.
3. Add an allowlist regression test that checks exact output keys for each anonymous endpoint and rejects user, email, passport, application, raw-row, and permission fields.
4. Add tests for null/pending coordinates and prevent them from being treated as verified GIS pins.
5. Add a running-text moderation rule and audit trail for published content.
6. Test public endpoints for no writes and for bounded response sizes; do not allow arbitrary filters to expand the result beyond approved reporting scope.
7. Review whether anonymous access should be rate-limited and cached at the presentation boundary.

## Decision
Keep the current anonymous endpoints explicitly classified as public_read_only in the RPC manifest, but do not mark the public surface certified. This review does not authorize new public fields, new endpoints, or production deployment. Gateway authentication does not apply as a substitute for the publication decision: public endpoints need a separate anonymous publication allowlist, while protected endpoints require authentication and RBAC.
