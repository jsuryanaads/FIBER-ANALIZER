# FIBER-ANALIZER — Data Model

## Design principle

The topology is a **flexible graph**, not a fixed OLT → JB → ODC → ODP chain. Every supported network node may connect to any other supported node when that physical route exists.

Canonical UI node types:
- OLT_PON
- OTB
- JB
- ODC_ODP (ditampilkan sebagai BOX ODC-ODP)
- ODC (ditampilkan sebagai BOX ODC)
- ODP (ditampilkan sebagai BOX ODP)
- CUSTOMER

Examples of valid physical relationships include JB → JB, JB → ODC_ODP, JB → ODC, JB → ODP, ODC_ODP → JB, ODC → JB, ODP → JB, and other combinations. The database must not reject a connection solely because of node type ordering.

A cable is a physical segment connecting two nodes. Each cable has its own fiber capacity (for example 12C, 24C, 48C) and individual cores. At any node, a core continuity mapping may connect an input cable/core to a different output cable/core. Core numbers therefore may change between cable segments, and multiple mappings at the same node provide branching.

## Primary entities

### olt / pon
- id
- code
- name
- vendor
- model
- serial_number
- management_ip
- location_id
- status
- notes
- created_at
- updated_at

### olt_pon logical details
- id
- olt_id
- slot
- port
- code
- technology
- capacity
- status
- notes

Unique logical identity should normally be: olt_id + slot + port.

### otb / jb / odc_odp / odc / odp / customer nodes
- id
- code
- name
- type
- capacity
- location_id
- status
- notes

### odc
- id
- code
- name
- capacity
- input_ports
- output_ports
- location_id
- status
- notes

### odp
- id
- code
- name
- capacity
- port_count
- location_id
- status
- notes

### cable
- id
- code
- cable_type
- fiber_count
- length_m
- origin_node_id
- destination_node_id
- installation_date
- status
- condition
- route_geometry
- notes

Cable endpoints should reference a common network-node abstraction so a cable can connect supported node types without duplicating connection logic.

### cable_core
- id
- cable_id
- core_number
- color
- status
- attenuation_db_per_km
- notes

Core status:
- AVAILABLE
- RESERVED
- IN_USE
- DAMAGED
- RETIRED

### splitter
- id
- node_id
- ratio (1:2, 1:4, 1:8, 1:16, 1:32, 1:64)
- stage
- input_type (`CORE` or `SPLITTER`)
- input_cable_id
- input_core_id
- input_splitter_id
- input_port

A splitter belongs to a BOX ODC-ODP, BOX ODC, or BOX ODP. Multiple splitters may exist in one box. A splitter output port may be internally patched to the input of another splitter in the same box.

### splitter_connection
- id
- node_id
- from_splitter_id
- from_port
- to_splitter_id
- to_port

This explicitly models internal box patching such as SPL-A Port 1 → SPL-B INPUT and SPL-B Port 4 → SPL-C INPUT.

### port
A normalized port entity should represent OLT/PON, JB, ODC and ODP termination points where needed.

Fields:
- id
- node_id
- port_number
- port_type
- status
- connected_core_id
- notes

### splice
- id
- closure_node_id
- tray
- position
- input_core_id
- output_core_id
- estimated_loss_db
- measured_loss_db
- status
- notes

A splice maps one core to another core. It must not be represented only as a text note.

### customer
- id
- customer_code
- name
- address
- latitude
- longitude
- service_status
- odp_id
- odp_port
- notes

### service_path
Represents the logical route used by a customer/service. It should be derivable from the topology but may be materialized for fast reads.

No fixed path is required. A service path is derived from the actual graph and core continuity mappings.

### test_record
- id
- test_type
- cable_id
- core_id
- wavelength_nm
- instrument
- technician_id
- tested_at
- distance_m
- total_loss_db
- event_count
- file_reference
- notes

Supported test types:
- OTDR
- OPM
- VFL
- OTHER

### incident
- id
- incident_code
- severity
- status
- affected_node_id
- affected_cable_id
- affected_core_id
- opened_at
- resolved_at
- root_cause
- resolution
- notes

### work_order
- id
- work_order_code
- incident_id
- assigned_to
- priority
- status
- scheduled_at
- completed_at
- notes

### attachment
- id
- entity_type
- entity_id
- file_name
- mime_type
- storage_key
- captured_at
- latitude
- longitude
- notes

### audit_log
- id
- actor_id
- action
- entity_type
- entity_id
- before_json
- after_json
- created_at

## Relationship summary

All supported node types participate in a many-to-many physical topology through cables. OLT/PON may be the source of a service, but intermediate node ordering is not constrained.

Cable N—1 origin node and N—1 destination node.

Cable 1—N Core.

Core 1—N splice events over its physical route, subject to topology validation.

Node/asset 1—N attachments.

Incident can reference node, cable and/or core.

## Integrity constraints

1. A core cannot be IN_USE without a valid connection.
2. A customer service port cannot be assigned to two active services.
3. A port cannot have two active incompatible terminations.
4. A splice must have valid input and output cores.
5. A cable cannot connect a node to itself unless explicitly marked as a loop.
6. Deleting an asset with historical references should use soft-delete/retirement.
7. Topology changes must generate audit records.
8. All geographic coordinates must use one documented coordinate reference system.
9. Cable length should be stored independently from route geometry so measured/installed length and map length are distinguishable.
10. Optical calculations must record their input assumptions and calculation version.
