// Shared loaders and derivations for the ShipPortX release tooling. Nothing here writes data.
// Default paths point at the release workspace (../Data); every loader also accepts a directory,
// which is how the standalone GitHub validator (scripts/validate.mjs) uses it.

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parquetReadObjects } from 'hyparquet';
import { parseCsv } from './csv.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const RELEASE_ROOT = resolve(here, '..', '..');
export const PROJECT_ROOT = resolve(RELEASE_ROOT, '..');
export const SOURCE_DATA_DIR = join(PROJECT_ROOT, 'Data');
// The research corpus lives in a separate local repo that is never published. Set
// SHIPPORTX_RESEARCH_DIR to use another location.
export const RESEARCH_REPO_DIR = process.env.SHIPPORTX_RESEARCH_DIR
  ? resolve(process.env.SHIPPORTX_RESEARCH_DIR)
  : resolve(PROJECT_ROOT, '..', 'ShipPortX-Research');
export const SOURCE_RESEARCH_DIR = join(RESEARCH_REPO_DIR, 'ShipPortX');

export const DATA_FILES = {
  json: 'shipportx.json',
  jsonl: 'shipportx.jsonl',
  csv: 'shipportx.csv',
  parquet: 'shipportx.parquet',
  sources: 'sources.csv',
};

export const OPERATING_STATUSES = [
  'ACTIVE',
  'ACTIVE_LIMITED',
  'SEASONAL',
  'INACTIVE',
  'HISTORICAL',
  'UNDER_CONSTRUCTION',
  'PROPOSED',
  'ABANDONED',
  'UNKNOWN',
];

export const CONFIDENCE_LEVELS = ['CONFIRMED', 'STRONG', 'SUPPORTED', 'UNVERIFIED', 'CONFLICTING', 'UNKNOWN'];

// UN/LOCODE: 2-letter country code + 3 characters from A-Z and 2-9.
export const UNLOCODE_PATTERN = /^[A-Z]{2}[A-Z2-9]{3}$/;

export function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function loadJson(dir = SOURCE_DATA_DIR) {
  return JSON.parse(readFileSync(join(dir, DATA_FILES.json), 'utf8'));
}

export function loadJsonl(dir = SOURCE_DATA_DIR) {
  return readFileSync(join(dir, DATA_FILES.jsonl), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line));
}

export function loadCsv(dir = SOURCE_DATA_DIR) {
  return parseCsv(readFileSync(join(dir, DATA_FILES.csv), 'utf8'));
}

export function loadSources(dir = SOURCE_DATA_DIR) {
  return parseCsv(readFileSync(join(dir, DATA_FILES.sources), 'utf8'));
}

export async function loadParquet(dir = SOURCE_DATA_DIR) {
  const buf = readFileSync(join(dir, DATA_FILES.parquet));
  const file = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return parquetReadObjects({ file });
}

// Port of scripts/build_dataset.py::derive_primary_token (the rule that produced
// port_type_primary / operating_status_primary in the original flat exports).
export function derivePrimaryToken(value) {
  if (!value) return null;
  const stripped = value.trim().replace(/\s*\(.*?\)\s*/g, ' ').trim();
  const first = stripped.split(/\s*\/\s*|\s*,\s*/)[0].trim();
  return first || null;
}

export function isValidUnlocode(value) {
  return typeof value === 'string' && UNLOCODE_PATTERN.test(value);
}

export function hasCoordinates(record) {
  return Number.isFinite(record.latitude) && Number.isFinite(record.longitude);
}

export function isFilled(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// Merge the nested JSON records with the derived convenience columns that only the
// flat exports carry. CSV values are authoritative for those two columns.
export function mergeRecords(jsonRecords, csvRows) {
  const byId = new Map(csvRows.map((row) => [row.port_id, row]));
  return jsonRecords.map((record) => {
    const flat = byId.get(record.port_id);
    return {
      ...record,
      port_type_primary: flat?.port_type_primary || null,
      operating_status_primary: flat?.operating_status_primary || null,
      // Release-level derived convenience value (same rule as port_type_primary); not a research fact.
      commercial_status_primary: derivePrimaryToken(record.commercial_status),
    };
  });
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) ?? null;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

const COMPLETENESS_FIELDS = [
  'official_name',
  'country',
  'city',
  'administrative_area',
  'port_type',
  'primary_activity',
  'commercial_status',
  'operating_status',
  'latitude',
  'unlocode',
  'port_authority',
  'cargo_types',
  'terminals',
  'number_of_berths',
  'max_draft_m',
  'annual_throughput_tonnage',
  'annual_throughput_teu',
  'rail_connection',
  'road_connection',
  'website',
];

export function computeStats(records, sourceRows) {
  const total = records.length;
  const verified = records.filter((r) => r.research_status === 'VERIFIED');
  const countries = new Map();
  for (const r of records) {
    const c = countries.get(r.country_code) || {
      country: r.country,
      country_code: r.country_code,
      country_code_iso3: r.country_code_iso3,
      region_continental: r.region_continental,
      record_count: 0,
      verified_count: 0,
      with_coordinates: 0,
    };
    c.record_count++;
    if (r.research_status === 'VERIFIED') c.verified_count++;
    if (hasCoordinates(r)) c.with_coordinates++;
    countries.set(r.country_code, c);
  }

  const unlocodeRecorded = records.filter((r) => isValidUnlocode(r.unlocode));
  const completeness = COMPLETENESS_FIELDS.map((field) => {
    const filled = records.filter((r) => isFilled(r[field]) && !(field === 'unlocode' && !isValidUnlocode(r[field]))).length;
    return { field: field === 'latitude' ? 'coordinates' : field, filled, total, percent: round1((filled / total) * 100) };
  });

  return {
    total_records: total,
    verified_records: verified.length,
    non_verified_records: total - verified.length,
    research_status: countBy(records, (r) => r.research_status),
    countries: countries.size,
    regions: countBy(records, (r) => r.region_continental),
    with_coordinates: records.filter(hasCoordinates).length,
    without_coordinates: records.filter((r) => !hasCoordinates(r)).length,
    with_unlocode: unlocodeRecorded.length,
    unlocode_explicit_unknown: records.filter((r) => r.unlocode === 'UNKNOWN').length,
    unlocode_other_text: records.filter((r) => isFilled(r.unlocode) && r.unlocode !== 'UNKNOWN' && !isValidUnlocode(r.unlocode)).length,
    with_source_ids: records.filter((r) => isFilled(r.source_ids)).length,
    verified_without_source_ids: verified.filter((r) => !isFilled(r.source_ids)).length,
    source_register_entries: sourceRows.length,
    port_type_primary: countBy(records, (r) => r.port_type_primary),
    operating_status_primary: countBy(records, (r) => r.operating_status_primary),
    commercial_status_primary: countBy(records, (r) => r.commercial_status_primary),
    confidence_core: countBy(records, (r) => r.confidence_core),
    completeness,
    field_counts: Object.fromEntries(
      Object.keys(records[0] || {})
        .filter((k) => k !== 'fields_detail')
        .map((k) => [k, records.filter((r) => isFilled(r[k])).length]),
    ),
    with_fields_detail: records.filter((r) => r.fields_detail && Object.keys(r.fields_detail).length).length,
    countries_list: [...countries.values()].sort((a, b) => a.country.localeCompare(b.country)),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
