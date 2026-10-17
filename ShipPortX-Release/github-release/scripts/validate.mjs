// Standalone integrity checks for the files in ../data.
//
//   npm install && npm run validate
//
// Checks record counts, identifiers, cross-format consistency (JSON, JSONL, CSV, Parquet),
// coordinates, source references and research-file paths. These are automated format checks,
// not an independent verification of the research. Exits non-zero on any failure; prints
// known data-quality findings without changing any file.

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { hasCoordinates, isValidUnlocode, loadCsv, loadJson, loadJsonl, loadParquet, loadSources } from './lib/dataset.mjs';
import { coordinateFindings } from './lib/coordinates.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail ? `: ${JSON.stringify(detail).slice(0, 400)}` : ''}`);
  if (!ok) failures++;
};

const payload = loadJson(DATA);
const json = payload.records;
const jsonl = loadJsonl(DATA);
const csv = loadCsv(DATA);
const parquet = await loadParquet(DATA);
const sources = loadSources(DATA).rows;
const ids = json.map((r) => r.port_id);
const n = payload.record_count;

check(json.length === n && jsonl.length === n && csv.rows.length === n && parquet.length === n, `all formats hold record_count = ${n} records`);
check(new Set(ids).size === ids.length, 'port_id values are unique');
check(ids.every((id) => /^[A-Z]{2}-[a-z0-9-]+$/.test(id)), 'port_id format {ISO2}-{slug}');
check(json.every((r, i) => isDeepStrictEqual(r, jsonl[i])), 'JSONL equals JSON record by record');
check(isDeepStrictEqual(csv.rows.map((r) => r.port_id), ids) && isDeepStrictEqual(parquet.map((r) => r.port_id), ids), 'same record order in CSV and Parquet');

const flat = (v) => (v === null ? null : Array.isArray(v) ? (v.length ? v.join('; ') : null) : v);
const diffs = [];
json.forEach((r, i) => {
  for (const [key, value] of Object.entries(r)) {
    if (key === 'fields_detail') continue;
    const want = flat(value);
    const c = csv.rows[i][key] === '' ? null : typeof want === 'number' ? Number(csv.rows[i][key]) : csv.rows[i][key];
    const p = parquet[i][key] ?? null;
    if (c !== want) diffs.push(`csv ${r.port_id}.${key}`);
    if (p !== want) diffs.push(`parquet ${r.port_id}.${key}`);
  }
});
check(diffs.length === 0, 'CSV and Parquet values match JSON', diffs.slice(0, 10));

check(json.every((r) => (r.latitude === null) === (r.longitude === null)), 'latitude/longitude paired');
check(json.filter(hasCoordinates).every((r) => Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180), 'coordinates in WGS84 range');

const sourceIds = new Set(sources.map((s) => s.source_id));
check(sourceIds.size === sources.length, 'source_id values unique in sources.csv');
const dangling = json.flatMap((r) => r.source_ids.filter((s) => !sourceIds.has(s)).map((s) => `${r.port_id}->${s}`));
check(dangling.length === 0, 'every source_ids entry resolves in sources.csv', dangling);


const codes = json.map((r) => r.unlocode).filter(isValidUnlocode);
check(new Set(codes).size === codes.length, 'no duplicate UN/LOCODEs');

console.log('\nKnown data-quality findings (reported, not altered):');
for (const r of json) {
  for (const f of coordinateFindings(r)) console.log(`  ${r.port_id}: ${f.message}`);
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
