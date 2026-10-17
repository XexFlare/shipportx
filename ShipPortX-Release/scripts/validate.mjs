// Automated integrity checks for the ShipPortX v1.0.0 release.
//
//   node scripts/validate.mjs
//
// Writes docs/validation/validation-report.json and docs/validation/VALIDATION_REPORT.md.
// Exits non-zero if any ERROR-level check fails. WARNING/INFO findings describe the data as
// published; they are recorded for the maintainer and never "fixed" here.
//
// These are automated format and consistency checks. They do NOT independently verify the
// underlying research (whether a port exists, its status, or its specifications).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  DATA_FILES,
  OPERATING_STATUSES,
  CONFIDENCE_LEVELS,
  PROJECT_ROOT,
  RESEARCH_REPO_DIR,
  RELEASE_ROOT,
  SOURCE_DATA_DIR,
  derivePrimaryToken,
  hasCoordinates,
  isFilled,
  isValidUnlocode,
  loadCsv,
  loadJson,
  loadJsonl,
  loadParquet,
  loadSources,
  sha256,
} from './lib/dataset.mjs';
import { coordinateFindings } from './lib/coordinates.mjs';
import { parquetReadObjects } from 'hyparquet';

const checks = [];
const findings = [];

function check(level, id, description, passed, details) {
  checks.push({ level, id, description, passed: Boolean(passed), ...(details !== undefined ? { details } : {}) });
}
function finding(level, id, description, items) {
  findings.push({ level, id, description, count: items.length, items });
}

const payload = loadJson();
const json = payload.records;
const jsonl = loadJsonl();
const csv = loadCsv();
const parquet = await loadParquet();
const sources = loadSources();
const ids = json.map((r) => r.port_id);
const byId = (rows) => new Map(rows.map((r) => [r.port_id, r]));

// ---------------------------------------------------------------------------
// 1. Record counts against the dataset's own metadata

const expected = payload.record_count;
check('ERROR', 'count.json_metadata', `JSON record_count (${expected}) equals number of JSON records`, json.length === expected, json.length);
check('ERROR', 'count.jsonl', 'JSONL line count equals record_count', jsonl.length === expected, jsonl.length);
check('ERROR', 'count.csv', 'CSV row count equals record_count', csv.rows.length === expected, csv.rows.length);
check('ERROR', 'count.parquet', 'Parquet row count equals record_count', parquet.length === expected, parquet.length);
check('ERROR', 'meta.version', 'JSON envelope version is 1.0.0', payload.version === '1.0.0', payload.version);

// Build summary written by github-release/scripts/build_dataset.py alongside the data.
const upstreamSummaryPath = join(PROJECT_ROOT, 'reports', 'dataset_summary.json');
if (existsSync(upstreamSummaryPath)) {
  const summary = JSON.parse(readFileSync(upstreamSummaryPath, 'utf8'));
  const verified = json.filter((r) => r.research_status === 'VERIFIED').length;
  const countries = new Set(json.map((r) => r.country_code)).size;
  check('ERROR', 'count.upstream_summary', 'Totals match the build summary (total, VERIFIED, countries)',
    summary.total_records === json.length && summary.verified_records === verified && summary.countries_represented === countries,
    { summary: [summary.total_records, summary.verified_records, summary.countries_represented], actual: [json.length, verified, countries] });
}

// ---------------------------------------------------------------------------
// 2. Identifiers and schema consistency

const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
check('ERROR', 'id.unique', 'port_id values are unique', dupIds.length === 0, dupIds);
const badIds = ids.filter((id) => !/^[A-Z]{2}-[a-z0-9-]+$/.test(id));
check('ERROR', 'id.format', 'port_id matches {ISO2}-{slug}', badIds.length === 0, badIds);
const prefixMismatch = json.filter((r) => !r.port_id.startsWith(`${r.country_code}-`)).map((r) => r.port_id);
check('ERROR', 'id.country_prefix', 'port_id prefix equals country_code', prefixMismatch.length === 0, prefixMismatch);

