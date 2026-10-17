# ShipPortX v1.0.0: release checklist

✅ = done and verified locally during preparation (2026-10-14). ☐ = needs you.

## A. Decisions only the maintainer can make

- ✅ License: CC BY 4.0 (applied to the website, Hugging Face card, GitHub `LICENSE` and `CITATION.cff`).
- ✅ Research corpus kept out of the GitHub package (available on request).
- ✅ Coordinate errors (8 records, plus Mostaganem): fixed before first publication (2026-10-17) in the
  build script and research records; v1.0.0 ships with the corrected values.
- ✅ Public names and URLs: chosen by the maintainer; fill them in during publishing (section C).

## B. Verified locally

- ✅ Em dashes removed from the research corpus and the dataset rebuilt with the build script: 283 records, same IDs, no value changes other than punctuation and research-note wording (checked field by field against the backup). All package copies byte-identical to `Data/` (SHA-256).
- ✅ `npm run validate`: 39/39 checks pass; 2 warning findings documented (was 3 before the 2026-10-17 coordinate fix) (not altered).
- ✅ API: 38/38 tests (endpoints, usage log, Firestore client, edge function); esbuild bundles of the function, rollup and edge function import and serve all routes (2026-10-17).
- ✅ Website: `vite build` succeeds; ESLint clean; `check:dist` passes; layout checked at 1440 px
  and 390 px (no horizontal overflow), port detail, map and docs pages rendered in headless Edge.
- ✅ Hugging Face: `default`, `full`, `sources` configs load with `datasets` 5.1.0 (283/283/192 rows).
- ✅ GitHub package: standalone validator passes; JS and Python examples run; the original build
  script (`../scripts/build_dataset.py`) regenerates CSV/JSON/JSONL/sources byte-for-byte from `../ShipPortX-Research`.
- ✅ No secrets, credentials or machine-specific paths in the packages.

## C. Publish

1. ☐ Website + API on Netlify (see `docs/DEPLOYMENT.md` §1.4, Option A, one site).
2. ☐ Verify the live site and API (see `docs/DEPLOYMENT.md` §1.7 and §2.6).
3. ☐ Hugging Face: replace `<HF_NAMESPACE>` and upload (see `huggingface-dataset/PUBLISHING.md`).
4. ☐ GitHub: init, commit, tag `v1.0.0`, push and create the release (see `docs/DEPLOYMENT.md` §4).
5. ☐ Set `VITE_HF_DATASET_URL`, `VITE_GITHUB_REPO_URL` (and optionally `VITE_CONTACT_EMAIL`) on
   Netlify and redeploy so the links appear.
6. ☐ Replace `<api-host>` / `<HF_NAMESPACE>` / `<OWNER>` placeholders in `github-release/README.md`,
   `github-release/docs/API.md` and the HF card once the URLs exist.
7. ☐ For sustained traffic, configure a map tile provider account (`docs/DEPLOYMENT.md` §5).
8. ☐ Final cross-check (see `docs/DEPLOYMENT.md` §6).

## D. After release

- ✅ Website registered with StarLaunch as "ShipPortX - Website" (port 5020). Add 5020 to `X:CodePORT_REGISTRY_PLAN.md`.
- ☐ Plan 1.0.1 (coordinate fixes) and v2 enrichment (discovery-register entries, field depth).
