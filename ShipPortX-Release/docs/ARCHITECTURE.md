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
website/public/downloads/v1.0.0/  (byte-identical copies)
website/public/data/v1.0.0/       (index.json, ports/<id>.json, sources.json)
website/src/generated/api-examples.json   (captured from the real API handler)
api/src/data/dataset.generated.mjs        (records + derived fields + quality_flags)
        │
        ▼
scripts/validate.mjs → docs/validation/  (+ github-release/reports/)
```

Every published number on the website, API and dataset cards is computed from the original files.

## Decisions

| Decision | Reason |
|---|---|
| Copy dataset files byte-for-byte; never "fix" them | The brief requires preserving source data; corrections belong in a versioned data release with the build script fixed. |
| Report quality problems as `quality_flags` instead of altering values | Users of the API and website see the warning; the files remain the faithful v1.0.0 output. |
| Keep coordinate-flagged records off the map | Plotting known-wrong coordinates would mislead; the records remain in the explorer, API and files. The original 8 were fixed at source on 2026-10-17, so none are withheld now; the rule stays for future flags. |
| Take `port_type_primary` / `operating_status_primary` from the original CSV; derive `commercial_status_primary` with the same rule | Reuses the dataset's own convention for filtering; documented as non-research convenience values. |
| One Netlify Function for all `/api` routes, data bundled as a JS module | Dataset parsed and indexed once per warm instance; no file-path issues in Lambda; no database or paid service. |
| CDN caching of API responses, purged on deploy | Keeps free-tier function usage low without stale data. |
| Static JSON for the website (compact index + per-port files) rather than calling the API | The site works with or without the API, loads ~90 KB up front, and costs no function invocations. |
| Multi-page Vite build (`/`, `/docs/`, `404.html`) instead of a client router | No SPA rewrite rules that could shadow `/api/*`; plain static hosting. |
| Leaflet (lazy-loaded) with OpenStreetMap tiles, CSS-darkened | Free-to-start, no key; CARTO now requires an API key. Provider configurable via env vars. |
| Self-hosted fonts via @fontsource | No third-party font requests; consistent typography offline. |
| HF configs all Parquet (twins generated with pyarrow, explicit schema) | `datasets` infers one loader for all configs of a repo; JSON inference would otherwise retype date strings. Twins are validated value-by-value against JSONL/CSV. |
| Keep the research corpus out of the GitHub package | Maintainer decision; `record_path` stays as an identifier and the build remains reproducible locally from the separate `../ShipPortX-Research` repo with `../scripts/build_dataset.py`. |
| CC BY 4.0 | Maintainer choice; common for open datasets and supported natively by Hugging Face and GitHub. |
| Optional links (HF, GitHub, email) driven by env vars and hidden when unset | No dead links or invented accounts. |
| (2026-10-17) API serves a worldwide index: ShipPortX for Africa, NGA World Port Index elsewhere | Tools need ports outside Africa. The published dataset stays Africa-only; the merge (`../scripts/build_worldwide.py`) never overwrites ShipPortX values and tags every record with `source` and `scope`. |
| (2026-10-17) One summary schema for list responses; the full ShipPortX record only under `shipportx` on the detail endpoint | The two sources have different fields (ShipPortX drafts are free text), so mixing them in one list would give one field two types. |
| (2026-10-17) Usage logged by an Edge Function before the CDN cache, via the Firestore REST API | Cached calls never reach the function, so only the edge sees every call. firebase-admin does not run on Deno; a small fetch + WebCrypto client does, and keeps the edge bundle at about 11 KiB. No IP addresses stored. |
| (2026-10-17) Hourly idempotent rollup (hour documents, days rebuilt from hours) | Each raw call is read once, keeping Firestore reads within the free quota; re-running an hour rewrites the same documents. |
| (2026-10-17) Generic API code in `api/src/core/` is the template for every X dataset API | Build once, reuse: C18 to C21 copy it unchanged (`api/API_TEMPLATE.md`). It lives here, not in xtoolkit, because the dataset repos are independent; moving it into xtoolkit is a later option. |

## AIFlare platform note

ShipPortX is a public, anonymous, read-only open-data site and API. It has no accounts,
sessions, profiles, roles or billing, so no Apalis identity integration is required for v1.0.0.
If authenticated features are added later (e.g. contributor submissions), they should use
Apalis per the AIFlare Integration Framework rather than a local identity system.
