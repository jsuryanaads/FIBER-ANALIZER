# Supabase migration source

The production Supabase project currently reports these applied migrations:

1. 20260919200948_fiber_network_foundation
2. 20260919201016_supabase_auth_rbac_multitenant
3. 20260919201255_secure_bootstrap_admin_edge_function
4. 20260919201306_organization_network_state
5. 20260919202023_network_crud_tables
6. 20260919202200_incident_workorder_crud
7. 20260919202659_enforce_rbac_on_operational_crud
8. 20260920065754_master_pro_performance_indexes
9. 20260920065805_master_pro_foreign_key_indexes
10. 20260920071449_enable_fiber_analyzer_realtime
11. 20260920073746_customer_service_package

The remote migration history is authoritative until the SQL files are pulled into this repository with the Supabase CLI.

Recommended recovery/synchronization workflow:

```bash
supabase link --project-ref xdfwtsixuwikijknkvlz
supabase migration list
supabase db pull
```

Do not create replacement SQL migrations by guessing the remote schema. After `db pull`, review the generated baseline and commit the resulting files under `supabase/migrations/`.

The repository already tracks the two production Edge Functions under `supabase/functions/`.