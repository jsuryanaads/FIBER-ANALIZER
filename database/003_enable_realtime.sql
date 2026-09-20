-- FIBER-ANALYZER: Supabase Realtime publication
-- Keep organization_id filtering in the client subscription.
alter publication supabase_realtime add table
  public.network_assets,
  public.network_cables,
  public.network_cores,
  public.network_core_connections,
  public.network_splitters,
  public.network_splitter_outputs,
  public.network_splitter_connections,
  public.network_links,
  public.incidents,
  public.work_orders,
  public.profiles;
