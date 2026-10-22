# Architecture and decisions: ShipPortX v1.0.0 release

## Single source of truth

```text
../Data/shipportx.{json,jsonl,csv,parquet}, ../Data/sources.csv     (v1.0.0 build; edited only by the 2026-10-14 punctuation cleanup)
../ShipPortX-Research/ShipPortX/                                         (research corpus; same cleanup, backup kept)
        │
        │ scripts/build-release.mjs   (Node)       scripts/build_hf_parquet.py (pyarrow)
        ▼                                          ▼
huggingface-dataset/data/  (byte-identical copies + 2 Parquet twins for HF configs)
github-release/data/, reports/, scripts/lib/
        │
        ▼
scripts/validate.mjs → docs/validation/  (+ github-release/reports/)
```

The private `shipportx-web-api` repo builds the website data, downloads and API module from the same
`../Data` files (its `scripts/build-web-api.mjs`), so every published number there is computed from the
original files too.

## Decisions

| Decision | Reason |
|---|---|
| Copy dataset files byte-for-byte; never "fix" them | The brief requires preserving source data; corrections belong in a versioned data release with the build script fixed. |
| Report quality problems as `quality_flags` instead of altering values | Users of the API and website see the warning; the files remain the faithful v1.0.0 output. |
| Keep coordinate-flagged records off the map | Plotting known-wrong coordinates would mislead; the records remain in the explorer, API and files (the website is in the private repo). The original 8 were fixed at source on 2026-10-17, so none are withheld now; the rule stays for future flags. |
| Take `port_type_primary` / `operating_status_primary` from the original CSV; derive `commercial_status_primary` with the same rule | Reuses the dataset's own convention for filtering; documented as non-research convenience values. |
| HF configs all Parquet (twins generated with pyarrow, explicit schema) | `datasets` infers one loader for all configs of a repo; JSON inference would otherwise retype date strings. Twins are validated value-by-value against JSONL/CSV. |
| Keep the research corpus out of the GitHub package | Maintainer decision; `record_path` stays as an identifier and the build remains reproducible locally from the separate `../ShipPortX-Research` repo with `../scripts/build_dataset.py`. |
| CC BY 4.0 | Maintainer choice; common for open datasets and supported natively by Hugging Face and GitHub. |

The decisions about the website and the API are in `docs/ARCHITECTURE.md` of the private `shipportx-web-api` repo.

## AIFlare platform note

ShipPortX is a public, anonymous, read-only open-data set with a site and API. It has no accounts,
sessions, profiles, roles or billing, so no Apalis identity integration is required for v1.0.0.
If authenticated features are added later (e.g. contributor submissions), they should use
Apalis per the AIFlare Integration Framework rather than a local identity system.
