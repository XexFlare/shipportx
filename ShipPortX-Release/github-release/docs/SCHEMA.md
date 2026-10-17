# ShipPortX schema (v1.0, dataset 1.0.0)

Applies to `data/shipportx.csv`, `.parquet`, `.json` and `.jsonl`. All four hold the same 283
records in the same order with identical values (verified by `scripts/validate.mjs`).

Types below are the **actual published types**. (The original build notes described
`alternate_names`, `secondary_activities`, `cargo_types` and `terminals` as JSON arrays; in the
published files they are strings. Only `source_ids` is an array.)

## Record types

| `research_status` | Count | Meaning |
|---|---|---|
| `VERIFIED` | 263 | Real facility confirmed with credible evidence; has its own research record. A short record can still be fully verified. |
| `DISCOVERED` | 12 | Named in a country discovery register; not yet researched. Most fields null by construction. |
| `UNRESOLVED` | 8 | Existence or basic classification not established (includes "category" entries such as unnamed landing sites). |
| `RESEARCHED` | 0 | Identified and classified but not cross-checked (vocabulary value; unused in 1.0.0). |

## Fields

### Identity

| Field | Type | Records with value | Notes |
|---|---|---|---|
| `port_id` | string | 283 | Stable ID `{ISO2}-{slug}` (e.g. `GH-tema`). Discovery entries end in their status (`CD-akula-discovered`). |
| `official_name` | string | 283 | Current or canonical name. |
| `alternate_names` | string \| null | 10 | Former, local or transliterated names (free text). |
| `country` | string | 283 | Country name. |
| `country_code` | string | 283 | ISO 3166-1 alpha-2. |
| `country_code_iso3` | string | 283 | ISO 3166-1 alpha-3. |
| `region_continental` | string | 283 | North, West, Central, East, Southern or Island Africa. |
| `administrative_area` | string \| null | 29 | Province, region or state. |
| `city` | string \| null | 41 | Nearest city or settlement. |
| `port_type` | string | 283 | Verbatim; may be compound (`lake_port / ferry_terminal`) or qualified (`river_port (candidate)`). |
| `part_of` | string \| null | 22 | Parent port of a separately recorded terminal, or a related-facility note. |

### Location

| Field | Type | Records with value | Notes |
|---|---|---|---|
| `latitude` | number \| null | 146 | WGS84 decimal degrees, south negative. |
| `longitude` | number \| null | 146 | WGS84 decimal degrees, west negative. |
| `unlocode` | string \| null | 96 | 91 are 5-character codes; 4 are the literal `UNKNOWN`; 1 is a conflict note (Dakhla). |

### Activity

| Field | Type | Records with value | Notes |
|---|---|---|---|
| `primary_activity` | string \| null | 159 | Dominant activity in plain words. |
| `secondary_activities` | string \| null | 22 | |
| `cargo_types` | string \| null | 19 | |
| `commercial_status` | string \| null | 252 | `commercial`, `artisanal`, `mixed`, `industrial_private` (verbatim, may be qualified). |
| `operating_status` | string \| null | 263 | Controlled vocabulary, verbatim (one value carries a qualifier). |

### Infrastructure, capacity, connectivity, operations

All strings as published (often with context and a year), not parsed numbers.

| Field | Records with value |
|---|---|
| `port_authority` | 63 |
| `ownership` | 19 |
| `year_established` | 29 |
| `port_area` | 9 |
| `water_area` | 0 |
| `number_of_berths` | 26 |
| `number_of_terminals` | 1 |
| `berth_length_total` | 18 |
| `max_vessel_length` | 4 |
| `turning_basin` | 0 |
| `terminals` | 28 |
| `cranes_equipment` | 8 |
| `storage_facilities` | 3 |
| `max_draft_m` | 32 |
| `channel_depth_m` | 3 |
| `berth_depth_m` | 0 |
| `tidal_restrictions` | 0 |
| `pilotage` | 0 |
| `tug_availability` | 0 |
| `access_restrictions` | 1 |
| `annual_throughput_teu` | 10 |
| `annual_throughput_tonnage` | 23 |
| `storage_capacity` | 3 |
| `berth_capacity_notes` | 9 |
| `annual_throughput_notes` | 5 |
| `road_connection` | 9 |
| `rail_connection` | 15 |
| `inland_waterway_connection` | 1 |
| `nearby_airport` | 0 |
| `hours_of_operation` | 2 |
| `seasonal_limitations` | 0 |
| `major_restrictions` | 3 |
| `website` | 7 |
| `general_notes` | 34 |
| `vessel_capability` | 1 |
| `vessel_traffic_notes` | 1 |
| `adjacent_facilities` | 1 |
| `under_construction_notes` | 3 |

