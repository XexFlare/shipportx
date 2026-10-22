# ShipPortX v1.0.0: Publication guide

All paths are relative to the release root (`ShipPortX-Release/`). Commands are for a POSIX shell
(Git Bash on Windows works). Nothing in this guide has been executed against Hugging Face or GitHub yet,
those steps need your accounts.

The website, the API and their Netlify deployment live in the private repo `shipportx-web-api`
(see its `docs/DEPLOYMENT.md`). This repo is the dataset and its release packages only.

Prerequisites: Node.js 20.19+ (22 recommended), npm, Git; Python 3.10+ with `pyarrow` only if you
need to regenerate the Hugging Face Parquet files.

```text
ShipPortX-Release/
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
pip install pyarrow                  # only for build:hf

npm run release
# = build:worldwide → build:data → build:hf → validate
```

Every step must pass. Results: `docs/validation/VALIDATION_REPORT.md`. After a rebuild, also run the
private repo's `npm run release` so the website and API pick up the new data.

---

## 1. Hugging Face

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

5. Set `VITE_HF_DATASET_URL` on the website (private repo `shipportx-web-api`) and redeploy.

The three configs were tested locally with `datasets` 5.1.0 (all load; 283/283/192 rows).

---

## 2. GitHub

The repository content is `github-release/`.

### 2.1 Before the first commit

- `github-release/LICENSE` (CC BY 4.0) is already in place. The research corpus is intentionally
  not included.

### 2.2 Initialise, commit, tag, push

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

### 2.3 GitHub release with downloadable files

```bash
gh release create v1.0.0 \
  data/shipportx.csv data/shipportx.parquet data/shipportx.json data/shipportx.jsonl \
  data/sources.csv data/SHA256SUMS \
  --title "ShipPortX v1.0.0" --notes-file CHANGELOG.md
```

Then: enable Issues (templates are in `.github/ISSUE_TEMPLATE/`), add topics (`africa`, `ports`,
`open-data`, `maritime`, `dataset`), and set `VITE_GITHUB_REPO_URL` on the website (private repo `shipportx-web-api`).

---

## 3. Final verification after publication

- [ ] Hugging Face: dataset card renders, viewer works for all three configs, `load_dataset` checks pass.
- [ ] GitHub: README renders, `v1.0.0` tag and release exist with six assets, issue templates appear.
- [ ] Cross-check: Hugging Face, GitHub and the live API `/api/v1/metadata` all report 283 records and version 1.0.0.
