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
