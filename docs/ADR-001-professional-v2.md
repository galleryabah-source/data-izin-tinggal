# ADR-001 — Professional V2 Architecture

## Status
Accepted as blueprint.

## Decision
Build Dasmon Imigrasi as a separate professional web application using PostgreSQL/Supabase and typed Next.js. Preserve proven V1 domain contracts and use the current application only as a controlled legacy source/adapter during migration.

## Rationale
This separates domain rules from Apps Script presentation/runtime coupling while preserving business semantics, evidence, and certified datasets.

## Rejected
Directly cloning the Apps Script application and continuing to expand it, because that carries current implementation coupling and runtime limitations into V2.
