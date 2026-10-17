# Sources, provenance and methodology

## How a record is built

```text
discovery register (per country)   every candidate found, with its status
        │  research
        ▼
research record (per port)         | Field | Value | Confidence | Source | Notes |
        │  build script
        ▼
data/shipportx.{csv,parquet,json,jsonl}   normalised records (+ fields_detail in JSON/JSONL)
data/sources.csv                          built from the per-country source registers
```

The research records are the source of truth; the data files are derived from them by a script
and are reproducible byte-for-byte. `record_path` identifies the research record each entry came
from. The research records themselves are kept by the maintainers and are not part of this
repository.

## Methodology (summary)

The full specification is [`methodology/RESEARCH-ShipPortX.md`](methodology/RESEARCH-ShipPortX.md).

1. **Breadth-first discovery** in every African country, deliberately looking beyond "major
   ports": national port, maritime and fisheries authorities, railway and customs authorities,
   UN/LOCODE listings, maritime directories, development-bank and NGO logistics assessments, and
   activity-specific searches (fishing harbours, river and lake ports, oil/gas/LNG terminals,
   mining and bulk terminals, ferry and passenger ports).
2. **Scope test.** In scope: any real, identifiable facility used for cargo, passengers, ferries
   or fishing, including inactive, historical, under-construction and proposed facilities,
   which are labelled as such. Out of scope (logged in an exclusions register): pure
   anchorages, recreational-only marinas, naval-only bases, wholly informal beach landings and
   unlocatable entries. **Size, fame and documentation depth are never exclusion criteria.**
3. **Verification** against a source hierarchy (below). A port becomes `VERIFIED` once country,
   settlement, port type and operating status reach at least `SUPPORTED`.
4. **Recording** with per-field source IDs and confidence. Numeric figures must carry a date;
   undated figures are capped at `UNVERIFIED`. Values are never estimated or inferred beyond the
   source, `UNKNOWN` is written instead.
5. **Unresolved** candidates stay in the discovery register (`DISCOVERED` / `UNRESOLVED`) rather
   than being dropped or padded.

Much evidence was gathered from search-engine result summaries rather than direct retrieval of the
source document; the notes record where this happened, and confidence is capped accordingly.

## Source hierarchy

| Tier | Examples | Use |
|---|---|---|
| 1 | Port/harbour authorities, fisheries and transport ministries, official gazettes, port master plans, concession documents, environmental/social impact assessments, UNECE UN/LOCODE | Authoritative |
| 2 | Maritime databases (World Port Source, MarineTraffic, MagicPort…), maritime trade press, AfDB/World Bank/IFC studies, NGO/humanitarian logistics assessments | Strong specialist evidence; cross-checking |
| 3 | National and regional newspapers, business publications | Secondary |
| 4 | Wikipedia, generic directories, aggregators, mapping references | Discovery only; alone it caps confidence at `UNVERIFIED` |

## Confidence levels

| Level | Meaning |
|---|---|
| `CONFIRMED` | Directly supported by a strong primary or authoritative source. |
| `STRONG` | Supported by multiple good sources, or by a highly credible specialist source. |
| `SUPPORTED` | Reasonably supported by credible evidence, not independently confirmed to the highest standard. |
| `UNVERIFIED` | A claim exists but the evidence is insufficient. |
| `CONFLICTING` | Credible sources disagree; the disagreement is preserved. |
| `UNKNOWN` | No usable information was found. |

Repetition across sites that copy one original does not raise confidence. Across all
`fields_detail` entries in 1.0.0: CONFIRMED 1,119 · STRONG 550 · SUPPORTED 496 · UNVERIFIED 24 ·
UNKNOWN 15 · CONFLICTING 6 · `UNVERIFIED (dated)` 1 · `CONFLICTING / likely stale` 1 · empty 8.

## The source register (`data/sources.csv`)

| Column | Meaning |
|---|---|
| `source_id` | `{ISO2}-{NN}`, e.g. `KE-01`. Unique. |
| `country_file` | Country register the source belongs to. |
| `source_name` | Publisher and title. |
| `source_url` | URL(s); several may be separated by `;`. |
| `source_type` | e.g. Port authority, Trade press, Encyclopedia. |
| `tier` | 1–4 (sometimes a range, e.g. `2/3`). |
| `accessed_date` | When it was accessed (may note "search summaries" when the page itself was not read). |
| `what_it_establishes` | The facts this source supports. |

Every `source_ids` entry in the dataset resolves to this register. 28 `VERIFIED` records cite
sources only as free text (e.g. a named government programme); that text is preserved in
`fields_detail.*.source`.

## Attribution

Facts in ShipPortX are compiled from the sources above; each source keeps its own terms. When
reusing a specific value, cite the original source listed for that field as well as ShipPortX.
