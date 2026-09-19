# FIBER-ANALIZER

Fiber-optic network management and optical analysis foundation.

## Canonical topology

**OLT → PON → JB → ODC → ODP → Customer**

Physical fiber cables, cores, ports and splices are modeled independently so the system can support path tracing, capacity management, optical analysis, field operations and GIS.

## Current phase

Phase 1 foundation:
- documented system scope
- PostgreSQL-compatible network schema
- cable/core/port/splice model
- optical-analysis requirements
- phased roadmap

See:
- [Project Scope](docs/PROJECT_SCOPE.md)
- [Data Model](docs/DATA_MODEL.md)
- [Optical Analysis](docs/OPTICAL_ANALYSIS.md)
- [Feature Roadmap](docs/FEATURE_ROADMAP.md)
- [Database Foundation](database/001_fiber_network_foundation.sql)

## Engineering rule

Do not hard-code vendor-specific optical loss values or network assumptions into the core data model. Keep engineering parameters configurable and preserve calculation inputs for auditability.