const REQUIRED = ['port_id', 'official_name', 'country', 'country_code', 'country_code_iso3', 'region_continental', 'port_type', 'research_status', 'record_path'];
const missingRequired = json.flatMap((r) => REQUIRED.filter((f) => !isFilled(r[f])).map((f) => `${r.port_id}.${f}`));
check('ERROR', 'schema.required', `Required fields present: ${REQUIRED.join(', ')}`, missingRequired.length === 0, missingRequired);

const jsonKeys = Object.keys(json[0]).sort();
const keyMismatch = json.filter((r) => !isDeepStrictEqual(Object.keys(r).sort(), jsonKeys)).map((r) => r.port_id);
check('ERROR', 'schema.json_keys', 'Every JSON record has the same field set', keyMismatch.length === 0, keyMismatch);

const flatExpected = [...jsonKeys.filter((k) => k !== 'fields_detail'), 'port_type_primary', 'operating_status_primary'].sort();
check('ERROR', 'schema.csv_columns', 'CSV columns = JSON fields (minus fields_detail) + 2 derived columns', isDeepStrictEqual([...csv.header].sort(), flatExpected),
  { extra: csv.header.filter((h) => !flatExpected.includes(h)), missing: flatExpected.filter((h) => !csv.header.includes(h)) });
const parquetCols = Object.keys(parquet[0]);
check('ERROR', 'schema.parquet_columns', 'Parquet columns match CSV columns (same order)', isDeepStrictEqual(parquetCols, csv.header), parquetCols.length);

const typeProblems = [];
for (const r of json) {
  for (const f of ['latitude', 'longitude']) if (r[f] !== null && typeof r[f] !== 'number') typeProblems.push(`${r.port_id}.${f}`);
  if (!Array.isArray(r.source_ids)) typeProblems.push(`${r.port_id}.source_ids`);
  if (typeof r.fields_detail !== 'object' || r.fields_detail === null) typeProblems.push(`${r.port_id}.fields_detail`);
}
check('ERROR', 'schema.types', 'latitude/longitude numeric or null; source_ids array; fields_detail object', typeProblems.length === 0, typeProblems);

// ---------------------------------------------------------------------------
// 3. Cross-format consistency (JSON is the reference)

const jsonlById = byId(jsonl);
const jsonlDiff = json.filter((r) => !isDeepStrictEqual(r, jsonlById.get(r.port_id))).map((r) => r.port_id);
check('ERROR', 'format.jsonl_equals_json', 'JSONL records are deep-equal to JSON records', jsonlDiff.length === 0, jsonlDiff);
const orderSame = isDeepStrictEqual(jsonl.map((r) => r.port_id), ids) && isDeepStrictEqual(csv.rows.map((r) => r.port_id), ids) && isDeepStrictEqual(parquet.map((r) => r.port_id), ids);
check('ERROR', 'format.record_order', 'Record order is identical across JSON, JSONL, CSV and Parquet', orderSame);

const flatValue = (v) => (v === null || v === undefined ? null : Array.isArray(v) ? (v.length ? v.join('; ') : null) : v);
function compareFlat(rows, label, normalizeCell) {
  const diffs = [];
  const rowsById = byId(rows);
  for (const r of json) {
    const row = rowsById.get(r.port_id);
    if (!row) { diffs.push(`${r.port_id}: missing`); continue; }
    for (const key of jsonKeys) {
      if (key === 'fields_detail') continue;
      const a = flatValue(r[key]);
      const b = normalizeCell(row[key], typeof a);
      if (!(a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9))) {
        diffs.push(`${r.port_id}.${key}: json=${JSON.stringify(a)} ${label}=${JSON.stringify(b)}`);
      }
    }
  }
  return diffs;
}
const csvDiffs = compareFlat(csv.rows, 'csv', (cell, t) => (cell === '' ? null : t === 'number' ? Number(cell) : cell));
check('ERROR', 'format.csv_equals_json', 'Every CSV cell matches the JSON value (lists joined with "; ")', csvDiffs.length === 0, csvDiffs.slice(0, 50));
const parquetDiffs = compareFlat(parquet, 'parquet', (cell) => (cell === undefined || (typeof cell === 'number' && Number.isNaN(cell)) ? null : cell));
check('ERROR', 'format.parquet_equals_json', 'Every Parquet value matches the JSON value', parquetDiffs.length === 0, parquetDiffs.slice(0, 50));

