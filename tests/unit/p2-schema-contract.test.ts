import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const sql = readFileSync("supabase/schema/p2-foundation.sql", "utf8");

describe("P2 PostgreSQL schema contract", () => {
  it("defines PostGIS and the required domain tables", () => {
    expect(sql).toContain("create extension if not exists postgis;");
    for (const table of [
      "app_roles",
      "app_permissions",
      "app_role_permissions",
      "app_users",
      "offices",
      "dataset_contracts",
      "import_batches",
      "staging_service_rows",
      "residence_permit_service_monthly",
      "passport_service_monthly",
      "audit_events"
    ]) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }
  });

  it("enforces canonical monthly business keys and derived totals", () => {
    expect(sql).toContain("unique (periode, office_id)");
    expect(sql).toContain("generated always as");
    expect(sql).toContain("bvk + voa + itk");
    expect(sql).toContain("biasa_24 + biasa_48 + elektronik_48 + e_polikarbonat");
  });

  it("keeps staging/import provenance and audit evidence", () => {
    expect(sql).toContain("source_import_batch_id uuid references public.import_batches(id)");
    expect(sql).toContain("source_hash text not null");
    expect(sql).toContain("source_manifest jsonb");
    expect(sql).toContain("correlation_id uuid not null");
  });

  it("enables RLS on every application table", () => {
    for (const table of [
      "app_roles","app_permissions","app_role_permissions","app_users",
      "offices","dataset_contracts","import_batches","staging_service_rows",
      "residence_permit_service_monthly","passport_service_monthly","audit_events"
    ]) {
      expect(sql).toContain(`alter table public.${table} enable row level security;`);
    }
  });
});
