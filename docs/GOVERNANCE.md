# Dasmon Imigrasi — Governance & Production Gates

## Source of truth
One canonical lifecycle and one canonical source of truth per dataset.

## Mandatory gates
1. CI green
2. forensic/static integrity review
3. database migration validation
4. contract tests
5. integration tests
6. E2E regression
7. security review
8. deployment evidence
9. runtime smoke
10. post-deployment verification

## Change classes
Contract changes require versioning and migration evidence. Schema changes require migrations and rollback strategy. UI changes require critical-path E2E/UAT. Data changes require authorization, validation, audit, and provenance.

## Release evidence
release_id, commit_sha, build_id, deployment_id, database_migration, environment, smoke_result, rollback_reference, operator.

## Forbidden
- direct browser → database access
- production writes from unversioned scripts
- hard-coded baseline totals as business logic
- duplicate canonical pipelines
- audit bypass
- deployment declared successful without runtime evidence

## INTAL / Data Izin Tinggal non-interference rule

Dasmon Imigrasi is an isolated platform/workspace evolution and **must not disrupt, mutate, replace, or create a competing path around the existing Data Izin Tinggal production system**.

The currently running Data Izin Tinggal production baseline is treated as a protected dependency:

- Do not modify its canonical datasets, registry identity, historical baseline, monthly grain, importer lifecycle, or production Apps Script deployment as part of Dasmon work.
- Do not reuse or silently migrate the existing Data Izin Tinggal production tables/sheets into Dasmon.
- Do not introduce a second write path into Data Izin Tinggal.
- Do not make Dasmon deployment, database migration, CI failure, or runtime failure capable of blocking the existing Data Izin Tinggal production deployment.
- Dasmon changes must be isolated behind explicit contracts/adapters when interoperability is eventually required.
- Any future integration with Data Izin Tinggal requires a separate reviewed gate covering contract impact, authorization, migration/rollback, provenance, CI, deployment, and runtime verification.
- Until that gate is explicitly approved, the existing Data Izin Tinggal production system remains read-only from the Dasmon perspective.

### Required isolation boundary

```
Data Izin Tinggal Production
        │
        │ protected canonical baseline
        ▼
  Existing GAS pipeline

        ║  NO implicit writes / migrations / replacements
        ║
        ▼
Dasmon Imigrasi
  isolated P0/P2 evolution

Future integration, if approved:
explicit contract → adapter → authorization → evidence → runtime gate
```

**Non-negotiable principle:** Dasmon Imigrasi may evolve independently, but it must never become a reason for the already-working Data Izin Tinggal production system to regress, become unavailable, lose data integrity, or lose deployment provenance.
