# FIBER-ANALIZER — Optical Analysis Requirements

## Loss budget

The analyzer should calculate an end-to-end budget using explicit components:

Total Loss =
fiber attenuation
+ connector losses
+ splice losses
+ splitter losses
+ other configured passive losses

Margin =
allowed/available optical budget - calculated total loss

Never hide assumptions. Every calculation should expose:
- wavelength
- fiber length
- attenuation coefficient
- connector count and per-connector loss
- splice count and per-splice loss
- splitter ratio/type and loss
- engineering margin
- measured loss, when available

## Splitter presets

Support configurable presets rather than hard-coding one vendor's values.

Examples:
- 1:2
- 1:4
- 1:8
- 1:16
- 1:32
- 1:64

Each preset must store nominal loss and optionally a tolerance/engineering value. Actual field measurements must remain separate from nominal values.

## Wavelengths

The model should support at least:
- 1310 nm
- 1490 nm
- 1550 nm
- 1577 nm

The set must be configurable because network technologies and test procedures vary.

## OTDR

OTDR records should support:
- instrument
- wavelength
- pulse width
- range
- averaging/test duration
- launch fiber
- receive fiber
- total distance
- total loss
- reflectance
- event table
- test file reference
- technician
- timestamp
- GPS/location

The application should allow a future parser/importer for common OTDR export formats without making the database dependent on one instrument vendor.

## Event analysis

Represent individual events where possible:
- connector
- splice
- bend
- splitter
- end of fiber
- reflective event
- non-reflective event

Each event should contain distance, loss, reflectance where available, and confidence/source.

## Validation

A test result should be flagged for review when:
- required metadata is missing;
- measured loss exceeds configured threshold;
- measured length differs materially from registered cable length;
- an unexpected reflective event is present;
- the tested core is not part of the expected service path.

Thresholds must be configurable per network policy, cable type, wavelength and test procedure.

## Auditability

Store the calculation inputs, calculation version and output. Do not only store the final number.

This makes results reproducible when engineering assumptions change.
