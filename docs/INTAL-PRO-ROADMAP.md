# INTAL Pro — Roadmap

Status: Proposed
Version: 1.0
Date: 2026-10-03

## Delivery rule

The roadmap is sequential at the gates, parallel within safe workstreams. No feature expansion should bypass an unresolved data-integrity, authorization, migration, or provenance gate.

## Phase 0 — Baseline and freeze

Objective: protect Legacy Production and establish the V2 starting point.

Deliverables:
- Architecture blueprint committed.
- Legacy contract inventory.
- Production evidence inventory.
- Explicit Legacy/V2 boundary.
- V2 repository/branch strategy.
- No destructive changes to Legacy.

Exit gate:
- baseline evidence is captured and reviewed.

## Phase 1 — Domain extraction

Objective: convert proven Legacy rules into implementation-neutral domain specifications.

Deliverables:
- Dataset contracts.
- Business keys.
- Validation rules.
- Derived-field rules.
- Office reference contract.
- Import lifecycle.
- Audit event taxonomy.
- Provenance model.

Exit gate:
- domain tests can run without Apps Script.

## Phase 2 — PostgreSQL foundation

Objective: establish canonical persistence.

Deliverables:
- migration set;
- constraints;
- unique business keys;
- indexes;
- timestamps;
- soft-delete/versioning strategy where required;
- RLS/authorization model;
- seed reference data.

Exit gate:
- clean database can be created from zero using migrations and all schema tests pass.

## Phase 3 — Import Gateway

Objective: replace the Apps Script import seam with a controlled import pipeline.

Flow:

Source -> Upload -> Parse -> Normalize -> Validate -> Preview -> Commit -> Evidence

Deliverables:
- CSV/XLSX import adapter;
- contract detection;
- validation errors;
- duplicate detection;
- transaction boundary;
- import batch identity;
- checksum/provenance;
- audit event.

Exit gate:
- imported canonical dataset reconciles exactly with the certified source.

## Phase 4 — Read API and service layer

Objective: create stable API boundaries for all application reads.

Deliverables:
- dashboard service;
- dataset query service;
- drilldown service;
- GIS service;
- reporting service;
- export service;
- authorization middleware;
- typed DTOs.

Exit gate:
- API integration tests pass and no UI directly accesses database tables.

## Phase 5 — Professional Web UI

Objective: rebuild the frontend without carrying forward the monolithic Apps Script HTML boundary.

Deliverables:
- application shell;
- navigation;
- dashboard;
- Data Explorer;
- GIS Workspace;
- Import Center;
- Governance;
- Monitoring;
- Administration;
- responsive/mobile behavior;
- accessibility baseline.

Exit gate:
- UI functional tests and visual/UAT checks pass.

## Phase 6 — Reporting and GIS

Objective: establish analytics above canonical data.

Deliverables:
- cross-service reporting;
- period/office/service filters;
- map metrics;
- office reference management;
- GeoJSON/API response;
- export reconciliation.

Exit gate:
- all reports and maps reconcile to canonical totals.

## Phase 7 — Security and observability hardening

Objective: production-grade security and operational visibility.

Deliverables:
- RBAC matrix;
- RLS tests;
- authorization negative tests;
- audit trail;
- structured logs;
- error monitoring;
- rate limiting where appropriate;
- secret management;
- backup/restore procedure;
- deployment provenance.

Exit gate:
- security regression suite and recovery drill pass.

## Phase 8 — Data parity and migration

Objective: prove V2 represents the same certified data semantics.

Migration sequence:

Legacy source
-> immutable extraction
-> checksum
-> staging
-> normalization
-> validation
-> canonical load
-> integrity verification
-> parity report

Minimum parity dimensions:
- dataset identity;
- row count;
- periods;
- offices;
- every measure;
- derived totals;
- aggregate totals;
- duplicate business keys;
- null/invalid values.

Exit gate:
- zero unexplained parity differences.

## Phase 9 — Staging/UAT

Objective: validate the complete production candidate.

Gates:
1. CI green.
2. Migration reproducibility.
3. Regression suite green.
4. API integration green.
5. Browser/E2E green.
6. GIS verification.
7. Export verification.
8. Security verification.
9. Performance verification.
10. UAT sign-off.

## Phase 10 — Production certification

Objective: introduce V2 without destabilizing Legacy.

Recommended rollout:
- deploy V2 beside Legacy;
- read-only production shadow/parity period;
- compare key outputs;
- controlled operator pilot;
- limited production write path if required;
- rollback readiness;
- final certification.

Exit gate:
- production provenance and runtime evidence match the released commit/artifact.

## Phase 11 — Legacy retirement decision

Only after sustained V2 stability.

Possible outcomes:
- Legacy retired;
- Legacy retained as import adapter;
- Legacy retained as emergency read-only fallback.

This is a separate governance decision, not an automatic consequence of V2 deployment.
