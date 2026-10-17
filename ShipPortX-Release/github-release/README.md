# ShipPortX

**An open, research-derived dataset of ports and water-transport facilities across Africa.**

ShipPortX covers seaports, river and lake ports, fishing harbours, oil, gas and mining export
terminals, and passenger and ferry terminals: 283 records in 51 countries. Every researched
field carries its source and a confidence level. Small, poorly documented facilities are included
on equal terms with major container ports; their records are simply shorter.

| | |
|---|---|
| Version | **1.0.0** (schema 1.0) |
| Generated / research cut-off | 2026-08-23 |
| Records | 283: 263 `VERIFIED`, 12 `DISCOVERED`, 8 `UNRESOLVED` |
| Countries | 51 (none yet for Burkina Faso, Eswatini, Lesotho) |
| With coordinates | 146 (8 flagged, see [Data quality](docs/DATA_QUALITY.md)) |
| With a 5-character UN/LOCODE | 91 |
| Source register | 193 sources |
| License | [CC BY 4.0](LICENSE) |

> ShipPortX is not an official or exhaustive registry. It is a broad, documented first pass whose
> coverage depends on what is publicly documented.

## Repository layout

```text
.
├── data/                      the dataset (all formats hold the same 283 records)
│   ├── shipportx.csv          flat table, 65 columns
│   ├── shipportx.parquet      same table, typed (lat/lon float64)
│   ├── shipportx.json         metadata envelope + records, with fields_detail provenance
│   ├── shipportx.jsonl        one record per line, with fields_detail provenance
│   ├── sources.csv            the source register (193 sources)
│   └── SHA256SUMS
├── docs/
│   ├── SCHEMA.md              every field, type and convention
│   ├── PROVENANCE.md          sources, confidence levels, methodology
│   ├── DATA_QUALITY.md        validation method, known issues
│   ├── API.md                 the public HTTP API
│   └── methodology/RESEARCH-ShipPortX.md   the original research specification
├── reports/                   build reports (2026-08-23) and the release validation report
├── scripts/
│   ├── validate.mjs           integrity checks for data/ (Node.js)
│   └── lib/                   helpers used by validate.mjs and the examples
├── examples/                  JavaScript and Python usage examples
├── CHANGELOG.md · CONTRIBUTING.md · CITATION.cff
```

| File | Role |
|---|---|
| `data/shipportx.parquet` | Best for analysis (pandas, Polars, DuckDB, Spark). |
| `data/shipportx.csv` | Spreadsheets and quick inspection. Empty cell = null; lists joined with `"; "`. |
| `data/shipportx.json` | Web apps and full provenance; includes dataset metadata. |
| `data/shipportx.jsonl` | Streaming; Hugging Face `datasets`; includes provenance. |
| `data/sources.csv` | Resolve `source_ids` to source names, URLs and evidence tiers. |

## Quick start

### Python

```bash
pip install -r requirements.txt
python examples/python/load_pandas.py
python examples/python/load_json.py
```

```python
import pandas as pd

df = pd.read_parquet("data/shipportx.parquet")
verified = df[df["research_status"] == "VERIFIED"]
lake_ports = df[df["port_type_primary"] == "lake_port"]
with_coords = df.dropna(subset=["latitude", "longitude"])
```

### JavaScript (Node.js 20+)

```bash
npm install          # only needed for Parquet support in scripts/validate.mjs
npm run example:json
npm run example:csv
```

```js
import { readFileSync } from 'node:fs';
const { version, records } = JSON.parse(readFileSync('data/shipportx.json', 'utf8'));
const active = records.filter((r) => r.operating_status === 'ACTIVE');
```

### HTTP API

If you deploy the ShipPortX API (or use a public deployment once announced):

```bash
curl "https://<api-host>/api/v1/ports?country=KE&operating_status=ACTIVE&limit=5"
curl "https://<api-host>/api/v1/ports/KE-mombasa"
SHIPPORTX_API=https://<api-host> npm run example:api
```

See [docs/API.md](docs/API.md).

## Key conventions

- **`port_id` is stable** (`{ISO2}-{slug}`, e.g. `GH-tema`) and is never reused.
- **`null` means "not established in this research pass"**, not zero or "none".
  `"UNKNOWN"` is an explicit research conclusion; `"NONE"` a positive finding of absence.
- **Values are as published by the research**, often text with context (e.g. `max_draft_m` =
  "15 metres (sufficient for Panamax vessels)"), not parsed numbers.
- **`port_type_primary` / `operating_status_primary`** (CSV/Parquet) are filtering conveniences
  derived from the verbatim values, not research facts.
- **Field-level confidence** (`CONFIRMED`, `STRONG`, `SUPPORTED`, `UNVERIFIED`, `CONFLICTING`,
  `UNKNOWN`) is in `fields_detail` (JSON/JSONL).

Full details: [docs/SCHEMA.md](docs/SCHEMA.md) and [docs/PROVENANCE.md](docs/PROVENANCE.md).

## Validation

```bash
npm install
npm run validate
```

Checks record counts, identifier uniqueness, cross-format equality (JSON ⇄ JSONL ⇄ CSV ⇄ Parquet),
coordinates, source references and research-file paths, and prints known quality findings.
**These are format checks, not an independent re-verification of the research.** The release
report is in [reports/release-validation-report.md](reports/release-validation-report.md).

**Coordinate fix:** 8 records whose coordinates disagreed with their own research notes (e.g. Mombasa
at 4.0475° N instead of 4.0475° S), plus Mostaganem, were corrected before first publication. See
[docs/DATA_QUALITY.md](docs/DATA_QUALITY.md).

## Releases and size

All data files total about 2.3 MB, so they are kept in Git. Each release is tagged (`v1.0.0`); attach the five `data/` files and `SHA256SUMS` to the
GitHub release for direct download. The same files are mirrored on Hugging Face and on the
ShipPortX website.

## Contributing and reporting issues

Corrections with a public source are very welcome, see [CONTRIBUTING.md](CONTRIBUTING.md) and the
issue templates (data correction, missing port, documentation/tooling problem).

## License

ShipPortX is licensed under **CC BY 4.0** ([LICENSE](LICENSE)): free to share and adapt, including
commercially, with attribution ("ShipPortX v1.0.0"). Facts remain attributable to their original
sources, which keep their own terms.

## Citation

See [CITATION.cff](CITATION.cff). Please cite ShipPortX as an open reference dataset
("ShipPortX v1.0.0, generated 2026-08-23"), not as an authoritative or complete registry.
