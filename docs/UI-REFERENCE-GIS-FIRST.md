# UI Reference — GIS First

**Status:** APPROVED REFERENCE  
**Scope:** Desktop web application  
**Product:** Imigrasi24Jam / Data Izin Tinggal  
**Reference concept:** GIS First  
**Date:** 2026-09-30

## 1. Decision

The **GIS First** concept is the approved visual reference for the next UI implementation/design iteration.

The design is a presentation-layer reference only. It does not change the canonical production data contract, dataset isolation, RBAC, audit, import pipeline, deployment gate, or roadmap sequencing.

## 2. Design intent

The map becomes the primary analytical surface, while KPI cards, filters, charts, rankings, and drill-down data orbit the geographic view.

The interface should feel like a professional government geospatial intelligence workspace: dense enough for operational analysis, but structured and readable for daily use.

## 3. Core layout

### Global shell

- Dark navy top header.
- Official immigration identity/logo area.
- Product label: `Imigrasi24Jam | Izin Tinggal`.
- Service selector: `Izin Tinggal`, `Paspor`, `All Services`.
- Global search.
- Period/date selector.
- Notification area.
- Authenticated user / role menu.

### Left navigation

Primary navigation:

1. Dashboard
2. Peta Sebaran
3. Data Izin Tinggal
4. Data Explorer
5. Import Data
6. Laporan & Statistik
7. Monitoring
8. Pengaturan
9. Administrasi

The visible navigation must remain permission-aware. UI visibility is not authorization; server-side RBAC remains authoritative.

### Main analytical area

Order of visual priority:

1. KPI summary
2. GIS map
3. Map/data filters
4. Geographic/service analysis
5. Trend analysis
6. Ranked immigration offices
7. Drill-down data table

## 4. GIS surface

The map is the visual focal point.

Required characteristics:

- Indonesia geographic context.
- Immigration-office markers/clusters.
- Aggregate values by office/region.
- Zoom controls.
- Search for province/office.
- Map layer controls.
- Tooltip/popup with office, address/reference context, row count, and aggregated service total.
- Map results follow the same dashboard filters.
- Read-only presentation in the current baseline.
- Coordinates must come from verified Office Reference data.

The current production map contract must remain based on:

`RESIDENCE_PERMIT_SERVICE_MONTHLY` + verified `OFFICE_REFERENCE`

No individual foreign-national coordinates are implied by this design.

## 5. Filter model

The filter panel should support:

- Periode
- Jenis Layanan
- Status Layanan where applicable to the registered dataset
- Wilayah
- Kanwil
- Kantor Imigrasi

Actions:

- Terapkan Filter
- Reset

Filter state must be visibly reflected across KPI, map, charts, rankings, and drill-down.

## 6. KPI layer

The visual language uses compact KPI cards at the top.

The current residence-permit production dataset is aggregate monthly service activity, so KPI labels must correspond to registered canonical metrics rather than invented individual-record concepts.

Recommended canonical KPI presentation:

- Total Layanan
- Total Periode
- Total Kantor
- Service metric highlights
- Data quality / refresh indicator where available

Future service-specific KPI sets must be derived from their own dataset contract.

## 7. Analytics layer

The reference design uses three analytical blocks:

### Trend

Monthly service trend using the registered `periode` dimension.

### Service distribution

Breakdown of the 13 canonical service metrics:

- BVK
- VOA
- ITK
- ITK Peralihan
- ITAS
- ITAP
- ITKT
- Alih Status ITK → ITAS
- Alih Status ITAS → ITAP
- ABG
- EPO
- IMK
- SKIM

### Geographic comparison

Office/region ranking based on aggregated `total`.

## 8. Drill-down

The bottom data area is a read-only analytical table.

It should support:

- Search
- Pagination
- Sorting
- Filter persistence
- Export according to permission
- Detail action

The table must consume the canonical dataset through the dataset registry rather than hardcoded alternative schemas.

## 9. Multi-service compatibility

The visual shell is designed for the blueprint:

```
ONE APPLICATION
      |
Service Selector
      |
+-----+------------------+
|                        |
Izin Tinggal          Paspor
|                        |
Own contract          Own contract
|                        |
+-----------+------------+
            |
     Query / Analytics
            |
     Dashboard / Map
```

Residence Permit and Passport remain logically isolated dataset families.

A future Passport interface may reuse the shell but must not inherit residence-permit columns merely for visual consistency.

## 10. Visual system

### Primary palette

- Deep navy for application chrome.
- White/light neutral surfaces.
- Blue as primary interaction/accent.
- Green for positive/verified states.
- Amber for warnings.
- Red for errors/critical alerts.
- Purple/secondary accents only for analytical differentiation.

### Typography

- Highly legible sans-serif.
- Strong hierarchy between page title, section title, KPI value, label, and table text.
- Avoid decorative typography.

### Components

- 8–12px corner radius.
- Compact cards.
- Thin borders.
- Restrained shadows.
- Dense but breathable data tables.
- Consistent status badges.
- Clear primary/secondary button hierarchy.

## 11. Desktop target

Primary target:

- 1440px desktop.
- 1600px wide desktop.
- 1920px wide monitor.

The map should remain dominant without requiring horizontal scrolling.

## 12. Data and architecture constraints

This UI reference must not violate the existing architecture:

- One application, multiple governed dataset families.
- Dataset isolation.
- Dataset Registry as the source of dataset routing.
- Canonical Data Contract v1 remains authoritative for current production.
- Server-side RBAC.
- Audit trail.
- Governed CSV export.
- Verified Office Reference for map coordinates.
- Canonical deployment/evidence chain remains unchanged.

## 13. Explicit non-goals

Do not use the UI reference as justification to:

- replace the current production dataset;
- merge residence and passport schemas;
- introduce individual foreign-national records into the monthly service contract;
- add unverified geographic coordinates;
- bypass import validation;
- bypass audit;
- bypass RBAC;
- introduce new production features merely because the mockup contains them.

## 14. Implementation principle

The visual design should be implemented **after preserving the existing canonical production baseline**.

UI work must remain a presentation-layer change unless a separately approved data-contract change is required.

## 15. Source documents

This reference is derived from:

- `docs/ROADMAP.md`
- `docs/MULTI-SERVICE-BLUEPRINT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA-CONTRACT-v1.md`
- `docs/RESIDENCE-PERMIT-GAS-APPLICATION.md`
- `gas/DashboardService.gs`

## 16. Reference concept

Approved concept name:

**GIS First — Peta sebagai pusat, dashboard mengorbit data geografis.**

The generated visual concept used for this decision is the design reference discussed and approved in the project conversation on 2026-09-30.
