-- FIBER-ANALYZER 2.1.0
-- ODC/ODP splitter stages, normalized splitter input sources, and mid-cable taps.
create table if not exists public.network_cable_taps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cable_id uuid not null references public.network_cables(id) on delete cascade,
  core_id uuid not null references public.network_cores(id) on delete cascade,
  tap_position_m numeric check (tap_position_m is null or tap_position_m >= 0),
  tap_position_pct numeric check (tap_position_pct is null or tap_position_pct between 0 and 100),
  code text not null,
  label text,
  target_node_id uuid references public.network_assets(id) on delete set null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RETIRED')),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.network_splitter_inputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  splitter_id uuid not null references public.network_splitters(id) on delete cascade,
  source_type text not null check (source_type in ('JB','CABLE_CORE','MID_CABLE_TAP','SPLITTER')),
  source_node_id uuid references public.network_assets(id) on delete set null,
  source_cable_id uuid references public.network_cables(id) on delete set null,
  source_core_id uuid references public.network_cores(id) on delete set null,
  source_tap_id uuid references public.network_cable_taps(id) on delete set null,
  source_splitter_id uuid references public.network_splitters(id) on delete set null,
  source_port integer,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','RETIRED')),
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_splitter_active_input on public.network_splitter_inputs(splitter_id) where status='ACTIVE';
create index if not exists ix_cable_taps_cable_core on public.network_cable_taps(cable_id, core_id);
create index if not exists ix_splitter_inputs_source_core on public.network_splitter_inputs(source_core_id);
create index if not exists ix_splitter_inputs_source_tap on public.network_splitter_inputs(source_tap_id);

alter table public.network_cable_taps enable row level security;
alter table public.network_splitter_inputs enable row level security;

create policy network_cable_taps_org_select on public.network_cable_taps for select to authenticated using (organization_id = (select private.current_organization_id()));
create policy network_cable_taps_org_insert on public.network_cable_taps for insert to authenticated with check (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role]));
create policy network_cable_taps_org_update on public.network_cable_taps for update to authenticated using (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role])) with check (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role]));
create policy network_cable_taps_org_delete on public.network_cable_taps for delete to authenticated using (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role]));

create policy network_splitter_inputs_org_select on public.network_splitter_inputs for select to authenticated using (organization_id = (select private.current_organization_id()));
create policy network_splitter_inputs_org_insert on public.network_splitter_inputs for insert to authenticated with check (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role]));
create policy network_splitter_inputs_org_update on public.network_splitter_inputs for update to authenticated using (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role])) with check (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role]));
create policy network_splitter_inputs_org_delete on public.network_splitter_inputs for delete to authenticated using (organization_id = (select private.current_organization_id()) and (select private.current_user_role()) = any(array['ADMINISTRATOR'::app_role,'PENGELOLA'::app_role]));