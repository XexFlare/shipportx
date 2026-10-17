// Query the ShipPortX API. Set SHIPPORTX_API to your deployment, e.g.
//   SHIPPORTX_API=https://<your-site>.netlify.app node examples/javascript/api-client.mjs
const BASE = process.env.SHIPPORTX_API;
if (!BASE) {
  console.error('Set SHIPPORTX_API to the base URL of a deployed ShipPortX API.');
  process.exit(1);
}

async function get(path) {
  const res = await fetch(new URL(path, BASE));
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${body.error?.code}: ${body.error?.message}`);
  return body;
}

console.log(await get('/api/health'));

// Page through every active Tanzanian port
let next = '/api/v1/ports?country=TZ&operating_status=ACTIVE&limit=100';
const ports = [];
while (next) {
  const page = await get(next);
  ports.push(...page.data);
  next = page.links.next;
}
console.log(`${ports.length} active ports in Tanzania`);

const detail = await get('/api/v1/ports/TZ-dar-es-salaam');
console.log(detail.data.official_name, detail.data.sources.map((s) => s.source_id));
