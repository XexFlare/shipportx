// Builds every ShipPortX v1.0.0 release artefact from the original files in ../Data and
// ../ShipPortX-Research (a separate local repo). Originals are only read, never modified. Safe to re-run: all outputs are
// regenerated. The website and API data are built from these files by shipportx-web-api (private).
//
//   node scripts/build-release.mjs

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import {
  DATA_FILES,
  RELEASE_ROOT,
  SOURCE_DATA_DIR,
  PROJECT_ROOT,
  computeStats,
  hasCoordinates,
  loadCsv,
  loadJson,
  loadSources,
  mergeRecords,
  sha256,
} from './lib/dataset.mjs';
import { hasCoordinateFlag, qualityFlags } from './lib/quality.mjs';
import { buildMetadata } from './lib/metadata.mjs';

const config = JSON.parse(readFileSync(join(RELEASE_ROOT, 'release.config.json'), 'utf8'));

const out = {
  hfData: join(RELEASE_ROOT, 'huggingface-dataset', 'data'),
  ghData: join(RELEASE_ROOT, 'github-release', 'data'),
  ghReports: join(RELEASE_ROOT, 'github-release', 'reports'),
  ghScripts: join(RELEASE_ROOT, 'github-release', 'scripts'),
};

const log = (msg) => console.log(`• ${msg}`);
const rel = (p) => relative(RELEASE_ROOT, p).replaceAll('\\', '/');
const writeJson = (path, value, pretty = true) => writeFileSync(path, JSON.stringify(value, null, pretty ? 2 : 0) + '\n');

function freshDir(path) {
  rmSync(path, { recursive: true, force: true });
  mkdirSync(path, { recursive: true });
}

// ---------------------------------------------------------------------------
// 1. Load and sanity-check the originals before producing anything.

const payload = loadJson();
const csv = loadCsv();
const sources = loadSources().rows;

if (payload.version !== config.version) {
  throw new Error(`release.config.json version ${config.version} != dataset version ${payload.version}`);
}
if (payload.records.length !== payload.record_count) {
  throw new Error(`JSON record_count ${payload.record_count} != ${payload.records.length} records`);
}

const records = mergeRecords(payload.records, csv.rows).map((record) => ({
  ...record,
  quality_flags: qualityFlags(record),
}));
const stats = computeStats(records, sources);
stats.with_coordinate_flags = records.filter(hasCoordinateFlag).length;
stats.mappable = records.filter((r) => hasCoordinates(r) && !hasCoordinateFlag(r)).length;
stats.with_quality_flags = records.filter((r) => r.quality_flags.length).length;
log(`Loaded ${records.length} records, ${sources.length} sources, ${stats.countries} countries`);

// ---------------------------------------------------------------------------
// 2. Byte-identical copies of the published data files (+ checksums).

const dataFiles = Object.values(DATA_FILES);
const checksums = Object.fromEntries(dataFiles.map((f) => [f, sha256(join(SOURCE_DATA_DIR, f))]));
const sumsText = dataFiles.map((f) => `${checksums[f]}  ${f}`).join('\n') + '\n';

// Files are overwritten in place (not wiped), so the Hugging Face Parquet twins produced by
// scripts/build_hf_parquet.py survive; validate.mjs checks them against these originals.
for (const dir of [out.hfData, out.ghData]) {
  mkdirSync(dir, { recursive: true });
  for (const f of dataFiles) cpSync(join(SOURCE_DATA_DIR, f), join(dir, f));
  writeFileSync(join(dir, 'SHA256SUMS'), sumsText);
  log(`Copied ${dataFiles.length} data files -> ${rel(dir)}`);
}

// ---------------------------------------------------------------------------
// 3. GitHub package: build reports and validation helpers. The research corpus is not
//    published; ../scripts/build_dataset.py builds ../Data and ../reports from ../ShipPortX-Research.

mkdirSync(out.ghReports, { recursive: true });
for (const f of ['dataset_summary.json', 'field_inventory.json', 'validation_report.json']) {
  cpSync(join(PROJECT_ROOT, 'reports', f), join(out.ghReports, f));
}
log(`Copied build reports -> ${rel(out.ghReports)}`);

mkdirSync(out.ghScripts, { recursive: true });
// Shared validation helpers, so github-release/scripts/validate.mjs can run standalone.
const ghLib = join(out.ghScripts, 'lib');
freshDir(ghLib);
for (const f of ['csv.mjs', 'dataset.mjs', 'coordinates.mjs', 'country-bounds.mjs']) {
  cpSync(join(RELEASE_ROOT, 'scripts', 'lib', f), join(ghLib, f));
}
log(`Copied validation helpers -> ${rel(ghLib)}`);

// ---------------------------------------------------------------------------
// 4. Shared metadata block.

const metadata = buildMetadata({ payload, config, dataFiles, checksums, stats });

// ---------------------------------------------------------------------------
// 8. Release manifest.

writeJson(join(RELEASE_ROOT, 'docs', 'release-manifest.json'), {
  dataset: metadata.dataset,
  version: metadata.version,
  generated: metadata.generated,
  release_prepared: metadata.release_prepared,
  source_files: dataFiles.map((f) => ({ path: `Data/${f}`, sha256: checksums[f] })),
  statistics: {
    total_records: stats.total_records,
    verified_records: stats.verified_records,
    countries: stats.countries,
    with_coordinates: stats.with_coordinates,
    with_unlocode: stats.with_unlocode,
    source_register_entries: stats.source_register_entries,
  },
  outputs: [out.hfData, out.ghData].map(rel),
});
log(`Wrote docs/release-manifest.json`);
console.log(`\nBuild complete: ${basename(RELEASE_ROOT)} v${config.version}`);
