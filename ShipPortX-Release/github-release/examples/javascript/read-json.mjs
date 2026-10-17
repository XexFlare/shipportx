// Read the JSON file (records + metadata envelope) with Node.js 20+, no dependencies.
//   node examples/javascript/read-json.mjs
import { readFileSync } from 'node:fs';

const payload = JSON.parse(readFileSync(new URL('../../data/shipportx.json', import.meta.url), 'utf8'));
const { version, generated, record_count: count, records } = payload;
console.log(`ShipPortX ${version} (generated ${generated}): ${count} records`);

// Verified, currently active ports with coordinates
const active = records.filter((r) => r.research_status === 'VERIFIED' && r.operating_status === 'ACTIVE' && r.latitude !== null);
console.log(`Active verified ports with coordinates: ${active.length}`);

// Records per country (top 5)
const counts = {};
for (const r of records) counts[r.country] = (counts[r.country] || 0) + 1;
const perCountry = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);
console.table(perCountry);

// Field-level provenance for one record
const tema = records.find((r) => r.port_id === 'GH-tema');
console.log(tema.official_name, tema.fields_detail.operating_status);
