// Read the CSV and the source register, and resolve a record's sources.
//   node examples/javascript/read-csv.mjs
import { readFileSync } from 'node:fs';
import { parseCsv } from '../../scripts/lib/csv.mjs';

const read = (name) => parseCsv(readFileSync(new URL(`../../data/${name}`, import.meta.url), 'utf8')).rows;
const ports = read('shipportx.csv');
const sources = new Map(read('sources.csv').map((s) => [s.source_id, s]));

// CSV conventions: empty cell = null; list fields are joined with "; ".
const lakePorts = ports.filter((p) => p.port_type_primary === 'lake_port');
console.log(`${lakePorts.length} lake ports, e.g. ${lakePorts.slice(0, 3).map((p) => p.official_name).join(', ')}`);

const port = ports.find((p) => p.port_id === 'TZ-dar-es-salaam');
const ids = port.source_ids ? port.source_ids.split('; ') : [];
console.log(`\n${port.official_name} cites ${ids.length} source(s):`);
for (const id of ids) console.log(`  ${id}: ${sources.get(id)?.source_name}`);