const pq = byId(parquet);
const derivedDiffs = csv.rows.filter((row) => row.port_type_primary !== (pq.get(row.port_id).port_type_primary ?? '') || row.operating_status_primary !== (pq.get(row.port_id).operating_status_primary ?? '')).map((r) => r.port_id);
check('ERROR', 'format.derived_csv_parquet', 'Derived *_primary columns agree between CSV and Parquet', derivedDiffs.length === 0, derivedDiffs);
const ruleDiffs = json.filter((r) => (derivePrimaryToken(r.port_type) ?? '') !== byId(csv.rows).get(r.port_id).port_type_primary).map((r) => r.port_id);
check('ERROR', 'format.port_type_primary_rule', 'port_type_primary reproduces from port_type with the documented rule', ruleDiffs.length === 0, ruleDiffs);

// Release copies must be byte-identical to the originals.
const copyDirs = ['huggingface-dataset/data', 'github-release/data', `website/public/downloads/v${payload.version}`];
const copyProblems = [];
for (const dir of copyDirs) {
  for (const f of Object.values(DATA_FILES)) {
    const p = join(RELEASE_ROOT, dir, f);
    if (!existsSync(p)) copyProblems.push(`${dir}/${f}: missing`);
    else if (sha256(p) !== sha256(join(SOURCE_DATA_DIR, f))) copyProblems.push(`${dir}/${f}: checksum differs`);
  }
}
check('ERROR', 'release.copies_identical', 'Data files in every package are byte-identical to Data/ originals', copyProblems.length === 0, copyProblems);

// Hugging Face Parquet twins (format conversions of shipportx.jsonl and sources.csv).
const hfDir = join(RELEASE_ROOT, 'huggingface-dataset', 'data');
const readParquetFile = async (path) => {
  const buf = readFileSync(path);
  return parquetReadObjects({ file: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) });
};
const fullPath = join(hfDir, 'shipportx_full.parquet');
const sourcesPqPath = join(hfDir, 'sources.parquet');
if (existsSync(fullPath) && existsSync(sourcesPqPath)) {
  const full = await readParquetFile(fullPath);
  const fullDiffs = [];
  full.forEach((row, i) => {
    const ref = json[i];
    if (!ref || row.port_id !== ref.port_id) return fullDiffs.push(`row ${i}: port_id ${row.port_id} != ${ref?.port_id}`);
    for (const key of jsonKeys) {
      if (key === 'fields_detail') continue;
      if (!isDeepStrictEqual(row[key] ?? null, ref[key])) fullDiffs.push(`${ref.port_id}.${key}`);
    }
    for (const [field, detail] of Object.entries(row.fields_detail || {})) {
      const want = ref.fields_detail[field];
      if (want === undefined ? detail !== null && detail !== undefined : !isDeepStrictEqual(detail, want)) fullDiffs.push(`${ref.port_id}.fields_detail.${field}`);
    }
    for (const field of Object.keys(ref.fields_detail)) if (!row.fields_detail?.[field]) fullDiffs.push(`${ref.port_id}.fields_detail.${field} missing`);
  });
  check('ERROR', 'hf.full_parquet_equals_json', 'huggingface-dataset/data/shipportx_full.parquet equals the JSON records, including fields_detail',
    full.length === json.length && fullDiffs.length === 0, fullDiffs.slice(0, 50));
  const sourcesPq = await readParquetFile(sourcesPqPath);
  check('ERROR', 'hf.sources_parquet_equals_csv', 'huggingface-dataset/data/sources.parquet equals sources.csv',
    isDeepStrictEqual(sourcesPq.map((r) => ({ ...r })), sources.rows));
} else {
  check('ERROR', 'hf.parquet_twins_exist', 'Hugging Face Parquet twins exist (run npm run build:hf)', false);
}

