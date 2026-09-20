# Architecture

## 1. Runtime layers

```text
Browser
  │
  ├── app/index.html
  ├── app/styles.css
  └── app/app.js
          │
          ├── graph-engine.js
          │     └── topology validation / shortest trace / core trace
          │
          └── Supabase client
                ├── Auth
                ├── normalized network tables
                ├── incidents / work_orders
                └── RLS / organization isolation

Supabase Edge Functions
  ├── bootstrap-admin
  └── admin-user
```

## 2. Source-of-truth rules

### Identity and access
- Supabase Auth owns authentication.
- `profiles` owns application role and organization membership.
- Role is never selected by the login form.
- Administrator, Pengelola, and Teknisi are enforced by both application permission checks and database RLS.

### Network topology
The application view-model `db` is a UI orchestration model. Persistent network records are normalized in Supabase:

- `network_assets`
- `network_cables`
- `network_cores`
- `network_core_connections`
- `network_splitters`
- `network_splitter_outputs`
- `network_splitter_connections`
- `network_links`
- `customers` for customer/service master data

`network_state` may be retained as a compatibility snapshot, but it is not the authoritative CRUD representation. Browser `localStorage` is not used for network persistence.

### Operational data
- `incidents`
- `work_orders`

Customer service fields are persisted in `customers`; the `CUSTOMER` network asset remains the topology endpoint and shares the same UUID.

Operational status must be rendered from these records. No hard-coded incident cards or fake counters are allowed.

## 3. Topology

Canonical service topology:

**OLT → OLT Port → OTB → JB → BOX ODC-ODP → BOX ODC → BOX ODP → Customer**

The graph engine deliberately permits branching and heterogeneous cable capacities. Core numbers can change between cable segments through explicit continuity mappings.

### Trace pipeline

```text
Customer
   ↓
coreTrace()
   ↓
Core continuity
   ↓
Cable + port
   ↓
OLT Port
   ↓
OLT
```

`shortestTrace()` is a node-level diagnostic fallback. It must not be presented as proof of optical continuity.

## 4. UI boundaries

`index.html`
- application shell
- navigation anchors
- dialogs/forms
- no network business logic

`styles.css`
- visual system
- responsive layout
- component states

`app.js`
- authentication orchestration
- Supabase persistence orchestration
- UI event wiring
- rendering
- CRUD commands

`graph-engine.js`
- graph construction
- validation
- node trace
- core trace

## 5. Security boundaries

Browser code may contain only the Supabase publishable key.

Never expose:
- service-role key
- database password
- Edge Function privileged credentials

Privileged operations run server-side in Supabase Edge Functions. Database access remains protected by RLS.

## 6. Deployment

GitHub Actions performs:

1. checkout
2. Node.js 22 setup
3. `npm test`
4. copy `app/` into `_site/`
5. inject deployment-time Supabase browser configuration
6. generate `404.html` for GitHub Pages clean routes
7. upload Pages artifact
8. deploy Pages

Only `main` is a deployment source. Feature branches are development branches unless explicitly promoted.

## 7. Engineering invariants

- No active PON/OLT_PON/OBT UI layer.
- OLT ports are first-class source endpoints.
- ODP splitter ratio is fixed to `1:8`.
- Supported splitter ratios: `1:2`, `1:4`, `1:8`, `1:16`, `1:32`, `1:64`.
- Cable core capacity is variable.
- Core mappings must reference real cables, cores, and nodes.
- Self-loop cables are invalid.
- Customer tracing requires actual continuity.
- Incident/work-order counters are data-driven.