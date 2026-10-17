# ShipPortX v1.0.0: release package

Everything needed to publish ShipPortX v1.0.0, the open dataset of African ports (283 records,
51 countries), built from the files in `../Data` and the separate local research repo `../ShipPortX-Research`. Their only change during release preparation was a punctuation cleanup (em dashes replaced, then rebuilt with the build script); a pre-cleanup backup is in `../_backup-2026-10-14-before-emdash-cleanup/`.

| Folder | What it is | Publish to |
|---|---|---|
| [`website/`](website/README.md) | React + Vite + Tailwind static site: statistics, port explorer, map, downloads, API section, documentation | Netlify |
| [`api/`](api/README.md) | Read-only JSON API for ports worldwide (ShipPortX for Africa, NGA World Port Index elsewhere) as one Netlify Function, plus an edge function that logs usage; also the template for the other X dataset APIs | Netlify (with or without the website) |
| [`huggingface-dataset/`](huggingface-dataset/README.md) | Hugging Face dataset repository: card, data files, three configs | Hugging Face Hub |
| [`github-release/`](github-release/README.md) | Standalone dataset repository: data, docs, validation, examples, issue templates | GitHub |
| [`docs/`](docs/DEPLOYMENT.md) | Deployment guide, architecture decisions, validation report, release manifest | n/a |
| `scripts/` | Release tooling: build artefacts, Parquet twins for HF, validation | n/a |
| `netlify.toml` | Combined deployment (website + API on one site) | n/a |

**Start here:** [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Status

- Built and verified locally: data validation (39/39 checks), API tests (38/38), API bundle check (function, rollup and edge function),
  website production build, lint and dist checks, Hugging Face configs loaded with `datasets`,
  GitHub validator and examples, byte-for-byte reproduction of the data from the research records.
- **Not yet published anywhere.** Netlify, Hugging Face and GitHub publication need your accounts.
- **License:** CC BY 4.0.

## Coordinate fix (2026-10-17, before first publication)

Release validation had found 8 records whose published coordinates disagreed with their own research
notes (e.g. Mombasa published at 4.0475° N; the research says 4.0475° S). The build script now reads
degrees-minutes-seconds in full and reports a minus sign that contradicts its hemisphere letter
(`coordinate_sign_conflict` in `../reports/validation_report.json`); the five research records with
contradictory signs were corrected, and Mostaganem's coordinates (which were Arzew's) were replaced
from the NGA World Port Index. All 9 records now agree with the World Port Index and the
`coords.plausibility` warning is empty. See [docs/validation/VALIDATION_REPORT.md](docs/validation/VALIDATION_REPORT.md).

## Rebuild everything

```bash
npm install && npm --prefix website install && npm --prefix api install
pip install pandas pyarrow
npm run release
```

`npm run release` = `build:data` → `build:hf` → `validate` → `test:api` → `verify:api-bundle`
→ `build:website` → `check:website`.

Release settings (version, dates, license) live in `release.config.json`. The dataset build script is `../scripts/build_dataset.py` (reads `../ShipPortX-Research`, or the folder in `SHIPPORTX_RESEARCH_DIR`; writes `../Data` and `../reports`).