// ---------------------------------------------------------------------------
// 4. Coordinates

const halfCoords = json.filter((r) => (r.latitude === null) !== (r.longitude === null)).map((r) => r.port_id);
check('ERROR', 'coords.paired', 'latitude and longitude are both present or both null', halfCoords.length === 0, halfCoords);
const outOfRange = json.filter((r) => hasCoordinates(r) && (Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180)).map((r) => r.port_id);
check('ERROR', 'coords.range', 'Coordinates within WGS84 range', outOfRange.length === 0, outOfRange);

const coordProblems = json.map((r) => ({ port_id: r.port_id, findings: coordinateFindings(r) })).filter((x) => x.findings.length);
finding('WARNING', 'coords.plausibility',
  'Published coordinates that disagree with the record\'s own research text (fields_detail.lat_lon_raw) or fall outside the stated country. The website withholds these from the map and the API marks them in quality_flags; the published files are unchanged.',
  coordProblems.map((x) => ({ port_id: x.port_id, issues: x.findings.map((f) => `${f.code}: ${f.message}`) })));

const rawNoParsed = json.filter((r) => r.fields_detail?.lat_lon_raw && !hasCoordinates(r)).map((r) => ({ port_id: r.port_id, raw: r.fields_detail.lat_lon_raw.value }));
finding('INFO', 'coords.raw_without_value', 'Records whose research table has a coordinate row but no published coordinates (expected when the row records a non-finding)', rawNoParsed);

const coordGroups = new Map();
for (const r of json.filter(hasCoordinates)) {
  const k = `${r.latitude},${r.longitude}`;
  coordGroups.set(k, [...(coordGroups.get(k) || []), r.port_id]);
}
finding('INFO', 'coords.duplicates', 'Distinct records sharing identical coordinates', [...coordGroups.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ coordinates: k, port_ids: v })));
finding('INFO', 'coords.missing', 'Records without coordinates (null; not placed on the map)', json.filter((r) => !hasCoordinates(r)).map((r) => r.port_id));

// ---------------------------------------------------------------------------
// 5. Country, region and status fields

const countryMap = new Map();
const countryConflicts = [];
for (const r of json) {
  const sig = `${r.country}|${r.country_code_iso3}|${r.region_continental}`;
  if (countryMap.has(r.country_code) && countryMap.get(r.country_code) !== sig) countryConflicts.push(`${r.port_id}: ${sig} vs ${countryMap.get(r.country_code)}`);
  countryMap.set(r.country_code, sig);
}
check('ERROR', 'country.consistent', 'Each country_code maps to exactly one country name, ISO3 code and region', countryConflicts.length === 0, countryConflicts);
const namesPerCode = new Set([...countryMap.values()].map((s) => s.split('|')[0]));
check('ERROR', 'country.one_to_one', 'Country names and country codes are one-to-one', namesPerCode.size === countryMap.size, { codes: countryMap.size, names: namesPerCode.size });

const RESEARCH_STATUSES = ['VERIFIED', 'RESEARCHED', 'DISCOVERED', 'UNRESOLVED'];
const badResearch = json.filter((r) => !RESEARCH_STATUSES.includes(r.research_status)).map((r) => r.port_id);
check('ERROR', 'status.research_vocab', 'research_status uses the controlled vocabulary', badResearch.length === 0, badResearch);
const csvById = byId(csv.rows);
const badOpPrimary = csv.rows.filter((r) => r.operating_status_primary && !OPERATING_STATUSES.includes(r.operating_status_primary)).map((r) => r.port_id);
check('ERROR', 'status.operating_primary_vocab', 'operating_status_primary uses the controlled vocabulary', badOpPrimary.length === 0, badOpPrimary);
const verifiedNoStatus = json.filter((r) => r.research_status === 'VERIFIED' && !isFilled(r.operating_status)).map((r) => r.port_id);
check('ERROR', 'status.verified_has_operating_status', 'Every VERIFIED record has an operating_status', verifiedNoStatus.length === 0, verifiedNoStatus);

