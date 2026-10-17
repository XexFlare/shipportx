---
pretty_name: ShipPortX
language:
  - en
license: cc-by-4.0
size_categories:
  - n<1K
tags:
  - africa
  - ports
  - maritime
  - geospatial
  - transportation
  - logistics
  - fisheries
  - provenance
configs:
  - config_name: default
    default: true
    data_files:
      - split: train
        path: data/shipportx.parquet
  - config_name: full
    data_files:
      - split: train
        path: data/shipportx_full.parquet
  - config_name: sources
    data_files:
      - split: train
        path: data/sources.parquet
---

# ShipPortX: an open dataset of African ports (v1.0.0)

ShipPortX is a research-derived, source-cited inventory of ports and water-transport facilities
across Africa: seaports, river and lake ports, fishing harbours, oil, gas and mining export
terminals, passenger and ferry terminals. It deliberately includes small and poorly documented
facilities alongside major container ports, and records *how well* each fact is supported.

| | |
|---|---|
| **Dataset version** | 1.0.0 (schema 1.0) |
| **Generated / research cut-off** | 2026-08-23 |
| **Release package prepared** | 2026-10-14 |
| **Records** | 283: 263 `VERIFIED` + 20 discovery-register entries (12 `DISCOVERED`, 8 `UNRESOLVED`) |
| **Countries represented** | 51 (no records for Burkina Faso, Eswatini, Lesotho) |
| **Records with coordinates** | 146 (51.6%), 8 of these are flagged, see *Known issues* |
| **Records with a 5-character UN/LOCODE** | 91 (32.2%) |
| **Source register** | 193 sources |
| **License** | CC BY 4.0 |

> **This is not an official or exhaustive registry.** It is a broad, methodologically documented
> first pass whose coverage depends on what is publicly documented. Use it as a reference
> dataset, not as an authority.

## Configurations and files

| Config | File | Rows | Use it for |
|---|---|---|---|
| `default` | `data/shipportx.parquet` | 283 | Flat table (65 columns), analysis in pandas/Polars/DuckDB. |
| `full` | `data/shipportx_full.parquet` | 283 | Same records **plus** the nested `fields_detail` field-level provenance (64 fields). |
| `sources` | `data/sources.parquet` | 193 | The source register that `source_ids` point to. |

The `full` and `sources` Parquet files are lossless conversions of `data/shipportx.jsonl` and
`data/sources.csv` (the `datasets` library requires one file format across configs); the release
validation checks them value-by-value against the originals. Original files, also included:

- `data/shipportx.jsonl`: one JSON record per line, with `fields_detail`.
- `data/sources.csv`: the source register as CSV.
- `data/shipportx.json`: all records in one document with a metadata envelope
  (`dataset`, `version`, `schema_version`, `generated`, `research_cutoff_date`, `record_count`, `records`).
- `data/shipportx.csv`: CSV twin of the Parquet file.
- `data/SHA256SUMS`: checksums of the five original files. These are byte-identical to the v1.0.0 build and were
  validated to contain the same records in the same order with identical values.

## Loading

```python
from datasets import load_dataset

ports = load_dataset("<HF_NAMESPACE>/shipportx", split="train")            # flat (Parquet)
full = load_dataset("<HF_NAMESPACE>/shipportx", "full", split="train")     # with fields_detail
sources = load_dataset("<HF_NAMESPACE>/shipportx", "sources", split="train")

lake_ports = ports.filter(lambda r: r["port_type_primary"] == "lake_port")
```

```python
import pandas as pd

df = pd.read_parquet("hf://datasets/<HF_NAMESPACE>/shipportx/data/shipportx.parquet")
verified = df[df["research_status"] == "VERIFIED"]
mappable = df.dropna(subset=["latitude", "longitude"])
by_country = df.groupby("country").size().sort_values(ascending=False)

# CSV: read text columns as strings so fully-empty columns are not inferred as float
csv = pd.read_csv("data/shipportx.csv", dtype=str, keep_default_na=False, na_values=[""])
```

```python
import json

with open("data/shipportx.json", encoding="utf-8") as f:
    payload = json.load(f)
print(payload["version"], payload["record_count"])
mombasa = next(r for r in payload["records"] if r["port_id"] == "KE-mombasa")
print(mombasa["fields_detail"]["unlocode"])   # {'value': 'KEMBA', 'confidence': ..., 'source': ..., 'notes': ...}
```

## Intended use

- Mapping and logistics prototypes that need port identities, locations and status.
- Research on African port networks, inland waterways, lake transport and small-scale fisheries.
- Education and data-literacy work, including the study of gaps and uncertainty.
- A starting point for verification by authorities, NGOs and researchers.

**Not suitable** for navigation, safety-of-life decisions, or as a legal or official source.
Infrastructure and throughput values are sparse and dated; always check the cited source.

## Schema

Every record has the same 63 core fields (JSON/JSONL add `fields_detail`; CSV/Parquet add two
derived columns). Types below are the **actual** published types.

