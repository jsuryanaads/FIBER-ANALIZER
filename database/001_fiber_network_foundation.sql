-- FIBER-ANALIZER Phase 1
-- Canonical topology: OLT -> PON -> JB -> ODC -> ODP -> Customer
-- PostgreSQL-compatible foundation schema.

create extension if not exists pgcrypto;

create type asset_status as enum ('ACTIVE','INACTIVE','MAINTENANCE','RETIRED');
create type core_status as enum ('AVAILABLE','RESERVED','IN_USE','DAMAGED','RETIRED');
create type cable_status as enum ('PLANNED','ACTIVE','DAMAGED','RETIRED');
create type customer_status as enum ('ACTIVE','SUSPENDED','DISCONNECTED','PROSPECT');
create type node_type as enum ('OLT','JB','ODC','ODP');
create type port_status as enum ('AVAILABLE','USED','RESERVED','FAULTY','RETIRED');

create table locations (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180)
);

create table olts (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  vendor text,
  model text,
  serial_number text,
  management_ip inet,
  location_id uuid references locations(id),
  status asset_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pons (
  id uuid primary key default gen_random_uuid(),
  olt_id uuid not null references olts(id) on delete restrict,
  slot integer not null,
  port integer not null,
  code text not null,
  technology text,
  capacity integer,
  status asset_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  unique (olt_id, slot, port),
  unique (olt_id, code),
  check (slot >= 0),
  check (port >= 0),
  check (capacity is null or capacity > 0)
);

create table jbs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  jb_type text,
  capacity integer,
  location_id uuid references locations(id),
  status asset_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now()
);

create table odcs (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  capacity integer,
  input_ports integer,
  output_ports integer,
  location_id uuid references locations(id),
  status asset_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  check (capacity is null or capacity > 0)
);

create table odps (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  capacity integer,
  port_count integer,
  location_id uuid references locations(id),
  status asset_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  check (capacity is null or capacity > 0),
  check (port_count is null or port_count > 0)
);

create table network_nodes (
  id uuid primary key default gen_random_uuid(),
  node_type node_type not null,
  olt_id uuid unique references olts(id) on delete restrict,
  jb_id uuid unique references jbs(id) on delete restrict,
  odc_id uuid unique references odcs(id) on delete restrict,
  odp_id uuid unique references odps(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (node_type='OLT' and olt_id is not null and jb_id is null and odc_id is null and odp_id is null) or
    (node_type='JB' and olt_id is null and jb_id is not null and odc_id is null and odp_id is null) or
    (node_type='ODC' and olt_id is null and jb_id is null and odc_id is not null and odp_id is null) or
    (node_type='ODP' and olt_id is null and jb_id is null and odc_id is null and odp_id is not null)
  )
);

create table cables (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  cable_type text not null,
  fiber_count integer not null,
  length_m numeric(12,2),
  origin_node_id uuid not null references network_nodes(id),
  destination_node_id uuid not null references network_nodes(id),
  installation_date date,
  status cable_status not null default 'PLANNED',
  condition text,
  route_geometry jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fiber_count > 0),
  check (length_m is null or length_m >= 0),
  check (origin_node_id <> destination_node_id)
);

create table cable_cores (
  id uuid primary key default gen_random_uuid(),
  cable_id uuid not null references cables(id) on delete cascade,
  core_number integer not null,
  color text,
  status core_status not null default 'AVAILABLE',
  attenuation_db_per_km numeric(8,4),
  notes text,
  created_at timestamptz not null default now(),
  unique (cable_id, core_number),
  check (core_number > 0),
  check (attenuation_db_per_km is null or attenuation_db_per_km >= 0)
);

create table ports (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null references network_nodes(id) on delete cascade,
  port_number integer not null,
  port_type text not null,
  status port_status not null default 'AVAILABLE',
  connected_core_id uuid references cable_cores(id),
  notes text,
  unique (node_id, port_number),
  check (port_number > 0)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  customer_code text unique not null,
  name text not null,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  service_status customer_status not null default 'PROSPECT',
  odp_id uuid references odps(id),
  odp_port integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table splices (
  id uuid primary key default gen_random_uuid(),
  closure_node_id uuid not null references network_nodes(id),
  tray text,
  position text,
  input_core_id uuid not null references cable_cores(id),
  output_core_id uuid not null references cable_cores(id),
  estimated_loss_db numeric(8,4),
  measured_loss_db numeric(8,4),
  status asset_status not null default 'ACTIVE',
  notes text,
  created_at timestamptz not null default now(),
  check (input_core_id <> output_core_id),
  check (estimated_loss_db is null or estimated_loss_db >= 0),
  check (measured_loss_db is null or measured_loss_db >= 0)
);

create table service_paths (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  pon_id uuid not null references pons(id),
  path_status asset_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  unique (customer_id)
);

create index idx_cables_origin on cables(origin_node_id);
create index idx_cables_destination on cables(destination_node_id);
create index idx_cores_status on cable_cores(status);
create index idx_ports_status on ports(status);
create index idx_customers_odp on customers(odp_id);
create index idx_splices_input on splices(input_core_id);
create index idx_splices_output on splices(output_core_id);
create index idx_service_paths_pon on service_paths(pon_id);

comment on table network_nodes is 'Normalized node abstraction used by physical cable endpoints. Canonical service topology remains OLT -> PON -> JB -> ODC -> ODP -> Customer.';
comment on table cables is 'Physical fiber cable segment. Cable cores are first-class resources.';
comment on table cable_cores is 'Individual optical fiber cores and their utilization state.';
