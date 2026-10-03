# Dasmon Imigrasi — Acceptance Gates

## Domain
- [ ] Residence contract
- [ ] Passport contract
- [ ] business-key uniqueness
- [ ] derived totals

### P1 Contract Certification

P1 is certifiable only when the registry certification suite proves every registered dataset has a coherent v1 contract, exact legacy column parity, strict schema boundaries, canonical business keys, and derived-total integrity. The certification must be evidenced by a green CI run.\n\n### P2 PostgreSQL Foundation

P2 is certifiable only after the versioned migration is executed against a disposable PostgreSQL/PostGIS database and schema tests prove the required tables, constraints, indexes, derived totals, provenance, audit evidence, and RLS boundaries. The current repository schema contract is not itself evidence of database execution.

## Data
- [ ] source snapshot
- [ ] row parity
- [ ] aggregate parity
- [ ] duplicate parity
- [ ] provenance

## Security
- [ ] authentication
- [ ] RBAC
- [ ] server authorization
- [ ] RLS/database policy
- [ ] audit

## Runtime
- [ ] health
- [ ] readiness
- [ ] deployment identity
- [ ] runtime smoke
- [ ] observability

## UX
- [ ] dashboard
- [ ] data explorer
- [ ] GIS
- [ ] import
- [ ] reports
- [ ] administration
- [ ] responsive behavior

## Production
- [ ] CI green
- [ ] deployment verified
- [ ] migration verified
- [ ] runtime verified
- [ ] rollback path
- [ ] evidence archived
