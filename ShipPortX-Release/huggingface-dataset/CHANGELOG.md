# Changelog

## 1.0.0: generated 2026-08-23 · release package prepared 2026-10-14

First public release.

- 283 records: 263 `VERIFIED` port/facility records and 20 discovery-register entries
  (12 `DISCOVERED`, 8 `UNRESOLVED`), across 51 countries.
- 193 entries in the source register (`data/sources.csv`).
- Before first publication the research text's punctuation was normalised and the dataset rebuilt;
  record IDs and facts are unchanged.
- Formats: Parquet (default config), JSONL with field-level provenance (`full` config), JSON with
  metadata envelope, CSV, source register CSV, SHA-256 checksums.
- Release validation: all automated structural and cross-format checks pass (see the dataset card). Coordinates of
  nine records were corrected before first publication (2026-10-17): eight had sign or
  degrees-minutes-seconds parsing errors in the original build, and Mostaganem carried Arzew's position.

## Planned for a future version (not in 1.0.0)

- Research the remaining discovery-register entries and enrich infrastructure fields.
