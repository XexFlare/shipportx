# ShipPortX v1.0.0: Deployment and publication guide

All paths are relative to the release root (`ShipPortX-Release/`). Commands are for a POSIX shell
(Git Bash on Windows works). Nothing in this guide has been executed against Netlify, Hugging
Face or GitHub yet, those steps need your accounts.

Prerequisites: Node.js 20.19+ (22 recommended), npm, Git; Python 3.10+ with `pyarrow` only if you
need to regenerate the Hugging Face Parquet files.

```text
ShipPortX-Release/
├── netlify.toml          ← combined site: website + API on one Netlify site (recommended)
├── website/              ← React/Vite/Tailwind static site (own netlify.toml for standalone)
├── api/                  ← Netlify Function API (own netlify.toml for standalone)
├── huggingface-dataset/  ← Hugging Face dataset repository
├── github-release/       ← GitHub dataset repository
├── scripts/              ← release tooling (build, validate)
└── docs/                 ← this guide, validation report, release manifest
```

---

## 0. Rebuild and verify everything locally (optional but recommended)

The generated artefacts are already in place. Rebuild them if the dataset changes:

```bash
npm install                          # release tooling (hyparquet)
npm --prefix website install
npm --prefix api install
pip install pyarrow                  # only for build:hf

npm run release
# = build:data → build:hf → validate → test:api → verify:api-bundle → build:website → check:website
```

Every step must pass. Results: `docs/validation/VALIDATION_REPORT.md`.

---

## 1. Website

### 1.1 Install dependencies

```bash
cd website
npm install
```

### 1.2 Run locally

```bash
npm run dev            # http://localhost:5173
```

> In this workspace, development servers are managed by **StarLaunch**: register `website/`
> with StarLaunch and start it there instead of running `npm run dev` directly, to avoid duplicate
> processes and port conflicts. The dev server serves the website only; `/api` calls need the
> API (see §2.4) or `VITE_API_BASE_URL`.

### 1.3 Build for production

```bash
npm run build          # → website/dist
npm run check:dist     # required pages, data files, downloads, no leaked local paths
npm run lint
```

### 1.4 Deploy to Netlify

**Option A, website + API together (recommended).** One site, same origin, no CORS settings.

Netlify UI (from a Git repository containing the release root, see §4.4 for how to create one):

1. *Add new site → Import an existing project* → choose the repository.
2. *Base directory*: the folder that contains `ShipPortX-Release/netlify.toml` (the repository
   root if you pushed the release root as the repo). Leave build command and publish directory
   empty, `netlify.toml` sets them:
   - Build command: `npm --prefix website ci && npm --prefix website run build`
   - Publish directory: `website/dist`
   - Functions directory: `api/netlify/functions`
3. *Deploy*.

Netlify CLI (no Git needed):

```bash
npm install -g netlify-cli
netlify login
cd ShipPortX-Release          # the release root
netlify init                  # or: netlify sites:create --name shipportx
netlify deploy --build        # draft deploy, prints a preview URL, check it
netlify deploy --build --prod # production
```

**Option B, website only.** *Base directory* `website` (uses `website/netlify.toml`), or
`cd website && netlify deploy --build --prod`. Set `VITE_API_BASE_URL` to a separately deployed
API (§2), otherwise the "Send this request live" button on the site reports that the API is not
reachable, every other feature works without the API.

### 1.5 Environment variables (optional)

Netlify → *Site configuration → Environment variables*, or `netlify env:set NAME value`.
Rebuild after changing them (they are compiled into the static site).

| Variable | When to set |
|---|---|
| `VITE_HF_DATASET_URL` | After publishing to Hugging Face, e.g. `https://huggingface.co/datasets/<ns>/shipportx` |
| `VITE_GITHUB_REPO_URL` | After publishing to GitHub, enables issue and research-file links |
| `VITE_CONTACT_EMAIL` | If you want a public contact address shown |
| `VITE_API_BASE_URL` | Only when the API is on a different site |
| `VITE_MAP_TILE_URL`, `VITE_MAP_TILE_ATTRIBUTION`, `VITE_MAP_TILE_DARKEN` | To use a different tile provider (see §5) |

Links whose variables are unset are hidden, never rendered as dead links.

### 1.6 Custom domain (optional)

