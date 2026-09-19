# FIBER-ANALIZER — Fiber Network Management Scope

## Purpose

FIBER-ANALIZER is planned as an operational fiber-optic network management system, not only a loss calculator. The system must maintain a traceable digital model of the physical and logical network:

**OLT → PON → JB → ODC → ODP → Customer**

Fiber cables and fiber cores are first-class objects connecting those nodes.

## Core objectives

1. Maintain authoritative network inventory.
2. Trace a service from customer/ODP back to ODP → ODC → JB → PON → OLT.
3. Trace a cable/core from its origin to its destination and show every splice/termination.
4. Track port/core capacity and utilization.
5. Record optical-loss budgets and OTDR/OPM test evidence.
6. Support field technicians with photos, GPS/location, work orders and incident history.
7. Provide map and topology views.
8. Preserve audit history for topology changes.

## Topology rules

The canonical service topology is:

OLT → PON → JB → ODC → ODP → Customer

Do not silently reorder or remove these network layers. Optional physical objects such as poles, handholes, closures and routes may exist alongside the topology.

## Functional modules

### 1. Inventory
- OLT
- PON ports
- Joint Box (JB)
- ODC
- ODP
- poles / handholes / closures
- fiber cables
- cable cores
- splice closures / splice trays
- customer endpoints

### 2. Connectivity
- node-to-node links
- cable segments
- core assignment
- splice mapping
- termination/port mapping
- service path tracing

### 3. Fiber engineering
- fiber count and cable type
- length
- attenuation
- connector loss
- splice loss
- splitter loss
- engineering loss budget
- measured loss
- margin / pass-fail against configured threshold

### 4. Field operations
- incidents
- work orders
- technician assignment
- maintenance
- cable cuts
- damaged cores
- restoration history
- photo evidence
- GPS/location evidence

### 5. Testing
- OTDR test records
- OPM/power-meter records
- wavelength
- launch/receive information
- measured distance
- event loss
- total loss
- test file/photo attachment
- test date and technician

### 6. GIS / map
- network nodes
- cable routes
- poles
- ODC/ODP/JB coordinates
- incident locations
- service area
- route length
- map-based trace

### 7. Reporting
- inventory
- core utilization
- capacity
- topology
- optical budget
- incident history
- maintenance
- customer impact
- export-ready reports

## Non-functional requirements

- Role-based access control.
- Validation before topology changes.
- Audit log for create/update/delete/link/unlink operations.
- Soft delete where historical references must remain.
- Deterministic identifiers and labels.
- Import/export support for CSV/JSON.
- API-first data model so web/mobile clients can share the same backend.
- Automated tests for calculations and topology integrity.
- No secrets committed to Git.

## Recommended roles

- Administrator: configuration, users, full inventory.
- Network Engineer/Planner: topology, capacity, engineering calculations.
- NOC/Operations: incidents, service tracing, monitoring.
- Technician: field updates, tests, photos, work orders.
- Viewer: read-only maps, inventory and reports.

## MVP sequence

### Phase 1 — Foundation
Inventory + data model + topology validation + authentication/roles.

### Phase 2 — Fiber management
Cables + cores + ports + splice/termination mapping + path tracing.

### Phase 3 — Optical analysis
Loss budget + OTDR/OPM records + test evidence.

### Phase 4 — GIS and field operations
Map + routes + work orders + incidents + mobile-friendly field UI.

### Phase 5 — Integrations and analytics
Network device integration, dashboards, alerts, utilization analytics and historical trends.
