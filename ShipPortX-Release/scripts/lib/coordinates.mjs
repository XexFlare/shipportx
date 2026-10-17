// Cross-checks the published latitude/longitude against the coordinate text recorded in the
// research table (fields_detail.lat_lon_raw.value). Findings are reported, never applied.

import { checkCoordinates } from './country-bounds.mjs';

const COMPONENT =
  /([-−–]?)\s*(\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′])?\s*(?:(\d+(?:\.\d+)?)\s*["″])?\s*([NSEW])?/;

function parseComponent(text) {
  const m = text.match(COMPONENT);
  if (!m) return null;
  const [, minus, deg, min, sec, hemi] = m;
  const magnitude = Number(deg) + (min ? Number(min) / 60 : 0) + (sec ? Number(sec) / 3600 : 0);
  const hasMinus = minus !== '';
  const hemiSign = hemi ? (hemi === 'S' || hemi === 'W' ? -1 : 1) : null;
  return {
    magnitude,
    hemi: hemi || null,
    hasMinus,
    // Hemisphere letter wins when present (this is how the original build read it).
    value: magnitude * (hemiSign ?? (hasMinus ? -1 : 1)),
    signConflict: hasMinus && hemiSign === 1,
  };
}

export function parseRawCoordinates(raw) {
  if (typeof raw !== 'string') return null;
  const withoutNotes = raw.replace(/\([^)]*\)/g, '').replace(/≈/g, '');
  const parts = withoutNotes.split(',');
  if (parts.length < 2) return null;
  const lat = parseComponent(parts[0]);
  const lon = parseComponent(parts[1]);
  if (!lat || !lon) return null;
  return { lat, lon };
}

const TOLERANCE = 0.001;

// Returns a list of findings ({ code, message }) for one record.
export function coordinateFindings(record) {
  const findings = [];
  const bounds = checkCoordinates(record);
  if (bounds) findings.push(bounds);

  const raw = record.fields_detail?.lat_lon_raw?.value;
  const parsed = parseRawCoordinates(raw);
  const hasPublished = Number.isFinite(record.latitude) && Number.isFinite(record.longitude);
  if (!parsed || !hasPublished) return findings;

  for (const [axis, comp, published] of [
    ['latitude', parsed.lat, record.latitude],
    ['longitude', parsed.lon, record.longitude],
  ]) {
    if (comp.signConflict) {
      findings.push({
        code: 'raw_coordinate_sign_conflict',
        message: `Research text "${raw}" gives the ${axis} with both a minus sign and a ${comp.hemi} hemisphere; it was published as ${published}. The minus sign suggests ${-comp.magnitude}.`,
      });
    } else if (Math.abs(comp.value - published) > TOLERANCE) {
      findings.push({
        code: 'coordinates_differ_from_research_text',
        message: `Published ${axis} ${published} differs from the research text "${raw}", which reads as ${round(comp.value)}.`,
      });
    }
  }
  return findings;
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}