finding('INFO', 'status.operating_compound', 'operating_status values that are not a bare controlled-vocabulary value (preserved verbatim)',
  json.filter((r) => r.operating_status && !OPERATING_STATUSES.includes(r.operating_status)).map((r) => ({ port_id: r.port_id, operating_status: r.operating_status, operating_status_primary: csvById.get(r.port_id).operating_status_primary })));
finding('WARNING', 'status.operating_primary_overstates', 'Records whose verbatim operating_status begins with UNKNOWN but whose derived operating_status_primary is a more specific status',
  json.filter((r) => /^UNKNOWN\b/.test(r.operating_status || '') && csvById.get(r.port_id).operating_status_primary !== 'UNKNOWN').map((r) => ({ port_id: r.port_id, operating_status: r.operating_status, operating_status_primary: csvById.get(r.port_id).operating_status_primary })));
const PORT_TYPES = ['major_commercial', 'secondary_commercial', 'regional_commercial', 'fishing_harbour', 'river_port', 'lake_port', 'oil_terminal', 'gas_terminal', 'mining_export_terminal', 'agricultural_export_terminal', 'passenger_port', 'ferry_terminal', 'industrial_port', 'private_port', 'naval_military', 'terminal', 'other'];
finding('INFO', 'status.port_type_outside_vocab', 'port_type_primary values outside the research specification\'s port_type list',
  json.filter((r) => !PORT_TYPES.includes(csvById.get(r.port_id).port_type_primary)).map((r) => ({ port_id: r.port_id, port_type: r.port_type })));
finding('INFO', 'status.non_verified', 'Records that are not VERIFIED (discovery-register entries; most fields null by construction)',
  json.filter((r) => r.research_status !== 'VERIFIED').map((r) => ({ port_id: r.port_id, research_status: r.research_status })));

const confidenceOdd = [];
for (const r of json) {
  for (const [field, d] of Object.entries(r.fields_detail || {})) {
    if (d.confidence && !CONFIDENCE_LEVELS.includes(d.confidence)) confidenceOdd.push({ port_id: r.port_id, field, confidence: d.confidence });
  }
}
finding('INFO', 'provenance.confidence_outside_vocab', 'fields_detail confidence values outside CONFIRMED/STRONG/SUPPORTED/UNVERIFIED/CONFLICTING/UNKNOWN (preserved verbatim)', confidenceOdd);

// ---------------------------------------------------------------------------
// 6. UN/LOCODE

finding('INFO', 'unlocode.non_code_values', 'unlocode values that are not 5-character codes (explicit UNKNOWN or a conflict narrative, by design)',
  json.filter((r) => isFilled(r.unlocode) && !isValidUnlocode(r.unlocode)).map((r) => ({ port_id: r.port_id, unlocode: r.unlocode })));
finding('WARNING', 'unlocode.prefix_mismatch', 'UN/LOCODE country prefix differs from country_code',
  json.filter((r) => isValidUnlocode(r.unlocode) && r.unlocode.slice(0, 2) !== r.country_code).map((r) => ({ port_id: r.port_id, unlocode: r.unlocode })));
const codes = json.filter((r) => isValidUnlocode(r.unlocode)).map((r) => r.unlocode);
const dupCodes = codes.filter((c, i) => codes.indexOf(c) !== i);
check('ERROR', 'unlocode.unique', 'No duplicate UN/LOCODE values', dupCodes.length === 0, dupCodes);

// ---------------------------------------------------------------------------
// 7. Sources and provenance

