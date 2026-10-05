# Dasmon Imigrasi — Technical Architecture

## Runtime
Browser → Next.js → application services/API → PostgreSQL/PostGIS.

External ingestion: Google Sheets/Drive → import adapter → staging → validation → canonical tables.

## Repository layers
apps/web; packages/domain; packages/ui; supabase/migrations; supabase/functions; adapters/google-sheets; tests/unit; tests/integration; tests/e2e; tests/regression; docs/architecture; docs/contracts; docs/security; docs/operations.

## Database principles
- UUID primary keys for application entities.
- Business keys enforced with unique constraints.
- Foreign keys and check constraints enforced.
- Canonical period representation.
- Staging separated from canonical where useful.
- Append-only audit events for certified actions.
- RLS where Supabase is used.
- Production migrations are immutable.

## API boundary
Typed request/response contracts, boundary validation, stable error codes, correlation ID, authorization before data access, pagination, and no raw database access from browser.

## GIS
Office reference is canonical and governed. Map markers derive from verified office reference + canonical metric. Missing/unverified reference data produces an explicit readiness state.

## Legacy adapter
Apps Script is isolated behind adapter functions. Domain packages do not depend on Apps Script implementation details.
