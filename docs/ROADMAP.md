# Dasmon Imigrasi — Delivery Roadmap

## Phase 0 — Foundation
Blueprint, ADRs, repository structure, CI skeleton, environment contract, security baseline.

## Phase 1 — Domain Extraction
Residence/Passport contracts, business keys, validation, registry, provenance. Gate: contract tests green.

## Phase 2 — PostgreSQL Foundation
Users/roles/permissions, dataset contracts, registry, offices, staging/import, canonical service tables, audit/evidence, indexes/constraints. Gate: migrations + schema tests green.

## Phase 3 — Import Gateway
Sheets adapter, CSV/XLSX ingestion, preview, validation, duplicates, idempotency, commit, audit. Gate: migration dry-run green.

## Phase 4 — Professional Web Shell
Next.js, auth, navigation, design system, responsive layout, error/loading/empty states. Gate: authenticated staging shell.

## Phase 5 — Dashboard
Residence, Passport, KPI, trends, office analysis, service breakdown, provenance. Gate: certified V1 parity.

## Phase 6 — Data Explorer
Server-side filtering, pagination, sorting, column controls, detail drawer, export, saved views. Gate: functional + performance UAT.

## Phase 7 — GIS Workspace
Office registry, verified coordinates, map, metric selector, filters, marker detail, map/table synchronization. Gate: map parity + reference readiness.

## Phase 8 — Reporting
Cross-service adapter, monthly/office reports, export, provenance. Gate: report totals equal canonical aggregates.

## Phase 9 — Governance & Monitoring
RBAC, RLS, audit explorer, import monitoring, health/readiness, release evidence, backup verification. Gate: security/observability review.

## Phase 10 — Migration Certification
Snapshot, row/aggregate/business-key/schema/UI parity, regression, UAT. Gate: no unresolved parity defect.

## Phase 11 — Production Cutover
Production environment, final backup, migration/deployment evidence, runtime smoke, rollback rehearsal, handover. Gate: explicit production certification.

## Rule
A phase is complete only when its acceptance gate has observable evidence.
