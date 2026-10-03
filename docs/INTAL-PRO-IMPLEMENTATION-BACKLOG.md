# INTAL Pro — Implementation Backlog

## Epic A — Foundation
- [ ] Create INTAL Pro application workspace.
- [ ] Define environment matrix: local, staging, production.
- [ ] Add TypeScript, lint, formatting, typecheck and test gates.
- [ ] Define configuration/secret policy.

## Epic B — Domain
- [ ] Port Residence contract.
- [ ] Port Passport contract.
- [ ] Define contract versioning.
- [ ] Define office reference contract.
- [ ] Define audit event taxonomy.
- [ ] Add contract fixtures from certified datasets.

## Epic C — PostgreSQL
- [ ] Create initial migrations.
- [ ] Add canonical dataset tables.
- [ ] Add unique business-key constraints.
- [ ] Add indexes.
- [ ] Add reference/foreign-key constraints.
- [ ] Implement authorization/RLS strategy.
- [ ] Add migration-from-zero CI test.

## Epic D — Import
- [ ] XLSX/CSV parser adapter.
- [ ] Normalize periods.
- [ ] Validate measures.
- [ ] Validate derived totals.
- [ ] Detect duplicate business keys.
- [ ] Preview/rejection UX.
- [ ] Transactional commit.
- [ ] Import evidence/checksum.

## Epic E — Application Services
- [ ] Dashboard API.
- [ ] Data Explorer API.
- [ ] Drilldown API.
- [ ] GIS API.
- [ ] Reporting API.
- [ ] Export API.
- [ ] Authorization middleware.
- [ ] Typed DTOs.

## Epic F — UI
- [ ] Application shell.
- [ ] Executive dashboard.
- [ ] Izin Tinggal workspace.
- [ ] Paspor workspace.
- [ ] Data Explorer.
- [ ] GIS workspace.
- [ ] Import Center.
- [ ] Governance.
- [ ] Monitoring.
- [ ] Administration.
- [ ] Responsive/mobile pass.
- [ ] Accessibility pass.

## Epic G — Verification
- [ ] Unit tests.
- [ ] Integration tests.
- [ ] Database constraint tests.
- [ ] Import parity tests.
- [ ] API contract tests.
- [ ] E2E browser tests.
- [ ] GIS tests.
- [ ] Export reconciliation.
- [ ] Security negative tests.
- [ ] Performance baseline.

## Epic H — Production
- [ ] Staging deployment.
- [ ] UAT.
- [ ] Production shadow.
- [ ] Runtime provenance verification.
- [ ] Controlled cutover.
- [ ] Rollback drill.
- [ ] Post-cutover monitoring.

## Definition of Done

A task is not production-complete until:
1. code is reviewed;
2. relevant tests are green;
3. data/contract impact is documented;
4. audit/provenance impact is understood;
5. deployment evidence is reproducible;
6. no Legacy Production dependency is accidentally introduced.
