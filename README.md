# FIBER-ANALIZER

**Fiber Network Management & Optical Analysis**

FIBER-ANALIZER adalah aplikasi web untuk inventarisasi jaringan fiber, pemetaan topology, cable/core continuity, service tracing, optical-loss analysis, incident, dan work order.

## Canonical topology

**OLT → OLT Port → OTB → JB → BOX ODC-ODP → BOX ODC → BOX ODP → Customer**

Topology diimplementasikan sebagai **flexible graph**. Urutan di atas adalah topology layanan utama, bukan constraint bahwa semua kabel harus mengikuti urutan tersebut. Setiap node yang didukung dapat terhubung melalui kabel fisik selama endpoint dan core continuity valid.

### Node aktif

| Type | Label UI |
|---|---|
| OLT | OLT |
| OTB | OTB |
| JB | JB |
| ODC_ODP | BOX ODC-ODP |
| ODC | BOX ODC |
| ODP | BOX ODP |
| CUSTOMER | PELANGGAN |

**PON/OLT_PON/OBT bukan lagi layer aktif.** OLT Port menjadi source endpoint independen.

## Fitur saat ini

- Supabase Auth + RBAC: Administrator, Pengelola, Teknisi.
- Multi-tenant organization isolation dengan PostgreSQL RLS.
- Inventory OLT, OTB, JB, ODC-ODP, ODC, ODP, Customer.
- OLT port inventory.
- Cable CRUD dengan kapasitas core fleksibel.
- Core inventory dan core continuity/splice mapping.
- Flexible branching topology.
- Internal splitter patching.
- Customer path tracing berbasis core.
- Optical Analyzer dengan wavelength-aware attenuation.
- Incident dan Work Order persistence di Supabase.
- GitHub Pages deployment.
- Automated JavaScript integrity/topology tests.

## Project structure

```text
app/
  index.html          # application shell + dialogs
  styles.css          # global UI styles
  app.js              # application orchestration/UI event handlers
  graph-engine.js     # topology graph, validation, core trace
  supabase-config.js  # public browser configuration; deployment may inject values

database/
  001_fiber_network_foundation.sql

docs/
  ARCHITECTURE.md
  PROJECT_SCOPE.md
  DATA_MODEL.md
  OPTICAL_ANALYSIS.md
  FEATURE_ROADMAP.md

tests/
  graph-engine.test.js
  topology-engine.test.js
  ui-integrity.test.js
  project-integrity.test.js

supabase/
  config.toml
  migrations/          # remote migration manifest; SQL baseline must stay versioned here
  functions/            # server-side Edge Functions tracked in source control
```

## Local validation

Requires Node.js 22+.

```bash
npm test
```

## Deployment

GitHub Pages is deployed from `main` through:

```text
.github/workflows/deploy-pages.yml
```

Supabase service-role credentials must **never** be committed to the repository or exposed to browser code. Only the public/publishable client key may be used in the frontend, protected by RLS.

## Engineering rules

1. Network topology and core continuity are authoritative; UI labels must not introduce a second topology model.
2. Customer/service data must not be represented by hard-coded demo incidents or fake operational counters.
3. Optical calculations expose their assumptions and do not hide engineering inputs.
4. All write operations are subject to RBAC and database RLS.
5. Historical references should be preserved through status/retirement rather than destructive deletion where required.
6. Vendor-specific integrations belong behind adapters and must not become part of the core topology model.

See [Architecture](docs/ARCHITECTURE.md) for the system boundaries and data flow.


## Aturan Versi Deployment

Versi menggunakan Semantic Versioning (SemVer): MAJOR.MINOR.PATCH.

- **Perubahan besar / fitur utama → MINOR**: 1.0.0 → 1.1.0
- **Perubahan kecil / bug fix → PATCH**: 1.1.0 → 1.1.1
- **Perubahan yang memutus kompatibilitas → MAJOR**: 1.1.1 → 2.0.0

Aturan:
1. Perubahan besar yang menambah modul, kemampuan utama, atau perubahan UX besar menaikkan MINOR dan mereset PATCH ke 0.
2. Bug fix, koreksi UI, optimasi, cleanup, dan perbaikan kompatibilitas menaikkan PATCH.
3. MAJOR hanya untuk perubahan yang memutus kontrak/kompatibilitas dan membutuhkan migrasi khusus.
4. Setiap deploy dari main wajib memiliki package.json.version yang sudah dinaikkan sesuai jenis perubahan.
5. Footer mengambil versi dari package.json dan tahun secara otomatis.
