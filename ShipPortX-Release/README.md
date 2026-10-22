# ShipPortX v1.0.0: release package

Everything needed to publish ShipPortX v1.0.0, the open dataset of African ports (283 records,
51 countries), built from the files in `../Data` and the separate local research repo `../ShipPortX-Research`. Their only change during release preparation was a punctuation cleanup (em dashes replaced, then rebuilt with the build script); a pre-cleanup backup is in `../_backup-2026-10-14-before-emdash-cleanup/`.

| Folder | What it is | Publish to |
|---|---|---|
| [`huggingface-dataset/`](huggingface-dataset/README.md) | Hugging Face dataset repository: card, data files, three configs | Hugging Face Hub |
| [`github-release/`](github-release/README.md) | Standalone dataset repository: data, docs, validation, examples, issue templates | GitHub |
| [`docs/`](docs/DEPLOYMENT.md) | Publication guide, architecture decisions, validation report, release manifest | n/a |
| `scripts/` | Release tooling: build artefacts, Parquet twins for HF, validation | n/a |

The website and the API (Netlify) are built from this dataset in a separate private repo, `shipportx-web-api`.

**Start here:** [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) → [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Status

- Built and verified locally: data validation, Hugging Face configs loaded with `datasets`,
  GitHub validator and examples, byte-for-byte reproduction of the data from the research records.
- Hugging Face publication needs the maintainer's account. The website and API are checked in the private `shipportx-web-api` repo.
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
npm install
pip install pandas pyarrow
npm run release
```

`npm run release` = `build:worldwide` → `build:data` → `build:hf` → `validate`. Then run `npm run release` in the private
`shipportx-web-api` repo to rebuild the website and API data from the new files.

Release settings (version, dates, license) live in `release.config.json`. The dataset build script is `../scripts/build_dataset.py` (reads `../ShipPortX-Research`, or the folder in `SHIPPORTX_RESEARCH_DIR`; writes `../Data` and `../reports`).