1. Netlify → *Domain management → Add a domain* → e.g. `shipportx.example.org`.
2. At your DNS provider add `CNAME shipportx → <site-name>.netlify.app` (or delegate the domain to
   Netlify DNS; apex domains use Netlify's `A`/`ALIAS` instructions shown in the UI).
3. Wait for DNS, then Netlify provisions HTTPS automatically (Let's Encrypt). Enable *Force HTTPS*.

### 1.7 Verify the published site

```bash
SITE=https://<your-site>.netlify.app
curl -sI $SITE/ | head -1                                        # HTTP/2 200
curl -sI $SITE/docs/ | head -1                                   # 200
curl -s  $SITE/data/v1.0.0/index.json | head -c 120; echo        # {"metadata":...
curl -sI $SITE/downloads/v1.0.0/shipportx.parquet | grep -i content-type
curl -s  $SITE/downloads/v1.0.0/SHA256SUMS
curl -sI $SITE/does-not-exist | head -1                          # 404 (custom page)
```

Manual checks: hero and statistics show 283 records / 51 countries / 146 with coordinates /
91 UN/LOCODE; the explorer filters and paginates; a port opens with `?port=GH-tema`; the map shows
138 plotted markers with tiles; each download link downloads; `/docs/` sections load (schema
counts, flagged records, source register); the mobile menu works at phone width.

---

## 2. API

### 2.1 Architecture

```text
Data/*.json/csv  ──npm run build:data──►  api/src/data/dataset.generated.mjs  (records + derived fields + quality_flags)
                                                   │ bundled by esbuild into the function
Worldwide/ports-worldwide.json  ──npm run build:data──►  api/src/data/worldwide.generated.mjs  (ShipPortX + World Port Index)
api/netlify/functions/api.mjs  (config.path: /api, /api/*)  →  api/src/handler.mjs  (router, filters, pagination, errors, CORS)
api/netlify/edge-functions/api-log.mjs  (/api, /api/*, before the cache)  →  Firestore usage log (optional, §2.9)
api/netlify/functions/api-rollup.mjs  (hourly)  →  hourly and daily usage summaries for /api/stats and /stats/
```

- **Static dataset, serverless logic.** There is no database for the data. The data (~2.4 MB, Africa plus the worldwide index) is embedded in
  the function bundle and parsed once per warm function instance; indexes for search and lookup
  are built at the same time.
- **One function, every route.** Netlify Functions v2 routing (`config.path`) maps `/api` and
  `/api/*` to the function, so no redirect rules are needed.
- **Static files where they are enough.** Bulk downloads are static files
  (`/downloads/v1.0.0/*`) and the website reads static JSON (`/data/v1.0.0/*`), neither uses a
  function invocation. The function only serves query-style requests.
- **Caching.** Successful responses carry `Netlify-CDN-Cache-Control: public, durable,
  max-age=86400, stale-while-revalidate=604800` and `Netlify-Vary: query`, so repeated identical
  requests are answered from Netlify's CDN. Netlify invalidates this cache on every deploy, so a
  new dataset version is visible immediately. `/api/health` and errors are never cached.

### 2.2 Install

```bash
cd api
npm install            # dev dependency only (esbuild for the bundle check); no runtime deps
```

### 2.3 Test

```bash
npm test               # 38 tests: endpoints, filters, client, 400/404/405, CORS, HEAD, usage log, Firestore client, edge function
npm run verify:bundle  # bundle like Netlify does (functions for Node, edge function for Deno), then call them
```

### 2.4 Run under the Netlify runtime locally (optional)

```bash
cd ShipPortX-Release           # combined: website + API at http://localhost:8888
npx netlify-cli dev
curl http://localhost:8888/api/health
```

(Register with StarLaunch rather than leaving this running.)

### 2.5 Deploy

- **Together with the website:** §1.4 Option A: nothing extra to do.
- **Standalone:** Netlify *Base directory* `api` (uses `api/netlify.toml`: publish `public`,
  functions `netlify/functions`), or:

  ```bash
  cd api
  netlify deploy --prod        # no build step; deploys public/ + the function
  ```

  Then set `VITE_API_BASE_URL=https://<api-site>.netlify.app` on the website site and rebuild it.

### 2.6 Verify the live endpoints

```bash
API=https://<your-site>.netlify.app
curl -s "$API/api/health"                                              # {"status":"ok","version":"1.0.0","record_count":283,...}
curl -s "$API/api/v1/ports?limit=1" | head -c 300; echo
curl -s "$API/api/v1/ports?country=KE&operating_status=ACTIVE" | grep -o '"total": [0-9]*'
curl -s "$API/api/v1/ports/GH-tema" | grep -o '"official_name": "[^"]*"'
curl -s -o /dev/null -w "%{http_code}\n" "$API/api/v1/ports/XX-none"   # 404
curl -s -o /dev/null -w "%{http_code}\n" "$API/api/v1/ports?limit=500" # 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$API/api/v1/ports"   # 405
curl -sI -H "Origin: https://example.org" "$API/api/v1/countries" | grep -i access-control-allow-origin   # *
curl -s "$API/api/v1/metadata" | grep -o '"record_count": [0-9]*'
curl -s "$API/api/v1/ports?q=rotterdam&client=deploy-check" | grep -o '"source": "[a-z]*"' | head -1   # "wpi"
curl -s "$API/api/v1/ports/index?scope=africa" | head -c 200; echo
curl -s -o /dev/null -w "%{http_code}
" "$API/api/stats"                  # 401 without the token
```

### 2.7 Routing, CORS and troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/api/...` returns the website's 404 page | Functions directory not picked up. Check the deploy log lists the `api` function; confirm the site uses the release-root `netlify.toml` (Base directory) or `api/netlify.toml`. |
| `/api/...` returns HTML in the browser on a website-only site | The API is not deployed there, set `VITE_API_BASE_URL` (Option B). |
| CORS error in a browser app | Responses send `Access-Control-Allow-Origin: *`. A CORS error usually hides a network error or an HTML (non-API) response, check the URL. |
| Old data after a dataset update | Rebuild artefacts (`npm run build:data`) **and** redeploy; the CDN cache is purged on deploy. |
| `400 unknown_parameter` | Typo in a query parameter; the message lists allowed ones. |
| Function bundling error | Run `npm --prefix api run verify:bundle` locally; make sure `api/src/data/dataset.generated.mjs` exists (it is generated by `npm run build:data`). |
| Build fails with `Cannot find module` in website | Netlify needs `website/package-lock.json`; keep it in the repository. |

### 2.8 Free-tier constraints and keeping usage low

Netlify plans and limits change; check https://www.netlify.com/pricing/ before launch. Since
2025, new accounts are on credit-based plans in which bandwidth, web requests, function compute
and production deploys all draw from a monthly allowance; older accounts may still be on the
legacy free plan (100 GB bandwidth, 300 build minutes and 125,000 function invocations per
month). In either model:

- Downloads and the website's data are static files: they cost bandwidth, not function calls.
  Bulk users should download files rather than page the API.
- API responses are CDN-cached for a day (purged on deploy), so popular queries rarely invoke the
  function.
- `limit` is capped at 100 to keep responses small.
- Avoid unnecessary production deploys (each consumes build minutes/credits); use draft deploys
  (`netlify deploy --build`) to preview.
- Set usage notifications in Netlify (*Team settings → Usage*).

### 2.9 Usage logging (optional, recommended)

Every `/api` call is logged by the edge function before the CDN cache (no IP addresses; see
`api/README.md`). Without these settings the API works and logs nothing.

1. Use the Firebase project of the xtoolkit usage log (or create one). In Google Cloud console,
   *IAM & Admin → Service accounts*, create a service account with the **Cloud Datastore User**
   role and download a JSON key.
2. Netlify, *Site configuration → Environment variables*:
   - `FIREBASE_SERVICE_ACCOUNT` = the key file's JSON on one line.
   - `STATS_TOKEN` = a long random string (e.g. `openssl rand -hex 32`).
3. Firestore, *TTL policies*: add collection group `calls`, timestamp field `expireAt` (raw calls
   are then deleted after 90 days). Once per project.
4. Redeploy. Call the API with `?client=deploy-check`; after the next hour, open `/stats/` and
   enter the token.

Cost: one Firestore write per API call, one read per call when the hourly rollup runs, and one
read per day shown on the stats page. Firestore's free daily quota (20,000 writes, 50,000 reads)
covers about 20,000 calls a day.

---

## 3. Hugging Face

The repository content is `huggingface-dataset/`. Full instructions: `huggingface-dataset/PUBLISHING.md`.

1. Replace every `<HF_NAMESPACE>` in `huggingface-dataset/README.md` (the license is already set to CC BY 4.0).
2. Create a public dataset repository and upload:

   ```bash
   pip install -U "huggingface_hub[cli]"
   hf auth login
   hf repo create <HF_NAMESPACE>/shipportx --repo-type dataset
   hf upload <HF_NAMESPACE>/shipportx huggingface-dataset . --repo-type dataset --commit-message "ShipPortX v1.0.0"
   ```

3. Review the rendered dataset card and the dataset viewer (configs `default`, `full`, `sources`).
4. Verify:

   ```python
   from datasets import load_dataset
   assert load_dataset("<HF_NAMESPACE>/shipportx", split="train").num_rows == 283
   assert "fields_detail" in load_dataset("<HF_NAMESPACE>/shipportx", "full", split="train").column_names
   assert load_dataset("<HF_NAMESPACE>/shipportx", "sources", split="train").num_rows == 193
   ```

5. Set `VITE_HF_DATASET_URL` on the website and redeploy.

The three configs were tested locally with `datasets` 5.1.0 (all load; 283/283/192 rows).

---

## 4. GitHub

The repository content is `github-release/`.

### 4.1 Before the first commit

- `github-release/LICENSE` (CC BY 4.0) is already in place. The research corpus is intentionally
  not included.

### 4.2 Initialise, commit, tag, push

```bash
cd github-release
git init -b main
git add .
git status                      # review: data/, docs/, reports/, scripts/, examples/, .github/ …
git commit -m "ShipPortX v1.0.0"
git tag -a v1.0.0 -m "ShipPortX v1.0.0 (dataset generated 2026-08-23)"

# create an empty repository named shipportx on GitHub first (no README/license), or:
gh repo create <OWNER>/shipportx --public --source . --remote origin
git remote add origin https://github.com/<OWNER>/shipportx.git   # skip if gh created it
git push -u origin main
git push origin v1.0.0
```

### 4.3 GitHub release with downloadable files

```bash
gh release create v1.0.0 \
  data/shipportx.csv data/shipportx.parquet data/shipportx.json data/shipportx.jsonl \
  data/sources.csv data/SHA256SUMS \
  --title "ShipPortX v1.0.0" --notes-file CHANGELOG.md
```

Then: enable Issues (templates are in `.github/ISSUE_TEMPLATE/`), add topics (`africa`, `ports`,
`open-data`, `maritime`, `dataset`), and set `VITE_GITHUB_REPO_URL` on the website.

### 4.4 Optional: a repository for the website and API

To deploy from Git (instead of the CLI), push the release tooling, website and API as their own
repository, e.g. `shipportx-site`:

```bash
cd ShipPortX-Release
git init -b main
git add netlify.toml package.json package-lock.json release.config.json .gitignore README.md RELEASE_CHECKLIST.md \
        scripts website api docs
git commit -m "ShipPortX site and API v1.0.0"
```

`scripts/build-release.mjs` reads the original `../Data` folder and the separate `../ShipPortX-Research` repo; those are not
needed on Netlify because every generated file (website data, downloads, API data module) is
committed.

---

## 5. Map tiles

The website uses OpenStreetMap's standard tiles by default (`tile.openstreetmap.org`), darkened
with a CSS filter. Requirements and limits ([OSMF Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/)):
visible attribution (shown on the map), moderate use only, no bulk downloading or offline
prefetching; the OSMF may block heavy users. For production traffic, use a provider account
(MapTiler, Stadia Maps, Thunderforest, etc.) via `VITE_MAP_TILE_URL` and
`VITE_MAP_TILE_ATTRIBUTION`, and set `VITE_MAP_TILE_DARKEN=false` for a natively dark style.
CARTO basemaps returned an "API key required" placeholder without an account during testing,
so they are not the default. If tiles fail, the map shows a notice and still plots ports.

---

## 6. Final verification after deployment

```bash
SITE=https://<your-site>.netlify.app

# Website and data
for p in / /docs/ /data/v1.0.0/index.json /downloads/v1.0.0/shipportx.csv /downloads/v1.0.0/shipportx.parquet; do
  printf "%-45s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' $SITE$p)"
done

# Downloaded files match the published checksums
mkdir -p /tmp/sx && cd /tmp/sx
for f in shipportx.csv shipportx.json shipportx.jsonl shipportx.parquet sources.csv SHA256SUMS; do
  curl -sO "$SITE/downloads/v1.0.0/$f"
done
sha256sum -c SHA256SUMS

# API
curl -s "$SITE/api/health"
curl -s "$SITE/api/v1/metadata" | grep -o '"total_records": [0-9]*'
```

Then:

- [ ] Hugging Face: dataset card renders, viewer works for all three configs, `load_dataset` checks pass.
- [ ] GitHub: README renders, `v1.0.0` tag and release exist with six assets, issue templates appear.
- [ ] Website: HF and GitHub links appear after setting the env vars and redeploying.
- [ ] Cross-check: website, API `/api/v1/metadata`, Hugging Face and GitHub all report 283 records and version 1.0.0.
