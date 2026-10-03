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

The domain package deliberately contains no database or UI dependencies. PostgreSQL/PostGIS integration starts in P2 after P1 contract extraction and certification.

## Verification note
The workflow uses `npm ci` once a committed lockfile is present. CI evidence must be green before P0 is certified.