const sourceIds = sources.rows.map((s) => s.source_id);
const dupSources = sourceIds.filter((s, i) => sourceIds.indexOf(s) !== i);
check('ERROR', 'sources.unique', 'sources.csv source_id values are unique', dupSources.length === 0, dupSources);
const sourceSet = new Set(sourceIds);
const danglingSources = json.flatMap((r) => r.source_ids.filter((s) => !sourceSet.has(s)).map((s) => `${r.port_id} -> ${s}`));
check('ERROR', 'sources.resolve', 'Every source_ids entry exists in sources.csv', danglingSources.length === 0, danglingSources);
const noUrl = sources.rows.filter((s) => !isFilled(s.source_url)).map((s) => s.source_id);
finding('INFO', 'sources.without_url', 'Source-register entries without a URL', noUrl);
finding('WARNING', 'sources.verified_without_ids', 'VERIFIED records citing sources only as free text (no formal source_ids; citation text preserved in fields_detail)',
  json.filter((r) => r.research_status === 'VERIFIED' && r.source_ids.length === 0).map((r) => r.port_id));

// record_path is "research/ShipPortX/..." relative to the research repo (../ShipPortX-Research).
const unresolvedPaths = json.filter((r) => !existsSync(join(RESEARCH_REPO_DIR, r.record_path.replace(/^research\//, '')))).map((r) => `${r.port_id}: ${r.record_path}`);
check('ERROR', 'provenance.record_path', 'Every record_path resolves to a file in the research corpus (../ShipPortX-Research)', unresolvedPaths.length === 0, unresolvedPaths);

// ---------------------------------------------------------------------------
// 8. Missing-value conventions

const emptyStrings = json.flatMap((r) => Object.entries(r).filter(([k, v]) => v === '' && k !== 'fields_detail').map(([k]) => `${r.port_id}.${k}`));
check('ERROR', 'missing.no_empty_strings', 'JSON uses null (not empty strings) for missing values', emptyStrings.length === 0, emptyStrings.slice(0, 50));
const explicitUnknown = json.flatMap((r) => Object.entries(r).filter(([, v]) => v === 'UNKNOWN').map(([k]) => `${r.port_id}.${k}`));
finding('INFO', 'missing.explicit_unknown', 'Fields holding the explicit research value "UNKNOWN" (distinct from null)', explicitUnknown);
const alwaysNull = jsonKeys.filter((k) => json.every((r) => r[k] === null));
finding('INFO', 'missing.never_populated', 'Schema fields with no value in any record in v1.0.0', alwaysNull);
const listTyped = ['alternate_names', 'secondary_activities', 'cargo_types', 'terminals'].filter((k) => json.some((r) => typeof r[k] === 'string'));
finding('INFO', 'docs.list_fields_are_strings', 'Fields the original SCHEMA.md describes as JSON arrays but which are strings in the published JSON/JSONL (documentation corrected in this release)', listTyped);

// ---------------------------------------------------------------------------
// 9. Generated release artefacts

const indexPath = join(RELEASE_ROOT, 'website', 'public', 'data', `v${payload.version}`, 'index.json');
if (existsSync(indexPath)) {
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  const idCol = index.fields.indexOf('port_id');
  const indexIds = index.records.map((row) => row[idCol]);
  check('ERROR', 'website.index_ids', 'Website index contains exactly the dataset port_ids', isDeepStrictEqual(indexIds, ids));
  const missingDetail = ids.filter((id) => !existsSync(join(RELEASE_ROOT, 'website', 'public', 'data', `v${payload.version}`, 'ports', `${id}.json`)));
  check('ERROR', 'website.detail_files', 'Website has a detail file for every port_id', missingDetail.length === 0, missingDetail);
  check('ERROR', 'website.stats', 'Website statistics match recomputed totals',
    index.stats.total_records === json.length && index.stats.countries === countryMap.size && index.stats.with_coordinates === json.filter(hasCoordinates).length && index.stats.with_unlocode === codes.length);
} else {
  check('ERROR', 'website.index_exists', 'Website data index exists (run npm run build:data)', false);
}
const apiModule = join(RELEASE_ROOT, 'api', 'src', 'data', 'dataset.generated.mjs');
if (existsSync(apiModule)) {
  const { default: apiData } = await import(`file://${apiModule.replaceAll('\\', '/')}`);
  check('ERROR', 'api.dataset_module', 'API dataset module holds every record and source', apiData.records.length === json.length && apiData.sources.length === sources.rows.length);
} else {
  check('ERROR', 'api.dataset_module', 'API dataset module exists (run npm run build:data)', false);
}

// ---------------------------------------------------------------------------
// Report

const failed = checks.filter((c) => !c.passed && c.level === 'ERROR');
const report = {
  dataset: payload.dataset,
  version: payload.version,
  validated_at: new Date().toISOString(),
  scope: 'Automated structural, cross-format and plausibility checks. Not an independent verification of the underlying research.',
  summary: {
    checks: checks.length,
    passed: checks.filter((c) => c.passed).length,
    failed: failed.length,
    warnings: findings.filter((f) => f.level === 'WARNING' && f.count > 0).length,
  },
  checks,
  findings,
};

const outDir = join(RELEASE_ROOT, 'docs', 'validation');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'validation-report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(outDir, 'VALIDATION_REPORT.md'), renderMarkdown(report));
// The GitHub package carries its own copy of the release report.
const ghReports = join(RELEASE_ROOT, 'github-release', 'reports');
mkdirSync(ghReports, { recursive: true });
writeFileSync(join(ghReports, 'release-validation-report.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(join(ghReports, 'release-validation-report.md'), renderMarkdown(report));

for (const c of checks) console.log(`${c.passed ? 'PASS' : c.level === 'ERROR' ? 'FAIL' : 'WARN'}  ${c.id}: ${c.description}`);
for (const f of findings) console.log(`${f.level.padEnd(7)} ${f.id}: ${f.count} item(s)`);
console.log(`\n${report.summary.passed}/${report.summary.checks} checks passed, ${report.summary.failed} failed, ${report.summary.warnings} warning finding(s).`);
console.log('Report: docs/validation/VALIDATION_REPORT.md');
process.exit(failed.length ? 1 : 0);

function renderMarkdown(r) {
  const lines = [
    `# ShipPortX v${r.version} Validation Report`,
    '',
    `Generated by \`scripts/validate.mjs\` at ${r.validated_at}.`,
    '',
    `> **Scope.** ${r.scope} A passing check means the published files are internally consistent and well-formed. It does not mean a port's existence, status or specifications have been re-verified.`,
    '',
    `**Result:** ${r.summary.passed}/${r.summary.checks} checks passed · ${r.summary.failed} failed · ${r.summary.warnings} warning finding(s).`,
    '',
    '## Checks',
    '',
    '| Result | Level | Check | Description |',
    '|---|---|---|---|',
    ...r.checks.map((c) => `| ${c.passed ? '✅ pass' : '❌ fail'} | ${c.level} | \`${c.id}\` | ${c.description} |`),
    '',
    '## Findings',
    '',
    'Findings describe the data exactly as published. Nothing listed here was changed.',
    '',
  ];
  for (const f of r.findings) {
    lines.push(`### ${f.level}: \`${f.id}\` (${f.count})`, '', f.description, '');
    if (!f.count) { lines.push('_None._', ''); continue; }
    for (const item of f.items.slice(0, 60)) {
      if (typeof item === 'string') lines.push(`- \`${item}\``);
      else if (item.issues) lines.push(`- \`${item.port_id}\``, ...item.issues.map((i) => `  - ${i}`));
      else lines.push(`- ${Object.entries(item).map(([k, v]) => `${k}: \`${Array.isArray(v) ? v.join(', ') : v}\``).join(' · ')}`);
    }
    if (f.items.length > 60) lines.push(`- … ${f.items.length - 60} more (see validation-report.json)`);
    lines.push('');
  }
  return lines.join('\n');
}
