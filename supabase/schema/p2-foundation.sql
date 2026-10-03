-- Dasmon Imigrasi P2 PostgreSQL foundation schema contract.
-- Execution must be promoted through a versioned Supabase migration.
create extension if not exists postgis;

create table if not exists public.app_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_role_permissions (
  role_id uuid not null references public.app_roles(id) on delete cascade,
  permission_id uuid not null references public.app_permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.app_users (
  id uuid primary key,
  email text not null unique,
  role_id uuid not null references public.app_roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null unique,
  latitude double precision,
  longitude double precision,
  location geography(point, 4326),
  coordinate_status text not null default 'UNVERIFIED'
    check (coordinate_status in ('UNVERIFIED','VERIFIED','REJECTED')),
  source text,
  source_hash text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (latitude is null and longitude is null and location is null)
    or
    (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create index if not exists offices_location_gix on public.offices using gist (location);

create table if not exists public.dataset_contracts (
  id uuid primary key default gen_random_uuid(),
  dataset_key text not null unique,
  version integer not null check (version > 0),
  business_key text[] not null,
  columns text[] not null,
  required_columns text[] not null,
  optional_columns text[] not null,
  measures text[] not null,
  derived_total_column text not null,
  schema_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (cardinality(business_key) > 0),
  check (derived_total_column <> all(measures))
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  dataset_contract_id uuid not null references public.dataset_contracts(id),
  source_type text not null check (source_type in ('GOOGLE_SHEETS','CSV','XLSX','API')),
  source_uri text,
  source_hash text not null,
  source_manifest jsonb not null default '{}'::jsonb,
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','VALIDATING','STAGED','VERIFIED','PROMOTED','REJECTED')),
  row_count integer not null default 0 check (row_count >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  created_by uuid references public.app_users(id),
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  promoted_at timestamptz
);

create index if not exists import_batches_dataset_status_idx
  on public.import_batches(dataset_contract_id, status, created_at desc);

create table if not exists public.staging_service_rows (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  periode date not null,
  kantor_imigrasi text not null,
  payload jsonb not null,
  validation_status text not null default 'PENDING'
    check (validation_status in ('PENDING','VALID','INVALID')),
  validation_errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (import_batch_id, row_number)
);

create index if not exists staging_service_rows_batch_key_idx
  on public.staging_service_rows(import_batch_id, periode, kantor_imigrasi);

create table if not exists public.residence_permit_service_monthly (
  id uuid primary key default gen_random_uuid(),
  periode date not null,
  office_id uuid not null references public.offices(id),
  bvk bigint not null check (bvk >= 0),
  voa bigint not null check (voa >= 0),
  itk bigint not null check (itk >= 0),
  itk_peralihan bigint not null check (itk_peralihan >= 0),
  itas bigint not null check (itas >= 0),
  itap bigint not null check (itap >= 0),
  itkt bigint not null check (itkt >= 0),
  alih_status_itk_ke_itas bigint not null check (alih_status_itk_ke_itas >= 0),
  alih_status_itas_ke_itap bigint not null check (alih_status_itas_ke_itap >= 0),
  abg bigint not null check (abg >= 0),
  epo bigint not null check (epo >= 0),
  imk bigint not null check (imk >= 0),
  skim bigint not null check (skim >= 0),
  total bigint generated always as (
    bvk + voa + itk + itk_peralihan + itas + itap + itkt
    + alih_status_itk_ke_itas + alih_status_itas_ke_itap
    + abg + epo + imk + skim
  ) stored,
  source_import_batch_id uuid references public.import_batches(id),
  created_at timestamptz not null default now(),
  unique (periode, office_id)
);

create index if not exists residence_monthly_office_period_idx
  on public.residence_permit_service_monthly(office_id, periode);

create table if not exists public.passport_service_monthly (
  id uuid primary key default gen_random_uuid(),
  periode date not null,
  office_id uuid not null references public.offices(id),
  biasa_24 bigint not null check (biasa_24 >= 0),
  biasa_48 bigint not null check (biasa_48 >= 0),
  elektronik_48 bigint not null check (elektronik_48 >= 0),
  e_polikarbonat bigint not null check (e_polikarbonat >= 0),
  total bigint generated always as (
    biasa_24 + biasa_48 + elektronik_48 + e_polikarbonat
  ) stored,
  source_import_batch_id uuid references public.import_batches(id),
  created_at timestamptz not null default now(),
  unique (periode, office_id)
);

create index if not exists passport_monthly_office_period_idx
  on public.passport_service_monthly(office_id, periode);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.app_users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  correlation_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_entity_idx
  on public.audit_events(entity_type, entity_id, created_at desc);

create index if not exists audit_events_correlation_idx
  on public.audit_events(correlation_id);

-- Supabase exposure is intentionally explicit. RLS is enabled before any
-- future authenticated grants/policies are introduced.
alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.app_role_permissions enable row level security;
alter table public.app_users enable row level security;
alter table public.offices enable row level security;
alter table public.dataset_contracts enable row level security;
alter table public.import_batches enable row level security;
alter table public.staging_service_rows enable row level security;
alter table public.residence_permit_service_monthly enable row level security;
alter table public.passport_service_monthly enable row level security;
alter table public.audit_events enable row level security;
