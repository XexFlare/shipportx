# Data quality and validation

## Two different kinds of checking

1. **Research verification** (done during research, per field): each value is backed by a cited
   source and a confidence level. This is where facts were established.
2. **Automated validation** (`npm run validate`, and the fuller release validation in
   `reports/release-validation-report.md`): checks that the published files are complete,
   well-formed and consistent with each other.

**Automated validation does not re-verify the research.** A passing check means, for example,
that every CSV cell equals its JSON value, not that a port's status or draft is correct today.

## What the release validation checks

- Record counts equal `record_count` (283) in JSON, JSONL, CSV and Parquet, and match the
  original build summary.
- `port_id` unique, `{ISO2}-{slug}` format, prefix equals `country_code`.
- Required fields present; every JSON record has the same field set.
- JSONL records deep-equal JSON; every CSV and Parquet value equals JSON (lists `"; "`-joined);
  identical record order in all formats; derived columns reproducible.
- Package copies byte-identical to the originals (SHA-256).
- Latitude/longitude paired and in range; plausibility against approximate country bounds and
  against the record's own research coordinate text.
- `country_code` ↔ `country` ↔ `country_code_iso3` ↔ `region_continental` one-to-one.
- `research_status` and `operating_status_primary` within their vocabularies; every `VERIFIED`
  record has an `operating_status`.
- No duplicate UN/LOCODEs; every `source_ids` entry exists in `sources.csv`.
- `null` (never empty strings) used for missing values in JSON.

Result for 1.0.0: all checks pass. The findings below are reported, **not corrected**, changing
published values is left to a versioned data release.

## Known issues in 1.0.0

### Coordinates (fixed before first publication, 2026-10-17)

The original build script read hemisphere letters and ignored contradictory minus signs, and
truncated degrees-minutes-seconds values to whole degrees. Eight records were affected:
`KE-mombasa`, `KE-lamu`, `DZ-arzew`, `MR-nouadhibou`, `MR-nouakchott`, `SN-dakar`, `DJ-port-of-djibouti`, `DJ-doraleh-container-terminal`. The parser was fixed, the contradictory research values were
corrected, and `DZ-mostaganem` (which carried Arzew's position) now uses the NGA World Port Index.
All nine records agree with the World Port Index, and the build now reports any new sign conflict
as `coordinate_sign_conflict`.

### Other findings

- **28 `VERIFIED` records without formal `source_ids`** (mostly Ghanaian and Senegalese fishing
  harbours, some Djibouti ports): sources are cited as free text in `fields_detail`.
- **UN/LOCODE:** `TN-sousse` has `TBSUS` (does not start with `TN`; flagged as unverified by
  the research). `MA-dakhla` records the MAVIL/EHVIC conflict as text. Four records have the
  explicit value `UNKNOWN` (Cotonou, Abidjan, San-Pédro, Mossel Bay).
- **Port type outside the specification list:** six records use `seaport` (kept verbatim).
- **Non-standard confidence values** kept verbatim in `fields_detail`: `UNVERIFIED (dated)` and
  `CONFLICTING / likely stale` (one each). Eight researched fields have an empty confidence.
- **Shared coordinates:** `DJ-port-of-djibouti` and `DJ-doraleh-container-terminal` share (11, 43)
  because of the truncation above.
- **Doraleh Multipurpose Port** has a coordinate row stating the position was not established;
  its coordinates are correctly null.
- **Source conflicts recorded by the research:** Djibouti (DP World concession history; Doraleh
  Container Terminal berth count), Dakar ("3,000 TEU" figure looks stale), Quelimane (channel
  draft 2.9 m vs 4.9–6.1 m tidal), Laâyoune (two coordinate sets).

## Coverage limitations

- Field coverage is uneven by design (see `SCHEMA.md` for counts): infrastructure and throughput
  values exist for roughly 3–22% of records.
- 20 discovery-register entries are named but not researched (DR Congo river ports, Nigerian
  historical river ports, Rwanda's planned Lake Kivu ports, Liberia's Greenville, Mozambique's
  artisanal fishing sites, Chad, Zambian dry ports).
- Burkina Faso, Eswatini and Lesotho have no records after one research pass.
- Values are as of 2026-08-23.

## Reporting a problem

Open a *Data correction* issue with the `port_id`, the field, the proposed value and a public
source (see `CONTRIBUTING.md`).