**Identity:** `port_id` (string, stable `{ISO2}-{slug}`; discovery entries end with their status,
e.g. `CD-akula-discovered`), `official_name`, `alternate_names` (string), `country`,
`country_code` (ISO 3166-1 alpha-2), `country_code_iso3`, `region_continental`
(North/West/Central/East/Southern/Island Africa), `administrative_area`, `city`, `port_type`
(verbatim, may be compound such as `lake_port / ferry_terminal`), `part_of`.

**Location:** `latitude`, `longitude` (float, WGS84, null if unpublished), `unlocode` (string;
may be the literal `UNKNOWN` or a short conflict note instead of a code).

**Activity:** `primary_activity`, `secondary_activities`, `cargo_types`, `commercial_status`,
`operating_status` (verbatim; see vocabulary).

**Infrastructure:** `port_authority`, `ownership`, `year_established`, `port_area`, `water_area`,
`number_of_berths`, `number_of_terminals`, `berth_length_total`, `max_vessel_length`,
`turning_basin`, `terminals`, `cranes_equipment`, `storage_facilities`, `max_draft_m`,
`channel_depth_m`, `berth_depth_m`, `tidal_restrictions`, `pilotage`, `tug_availability`,
`access_restrictions`, all **strings as published** (values often include context, e.g.
"15 metres (sufficient for Panamax vessels)"), not parsed numbers.

**Capacity:** `annual_throughput_teu`, `annual_throughput_tonnage`, `storage_capacity`,
`berth_capacity_notes`, `annual_throughput_notes` (strings, with the year where known).

**Connectivity:** `road_connection`, `rail_connection`, `inland_waterway_connection`, `nearby_airport`.

**Operations:** `hours_of_operation`, `seasonal_limitations`, `major_restrictions`, `website`,
`general_notes`, `vessel_capability`, `vessel_traffic_notes`, `adjacent_facilities`, `under_construction_notes`.

**Provenance:** `research_status`, `confidence_core`, `source_ids` (JSON array; `"; "`-joined
string in CSV/Parquet), `record_path` (identifier of the research record the entry was built from), `last_verified`,
`research_notes`.

**`fields_detail`** (JSON/JSONL only): for each researched field,
`{"value", "confidence", "source", "notes"}` exactly as recorded in the research table. This is the
field-level provenance; it also preserves free-text citations for records without formal
`source_ids`.

**Derived (CSV/Parquet only):** `port_type_primary` (first token of `port_type` without
qualifiers) and `operating_status_primary` (normalised to the vocabulary). These are filtering
conveniences, **not research facts**.

Field coverage varies widely. Share of the 283 records with a value: official name, country, port
type 100%; operating status 92.9%; commercial status 89.0%; primary activity 56.2%; coordinates
51.6%; UN/LOCODE (valid code) 32.2%; port authority 22.3%; max draft 11.3%; terminals 9.9%;
berths 9.2%; tonnage 8.1%; cargo types 6.7%; rail 5.3%; TEU 3.5%; road 3.2%; website 2.5%.
Eight fields (`water_area`, `turning_basin`, `berth_depth_m`, `tidal_restrictions`, `pilotage`,
`tug_availability`, `nearby_airport`, `seasonal_limitations`) have no values in v1.0.0.

### Vocabularies

`operating_status`: `ACTIVE`, `ACTIVE_LIMITED`, `SEASONAL`, `INACTIVE`, `HISTORICAL`,
`UNDER_CONSTRUCTION`, `PROPOSED`, `ABANDONED`, `UNKNOWN`. Planned or disused facilities are
included and labelled, never presented as active. v1.0.0 distribution (primary value): ACTIVE 211,
ACTIVE_LIMITED 16, UNDER_CONSTRUCTION 15, SEASONAL 6, PROPOSED 6, HISTORICAL 3, INACTIVE 3,
UNKNOWN 3, not recorded 20.

`research_status`: `VERIFIED` (own research file, SUPPORTED-or-better core evidence),
`RESEARCHED`, `DISCOVERED` (named in the discovery register, not yet researched), `UNRESOLVED`
(existence or classification not established). Discovery entries are mostly null by construction.

## Confidence levels

| Level | Meaning |
|---|---|
| `CONFIRMED` | Directly supported by a strong primary or authoritative source. |
| `STRONG` | Supported by multiple good sources, or by a highly credible specialist source. |
| `SUPPORTED` | Reasonably supported by credible evidence, not independently confirmed to the highest standard. |
| `UNVERIFIED` | A claim exists but the evidence is insufficient. |
| `CONFLICTING` | Credible sources disagree; the disagreement is preserved. |
| `UNKNOWN` | No usable information was found. |

Repetition across websites that copy one original never raises confidence. A few values carry
verbatim qualifiers (`UNVERIFIED (dated)`, `CONFLICTING / likely stale`); eight researched fields have an empty confidence.
`confidence_core` is the confidence of the record's operating status (falling back to port type).

## Missing-value conventions