### Provenance

| Field | Type | Records with value | Notes |
|---|---|---|---|
| `research_status` | string | 283 | See record types above. |
| `confidence_core` | string \| null | 263 | Confidence of `operating_status` (falling back to `port_type`). |
| `source_ids` | array of strings (JSON/JSONL); `"; "`-joined string (CSV/Parquet) | 248 non-empty | IDs in `data/sources.csv`. Empty for 28 VERIFIED records that cite sources as free text. |
| `record_path` | string | 283 | Identifier of the research record the entry was built from (maintainers' archive, not published), e.g. `research/ShipPortX/ports/ghana/tema.md`. |
| `last_verified` | string (YYYY-MM-DD) \| null | 263 | |
| `research_notes` | string | 283 | What is and is not established for this record. |
| `fields_detail` | object (JSON/JSONL only) | 263 non-empty | `{ "<field>": { "value", "confidence", "source", "notes" } }` exactly as in the research table. Includes some research-only keys (`country_raw`, `lat_lon_raw`, `approach_notes`, `region`). |

### Derived (CSV and Parquet only)

| Field | Notes |
|---|---|
| `port_type_primary` | First token of `port_type` with parenthetical qualifiers removed (`lake_port / ferry_terminal` → `lake_port`). |
| `operating_status_primary` | `operating_status` normalised to the controlled vocabulary. |

These are filtering conveniences, **not research facts**. Qualifiers in parentheses are dropped,
so "UNKNOWN (likely ACTIVE_LIMITED but not confirmed)" is derived as `UNKNOWN`.

## Controlled vocabularies

**`operating_status`:** `ACTIVE` (operating normally) · `ACTIVE_LIMITED` (partially operating) ·
`SEASONAL` (part of the year by design) · `INACTIVE` (no evidence of current activity, not
confirmed closed) · `HISTORICAL` (no longer functions as a port) · `UNDER_CONSTRUCTION` ·
`PROPOSED` (construction not confirmed to have started) · `ABANDONED` (derelict) · `UNKNOWN`.

**`port_type` categories:** `major_commercial`, `secondary_commercial`, `regional_commercial`,
`fishing_harbour`, `river_port`, `lake_port`, `oil_terminal`, `gas_terminal`,
`mining_export_terminal`, `agricultural_export_terminal`, `passenger_port`, `ferry_terminal`,
`industrial_port`, `private_port`, `naval_military` (civilian use only), `terminal`, `other`.
Some records also use `seaport`.

**`region_continental`:** North Africa, West Africa, Central Africa, East Africa, Southern Africa,
Island Africa.

## Missing values

| Value | Meaning |
|---|---|
| `null` / empty CSV cell | Not established in this research pass. Not zero, not "none". |
| `"UNKNOWN"` | Explicit conclusion that the value could not be determined despite an attempt. |
| `"NONE"` | Positive finding that the thing does not exist (where used). |
| Conflict text | Sources disagree; the disagreement is the value (e.g. Dakhla `unlocode`). |

## Format specifics

| Format | Lists | Nulls | Extra |
|---|---|---|---|
| CSV | `"; "`-joined | empty cell | 2 derived columns; no `fields_detail`. UTF-8. |
| Parquet | `"; "`-joined string | null | Same columns as CSV; `latitude`/`longitude` float64. |
| JSON | `source_ids` array | `null` | Envelope: `dataset`, `version`, `schema_version`, `generated`, `research_cutoff_date`, `record_count`, `records`. |
| JSONL | `source_ids` array | `null` | One record per line, no envelope. |

When reading the CSV with pandas, columns that are empty in every row are inferred as float; pass
`dtype=str, keep_default_na=False, na_values=[""]` to keep everything as text.
