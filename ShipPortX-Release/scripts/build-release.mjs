// Builds every ShipPortX v1.0.0 release artefact from the original files in ../Data and
// ../ShipPortX-Research (a separate local repo). Originals are only read, never modified. Safe to re-run: all outputs are
// regenerated.
//
//   node scripts/build-release.mjs

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  DATA_FILES,
  OPERATING_STATUSES,
  CONFIDENCE_LEVELS,
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

const config = JSON.parse(readFileSync(join(RELEASE_ROOT, 'release.config.json'), 'utf8'));

const out = {
  hfData: join(RELEASE_ROOT, 'huggingface-dataset', 'data'),
  ghData: join(RELEASE_ROOT, 'github-release', 'data'),
  ghReports: join(RELEASE_ROOT, 'github-release', 'reports'),
  ghScripts: join(RELEASE_ROOT, 'github-release', 'scripts'),
  webDownloads: join(RELEASE_ROOT, 'website', 'public', 'downloads', `v${config.version}`),
  webData: join(RELEASE_ROOT, 'website', 'public', 'data', `v${config.version}`),
  webGenerated: join(RELEASE_ROOT, 'website', 'src', 'generated'),
  apiData: join(RELEASE_ROOT, 'api', 'src', 'data'),
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
for (const dir of [out.hfData, out.ghData, out.webDownloads]) {
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
// 4. Shared metadata block (API + website).

const metadata = {
  dataset: payload.dataset,
  version: payload.version,
  schema_version: payload.schema_version,
  generated: payload.generated,
  research_cutoff_date: payload.research_cutoff_date,
  record_count: payload.record_count,
  release_prepared: config.release_prepared,
  description: config.description,
  license: config.license,
  formats: dataFiles.map((f) => ({ file: f, sha256: checksums[f], bytes: readFileSync(join(SOURCE_DATA_DIR, f)).length })),
  vocabularies: {
    operating_status: OPERATING_STATUSES,
    research_status: ['VERIFIED', 'RESEARCHED', 'DISCOVERED', 'UNRESOLVED'],
    confidence: CONFIDENCE_LEVELS,
    port_type_primary: stats.port_type_primary.map((x) => x.value).filter(Boolean),
    commercial_status_primary: stats.commercial_status_primary.map((x) => x.value).filter(Boolean),
    region_continental: stats.regions.map((x) => x.value),
  },
  derived_fields: {
    port_type_primary: 'From the original flat exports: first token of port_type with parenthetical qualifiers removed. Convenience value, not a research fact.',
    operating_status_primary: 'From the original flat exports: operating_status normalised to the controlled vocabulary. Convenience value, not a research fact.',
    commercial_status_primary: 'Added in the v1.0.0 release package using the same rule as port_type_primary, for filtering. Convenience value, not a research fact.',
  },
  quality_flags:
    'Release-level annotations from automated checks (e.g. published coordinates that disagree with the research text). They describe suspected problems; published values are never altered. See docs/validation in the release.',
  missing_values: {
    null: 'Not established in this research pass. Not zero, not "none".',
    UNKNOWN: 'Explicit research conclusion that the value could not be determined despite an attempt.',
    NONE: 'Positive finding that the thing does not exist (where used).',
  },
};

// ---------------------------------------------------------------------------
// 5. API dataset module. Wrapped in JSON.parse(...) because V8 parses a JSON string
//    faster than an equivalent object literal; it is parsed once per function instance.

mkdirSync(out.apiData, { recursive: true });
const apiDataset = { metadata, stats, records, sources };
writeFileSync(
  join(out.apiData, 'dataset.generated.mjs'),
  `// GENERATED by scripts/build-release.mjs from Data/${DATA_FILES.json}, Data/${DATA_FILES.csv} and Data/${DATA_FILES.sources}. Do not edit.\n` +
    `export default JSON.parse(${JSON.stringify(JSON.stringify(apiDataset))});\n`,
);
log(`Generated ${rel(join(out.apiData, 'dataset.generated.mjs'))}`);

// Worldwide port index (ShipPortX + NGA World Port Index), served by the API only. Built by
// ../scripts/build_worldwide.py (npm run build:worldwide) from the same Data/ files.
const worldwide = JSON.parse(readFileSync(join(PROJECT_ROOT, 'Worldwide', 'ports-worldwide.json'), 'utf8'));
const worldwideIds = new Set(worldwide.records.filter((r) => r.source === 'shipportx').map((r) => r.id));
if (worldwideIds.size !== records.length || !records.every((r) => worldwideIds.has(r.port_id))) {
  throw new Error('Worldwide/ports-worldwide.json is out of date with Data/. Run: npm run build:worldwide');
}
writeFileSync(
  join(out.apiData, 'worldwide.generated.mjs'),
  `// GENERATED by scripts/build-release.mjs from Worldwide/ports-worldwide.json. Do not edit.\n` +
    `export default JSON.parse(${JSON.stringify(JSON.stringify(worldwide))});\n`,
);
log(`Generated ${rel(join(out.apiData, 'worldwide.generated.mjs'))} (${worldwide.records.length} records)`);

// The private API usage page ships with the API; the combined site serves it from the website.
const statsPage = join(RELEASE_ROOT, 'website', 'public', 'stats');
mkdirSync(statsPage, { recursive: true });
cpSync(join(RELEASE_ROOT, 'api', 'public', 'stats', 'index.html'), join(statsPage, 'index.html'));
log(`Copied api/public/stats/index.html to ${rel(statsPage)}`);

// ---------------------------------------------------------------------------
// 6. Website data: a compact index for the explorer/map, plus one detail file per port.

freshDir(out.webData);
mkdirSync(join(out.webData, 'ports'), { recursive: true });

const INDEX_FIELDS = [
  'port_id',
  'official_name',
  'alternate_names',
  'country',
  'country_code',
  'region_continental',
  'administrative_area',
  'city',
  'port_type',
  'port_type_primary',
  'commercial_status',
  'commercial_status_primary',
  'operating_status',
  'operating_status_primary',
  'latitude',
  'longitude',
  'unlocode',
  'primary_activity',
  'research_status',
  'confidence_core',
  'quality_flags',
];
const sourcesById = new Map(sources.map((s) => [s.source_id, s]));

writeJson(
  join(out.webData, 'index.json'),
  {
    metadata,
    stats,
    fields: INDEX_FIELDS,
    // Row arrays keep the index small; the website zips them back into objects.
    records: records.map((r) =>
      INDEX_FIELDS.map((f) => (f === 'quality_flags' ? r.quality_flags.map((q) => q.code) : r[f] ?? null)),
    ),
  },
  false,
);

for (const record of records) {
  const detail = {
    ...record,
    sources: (record.source_ids || []).map((id) => sourcesById.get(id) || { source_id: id, missing_from_register: true }),
  };
  writeJson(join(out.webData, 'ports', `${record.port_id}.json`), detail, false);
}
writeJson(join(out.webData, 'sources.json'), sources, false);
log(`Generated website data in ${rel(out.webData)} (${records.length} port files)`);

// ---------------------------------------------------------------------------
// 7. Real API responses for the website's API section, produced by the actual handler.

mkdirSync(out.webGenerated, { recursive: true });
const { handleRequest } = await import(pathToFileURL(join(RELEASE_ROOT, 'api', 'src', 'handler.mjs')).href);
const sampleWithCoords = records.find((r) => r.port_id === 'KE-mombasa') || records.find(hasCoordinates);

async function sample(path, trim) {
  const res = await handleRequest(new Request(`https://example.invalid${path}`));
  const body = await res.json();
  return { path, status: res.status, body: trim ? trim(body) : body };
}

const examples = [
  await sample('/api/health'),
  await sample('/api/v1/ports?country=KE&ocean_going=true&limit=2'),
  await sample(`/api/v1/ports/${sampleWithCoords.port_id}`, (b) => ({
    data: {
      ...b.data,
      shipportx: {
        port_id: b.data.shipportx.port_id,
        official_name: b.data.shipportx.official_name,
        research_status: b.data.shipportx.research_status,
        source_ids: b.data.shipportx.source_ids,
        '…': 'full research record continues (all schema fields, fields_detail, sources)',
      },
    },
    meta: b.meta,
  })),
  await sample('/api/v1/countries', (b) => ({ data: b.data.slice(0, 2), meta: b.meta })),
  await sample('/api/v1/ports/XX-does-not-exist'),
];
writeJson(join(out.webGenerated, 'api-examples.json'), examples);
log(`Generated ${rel(join(out.webGenerated, 'api-examples.json'))} from the live handler`);

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
  outputs: [out.hfData, out.ghData, out.webDownloads, out.webData, out.apiData].map(rel),
});
log(`Wrote docs/release-manifest.json`);
console.log(`\nBuild complete: ${basename(RELEASE_ROOT)} v${config.version}`);
