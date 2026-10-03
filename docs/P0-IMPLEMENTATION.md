# P0 Implementation

P0 establishes a runnable professional application foundation without touching the legacy production runtime.

## Delivered

- npm workspace monorepo scaffold
- Next.js + TypeScript web shell
- `@dasmon/domain` package
- Zod-backed Residence Permit and Passport v1 contracts
- canonical business-key and derived-total functions
- unit tests for contract validation and arithmetic
- ESLint + TypeScript project references
- GitHub Actions quality gate: install → lint → typecheck → test → build

## Gate

P0 is complete only when CI is green on the implementation branch.

The domain package deliberately contains no database or UI dependencies. PostgreSQL/PostGIS integration starts in P2 after P1 contract certification.\n\n## P1 Domain Certification\n\nThe contract registry is now the single application-level registry for the certified v1 Residence Permit and Passport datasets. It exposes the canonical measures, business key, derived total, and Zod row schema from one typed boundary.\n\nP1 remains open until CI proves the registry and contract invariants green.