- `null` / empty cell: **not established in this research pass**. Not zero, not "none".
- `"UNKNOWN"`: an explicit research conclusion that the value could not be determined.
- `"NONE"`: a positive finding that something does not exist (where used).
- Conflict text: where sources disagree, the disagreement itself may be the value
  (e.g. Dakhla's `unlocode`: "Reported inconsistently as both MAVIL and EHVIC").

## Collection methodology

1. **Discovery** per country across many angles: national port, maritime and fisheries
   authorities, UN/LOCODE listings, maritime directories, development-bank and NGO logistics
   assessments, activity-specific searches (fishing, river, lake, oil/gas, mining, ferry), news.
2. **Scope test:** a real, identifiable, locatable facility used for cargo, passengers, ferries or
   fishing. Excluded (and logged): pure anchorages, recreational-only marinas, naval-only bases,
   wholly informal beach landings, unlocatable entries. **Size and documentation depth are never
   exclusion criteria.**
3. **Verification** against a four-tier source hierarchy (Tier 1 official → Tier 4 discovery-only;
   Tier-4-only claims are capped at `UNVERIFIED`). Numeric figures must carry a date.
4. **Recording** each field with source ID and confidence in a per-port Markdown research file.
5. **Build**: the research corpus is normalised into these files by a script; the corpus remains
   the source of truth.

Much evidence was obtained from search-engine result summaries rather than direct retrieval of the
source document; where that happened the research notes say so and confidence is capped
accordingly (see `research_notes` and `fields_detail.*.notes`).

## Source attribution

`data/sources.csv` lists every formally registered source: `source_id` (e.g. `KE-01`),
`country_file`, `source_name`, `source_url`, `source_type`, `tier`, `accessed_date` and
`what_it_establishes`. Records reference these via `source_ids`. Sources include port authorities,
government ministries, UN/LOCODE listings, maritime databases, trade press, development
organisations, encyclopedias (discovery only) and news media. Facts remain attributable to their
original publishers; each source retains its own terms.

## Validation and data quality

Automated release validation (all checks passing) confirmed: record counts match the
metadata in every format; `port_id` is unique and well-formed; JSON and JSONL are deep-equal;
every CSV and Parquet value matches JSON; derived columns are reproducible; every `source_ids`
entry resolves; every `record_path` resolves to a research record; latitude/longitude are paired and
in range; country codes, names, ISO3 codes and regions are consistent; no duplicate UN/LOCODEs;
the `full` and `sources` Parquet files equal the JSONL and CSV originals value by value.

**These are format and consistency checks. They do not independently re-verify the research.**

### Known issues

Coordinates: the validation compares each record's coordinates with the coordinate text in its own
research table and with approximate country bounds. Before first publication (2026-10-17) it found
8 disagreements caused by sign and degrees-minutes-seconds parsing errors; these, plus Mostaganem
(which carried Arzew's position), were corrected and now agree with the NGA World Port Index.

Other documented issues:

- 28 `VERIFIED` records cite sources only as free text (no `source_ids`); the citation text is in `fields_detail`.
- `TN-sousse` UN/LOCODE `TBSUS` does not start with `TN` (flagged by the research as unverified).
- `MA-dakhla` UN/LOCODE conflict (MAVIL vs EHVIC, reflecting Western Sahara's disputed status);
  Laâyoune has two different reported coordinate sets.
- 4 records have `unlocode = "UNKNOWN"` by design (Cotonou, Abidjan, San-Pédro, Mossel Bay).
- Djibouti DP World concession history; Dakar "3,000 TEU" figure appears stale; Quelimane channel
  draft reported inconsistently.
- Six records have `port_type` `seaport`, which is outside the research specification's type
  list (kept verbatim).

## Coverage limitations

- Depth is uneven by design: major ports have multi-section records; many long-tail facilities
  have 5–9 fields.
- Known remaining gaps: DR Congo river ports, Nigerian historical river-port names, Rwanda's planned
  Lake Kivu ports, Liberia's Greenville, Mozambique's artisanal fishing sites, Chad.
- Burkina Faso, Eswatini and Lesotho have no records after a single research pass; this is not
  proof that none exist.
- Values are as of 2026-08-23; port infrastructure and status change.

## License

ShipPortX is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): free to share and adapt, including commercially,
with attribution ("ShipPortX v1.0.0"). Facts remain attributable to their original sources, which
keep their own terms.

## Citation

```bibtex
@misc{shipportx_2026,
  title  = {ShipPortX: an open, research-derived dataset of African ports},
  year   = {2026},
  note   = {Version 1.0.0, generated 2026-08-23},
  url    = {https://huggingface.co/datasets/<HF_NAMESPACE>/shipportx}
}
```

Please cite ShipPortX as an open reference dataset, not as an authoritative or complete registry.

## Changelog

See [CHANGELOG.md](CHANGELOG.md). **1.0.0** (generated 2026-08-23; packaged 2026-10-14): first
release, 283 records, 51 countries, 193 sources, CSV/JSON/JSONL/Parquet.
