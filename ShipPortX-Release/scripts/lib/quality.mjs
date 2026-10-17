// Release-level quality annotations. These describe problems found by automated checks;
// they never change the published values.

import { coordinateFindings } from './coordinates.mjs';
import { isValidUnlocode } from './dataset.mjs';

export const COORDINATE_FLAG_CODES = [
  'coordinates_out_of_range',
  'coordinates_outside_country',
  'raw_coordinate_sign_conflict',
  'coordinates_differ_from_research_text',
];

export function qualityFlags(record) {
  const flags = coordinateFindings(record).map(({ code, message }) => ({ code, message }));
  if (isValidUnlocode(record.unlocode) && record.unlocode.slice(0, 2) !== record.country_code) {
    flags.push({
      code: 'unlocode_country_prefix_mismatch',
      message: `UN/LOCODE ${record.unlocode} does not start with the record's country code ${record.country_code}.`,
    });
  }
  return flags;
}

export function hasCoordinateFlag(record) {
  return (record.quality_flags || []).some((f) => COORDINATE_FLAG_CODES.includes(f.code));
}
