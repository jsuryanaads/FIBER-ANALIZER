# FIBER-ANALYZER — Feature Roadmap

## Phase 0 — Repository foundation
- [x] Define canonical topology: OLT → PON → JB → ODC → ODP
- [x] Define fiber/cable as first-class resources
- [x] Define core/port/splice model
- [x] Define optical-analysis requirements
- [x] Define field-operations requirements
- [ ] Identify current application stack and preserve existing working features
- [ ] Add CI validation
- [ ] Add architecture documentation

## Phase 1 — Network inventory
- [ ] OLT CRUD
- [ ] PON CRUD and OLT relationship
- [ ] JB CRUD
- [ ] ODC CRUD
- [ ] ODP CRUD
- [ ] location/GPS
- [ ] cable inventory
- [ ] cable core inventory
- [ ] port inventory
- [ ] asset status/condition

## Phase 2 — Connectivity and trace
- [ ] cable endpoint mapping
- [ ] core assignment
- [ ] splice management
- [ ] termination management
- [ ] topology validation
- [ ] forward trace
- [ ] reverse trace
- [ ] customer impact trace
- [ ] free-core/capacity analysis

## Phase 3 — Fiber analyzer
- [ ] loss-budget calculator
- [ ] splitter calculator
- [ ] wavelength-aware calculations
- [ ] measured-vs-calculated comparison
- [ ] OTDR test records
- [ ] OPM test records
- [ ] test attachments
- [ ] pass/review/fail workflow

## Phase 4 — GIS and field operations
- [ ] interactive map
- [ ] cable route drawing
- [ ] node markers
- [ ] incident map
- [ ] technician work orders
- [ ] photo/GPS evidence
- [ ] offline-friendly field forms
- [ ] restoration history

## Phase 5 — Operations and analytics
- [ ] dashboard
- [ ] utilization
- [ ] capacity forecasting
- [ ] incident analytics
- [ ] maintenance schedule
- [ ] customer impact analysis
- [ ] exports
- [ ] audit history

## Phase 6 — Integrations
Potential integrations should be implemented behind adapters:
- MikroTik/BNG/service-status integration
- monitoring/telemetry
- notification services
- external GIS
- inventory import/export
- future optical-instrument parsers

No integration should make the core inventory model dependent on one vendor.
