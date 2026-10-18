# ShipPortX

**An open, research-derived dataset of ports and water-transport facilities across Africa, with a
worldwide port index for routing and lookup.**

ShipPortX covers seaports, river and lake ports, fishing harbours, oil, gas and mining export
terminals, and passenger and ferry terminals: 283 records in 51 African countries. Every
researched field carries its source and a confidence level. Small, poorly documented facilities
are included on equal terms with major container ports; their records are simply shorter.

| | |
|---|---|
| Version | **1.0.0** (generated 2026-08-23) |
| Records | 283: 263 `VERIFIED`, 12 `DISCOVERED`, 8 `UNRESOLVED` |
| Countries | 51 |
| Source register | 193 sources |
| Worldwide index (API only) | 3,145 ports: ShipPortX for Africa plus the NGA World Port Index elsewhere |
| Formats | CSV, JSON, JSONL, Parquet, plus `sources.csv` |
| License | Data and docs [CC BY 4.0](LICENSE); code MIT |

> ShipPortX is not an official or exhaustive registry. It is a broad, documented first pass whose
> coverage depends on what is publicly documented. Not for navigation or safety-of-life decisions.

## Get the data

- **Files:** [`Data/`](Data) holds the dataset. The same files, with checksums, docs, validation
  and examples, are packaged in [`ShipPortX-Release/github-release/`](ShipPortX-Release/github-release/README.md).
- **Hugging Face:** dataset card and Parquet configs in
  [`ShipPortX-Release/huggingface-dataset/`](ShipPortX-Release/huggingface-dataset/README.md)
  (upload steps in `PUBLISHING.md` there).
- **Website and API:** a static explorer and map, and a read-only JSON API for the worldwide index,
  are in [`ShipPortX-Release/`](ShipPortX-Release/README.md).

```python
import pandas as pd

df = pd.read_parquet("Data/shipportx.parquet")
verified = df[df["research_status"] == "VERIFIED"]
kenya = df[df["country_code"] == "KE"]
```

## What is in this repository

| Path | Contents |
|---|---|
| `Data/` | Published Africa dataset: `shipportx.csv`, `.json`, `.jsonl`, `.parquet`, `sources.csv` |
| `Worldwide/` | Generated worldwide port index (ShipPortX plus NGA World Port Index), served by the API |
| `External/wpi/` | Dated snapshot of the NGA World Port Index used to build `Worldwide/` |
| `reports/` | Build, field-inventory, validation and merge reports |
| `scripts/` | `build_dataset.py` (builds `Data/` from the research records, which are kept private), `import_wpi.py`, `build_worldwide.py` and their tests (`python -m unittest discover scripts`) |
| `ShipPortX-Release/` | Website, API, Hugging Face package, GitHub package, validation and release tooling |

## Known limits

Depth is uneven by design. Coordinates exist for about half the records. Burkina Faso, Eswatini
and Lesotho have no records yet. See
[`DATA_QUALITY.md`](ShipPortX-Release/github-release/docs/DATA_QUALITY.md).

## Contributing

Corrections and missing ports with a public source are welcome: see
[`CONTRIBUTING.md`](ShipPortX-Release/github-release/CONTRIBUTING.md).

## License and citation

Dataset, documentation and reports: CC BY 4.0, cite as "ShipPortX v1.0.0" (see
[`CITATION.cff`](ShipPortX-Release/github-release/CITATION.cff)). Scripts, API and website code:
MIT. Worldwide data from the NGA World Port Index is public domain; credit it. Facts remain
attributable to their original sources, which keep their own terms.
