# Changelog

All notable changes to ShipPortX. Versions follow semantic versioning for the dataset:
major = breaking schema change, minor = new records or fields, patch = corrections.

## [1.0.0]: dataset generated 2026-08-23 · release package 2026-10-14

### Added
- Licensed under CC BY 4.0.
- First public release: 283 records (263 `VERIFIED`, 12 `DISCOVERED`, 8 `UNRESOLVED`) across
  51 African countries, built from a per-port, source-cited research corpus.
- Formats: `shipportx.csv`, `shipportx.parquet`, `shipportx.json`, `shipportx.jsonl`;
  `sources.csv` with 193 registered sources; `SHA256SUMS`.
- Field-level provenance (`fields_detail`) in JSON/JSONL.
- Documentation: schema, provenance and methodology, data quality, API.
- `scripts/validate.mjs`: automated integrity checks; JavaScript and Python examples.

### Changed (before first publication, 2026-10-14)
- Punctuation in the research notes normalised (em dashes replaced with colons, commas or full
  stops) and the dataset rebuilt. Record IDs and all facts are
  unchanged; source-name separators now read "Publisher: Title". Three `confidence_core` values that
  were a bare dash now follow the documented fallback, and Ilha de Moçambique's derived
  `operating_status_primary` is now `UNKNOWN` (matching its research status) instead of `ACTIVE_LIMITED`.
- Research-note wording standardised (for example "not established in this research pass");
  meaning and evidence caveats unchanged.

### Fixed (before first publication, 2026-10-17)
- Coordinates of nine records. Eight disagreed with their research text because of sign and
  degrees-minutes-seconds parsing errors in the build script: `KE-mombasa`, `KE-lamu`, `DZ-arzew`, `MR-nouadhibou`, `MR-nouakchott`, `SN-dakar`, `DJ-port-of-djibouti`, `DJ-doraleh-container-terminal`.
  The parser now converts degrees-minutes-seconds in full and reports contradictory signs, and the
  research records were corrected. `DZ-mostaganem` carried Arzew's position and now uses the NGA
  World Port Index value (new source `DZ-05`). All nine agree with the World Port Index.

### Known issues
- Corrected documentation: `alternate_names`, `secondary_activities`, `cargo_types` and
  `terminals` are strings in JSON/JSONL (the original schema note described them as arrays).

## Planned
- Research the remaining discovery-register entries (DR Congo, Nigeria, Rwanda, Liberia,
  Mozambique, Chad) and re-check Burkina Faso, Eswatini and Lesotho.
