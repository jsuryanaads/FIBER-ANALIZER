# FIBER-ANALYZER — Feature Roadmap

## Phase 0 — Repository foundation
- [x] Define canonical topology: OLT → OLT Port → OTB → JB → ODC-ODP → ODC → ODP → Customer
- [x] Define fiber/cable as first-class resources
- [x] Define core/port/splice model
- [x] Define optical-analysis requirements
- [x] Define field-operations requirements
- [ ] Identify current application stack and preserve existing working features
- [ ] Add CI validation
- [ ] Add architecture documentation

## Phase 1 — Network inventory
- [x] OLT CRUD
- [x] OTB CRUD
- [x] JB CRUD
- [x] ODC-ODP CRUD
- [x] ODC CRUD
- [x] ODP CRUD
- [x] Customer CRUD
- [ ] location/GPS
- [x] cable inventory
- [x] cable core inventory
- [x] port inventory
- [x] asset status/condition

## Phase 2 — Connectivity and trace
- [x] cable endpoint mapping
- [x] core assignment
- [x] splice management
- [x] termination management
- [x] topology validation
- [x] forward trace
- [ ] reverse trace
- [ ] customer impact trace
- [ ] free-core/capacity analysis

## Phase 3 — Fiber analyzer
- [x] loss-budget calculator
- [x] splitter calculator
- [x] wavelength-aware calculations
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
