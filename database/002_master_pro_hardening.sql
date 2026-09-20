-- FIBER-ANALYZER MASTER PRO hardening indexes.
-- Applied to Supabase production project xdfwtsixuwikijknkvlz.
-- Keep this migration idempotent for future environments.
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_user_id);
create index if not exists idx_incidents_asset on public.incidents(asset_id);
create index if not exists idx_incidents_assigned on public.incidents(assigned_to);
create index if not exists idx_incidents_customer on public.incidents(customer_id);
create index if not exists idx_incidents_reported on public.incidents(reported_by);
create index if not exists idx_jbs_location on public.jbs(location_id);
create index if not exists idx_network_cables_from on public.network_cables(from_asset_id);
create index if not exists idx_network_cables_to on public.network_cables(to_asset_id);
create index if not exists idx_network_links_from on public.network_links(from_asset_id);
create index if not exists idx_network_links_to on public.network_links(to_asset_id);
create index if not exists idx_network_splitter_connections_node on public.network_splitter_connections(node_id);
create index if not exists idx_network_splitter_outputs_splitter on public.network_splitter_outputs(splitter_id);
create index if not exists idx_odcs_location on public.odcs(location_id);
create index if not exists idx_odps_location on public.odps(location_id);
create index if not exists idx_olts_location on public.olts(location_id);
create index if not exists idx_organizations_created_by on public.organizations(created_by);
create index if not exists idx_ports_connected_core on public.ports(connected_core_id);
create index if not exists idx_profiles_created_by on public.profiles(created_by);
create index if not exists idx_splices_closure_node on public.splices(closure_node_id);
create index if not exists idx_work_orders_asset on public.work_orders(asset_id);
create index if not exists idx_work_orders_assigned on public.work_orders(assigned_to);
create index if not exists idx_work_orders_created_by on public.work_orders(created_by);
create index if not exists idx_work_orders_customer on public.work_orders(customer_id);
create index if not exists idx_work_orders_incident on public.work_orders(incident_id);
