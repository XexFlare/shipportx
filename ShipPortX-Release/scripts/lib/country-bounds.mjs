// Approximate bounding boxes [minLon, minLat, maxLon, maxLat] for the countries present in
// ShipPortX, including offshore islands (e.g. Annobón, Rodrigues, Seychelles outer islands).
// Morocco's box includes Western Sahara because the dataset files Dakhla and Laâyoune under
// Morocco. Used only as a plausibility screen: a point inside the box is not proof that it is
// correct, and a point outside it is flagged for review, never altered.
export const COUNTRY_BOUNDS = {
  AO: [11.6, -18.1, 24.1, -4.35],
  BI: [29.0, -4.5, 30.85, -2.3],
  BJ: [0.75, 6.1, 3.85, 12.45],
  BW: [19.9, -26.95, 29.4, -17.75],
  CD: [12.2, -13.5, 31.35, 5.4],
  CF: [14.4, 2.2, 27.5, 11.05],
  CG: [11.1, -5.05, 18.65, 3.75],
  CI: [-8.6, 4.3, -2.45, 10.75],
  CM: [8.45, 1.65, 16.2, 13.1],
  CV: [-25.4, 14.75, -22.6, 17.25],
  DJ: [41.75, 10.9, 43.45, 12.75],
  DZ: [-8.7, 18.95, 12.0, 37.15],
  EG: [24.7, 21.7, 36.95, 31.7],
  ER: [36.4, 12.35, 43.15, 18.05],
  ET: [32.95, 3.4, 48.0, 14.9],
  GA: [8.65, -3.95, 14.55, 2.35],
  GH: [-3.3, 4.7, 1.25, 11.2],
  GM: [-16.85, 13.05, -13.75, 13.85],
  GN: [-15.1, 7.15, -7.6, 12.7],
  GQ: [5.6, -1.5, 11.35, 3.8],
  GW: [-16.75, 10.85, -13.6, 12.7],
  KE: [33.9, -4.75, 41.95, 5.05],
  KM: [43.2, -12.45, 44.55, -11.35],
  LR: [-11.5, 4.3, -7.35, 8.6],
  LY: [9.3, 19.5, 25.2, 33.2],
  MA: [-17.15, 20.75, -0.95, 35.95],
  MG: [43.15, -25.65, 50.55, -11.9],
  ML: [-12.25, 10.15, 4.25, 25.0],
  MR: [-17.1, 14.7, -4.8, 27.3],
  MU: [56.5, -20.6, 63.6, -10.3],
  MW: [32.65, -17.15, 35.95, -9.35],
  MZ: [30.2, -26.9, 40.9, -10.45],
  NA: [11.7, -29.0, 25.3, -16.95],
  NE: [0.15, 11.65, 16.0, 23.55],
  NG: [2.65, 4.25, 14.7, 13.9],
  RW: [28.85, -2.85, 30.9, -1.05],
  SC: [46.2, -10.3, 56.3, -3.7],
  SD: [21.8, 8.6, 38.65, 22.25],
  SL: [-13.35, 6.9, -10.25, 10.0],
  SN: [-17.55, 12.3, -11.35, 16.7],
  SO: [40.95, -1.7, 51.45, 12.05],
  SS: [23.4, 3.45, 35.95, 12.25],
  ST: [6.45, -0.05, 7.5, 1.75],
  TD: [13.45, 7.4, 24.0, 23.5],
  TG: [-0.15, 6.1, 1.85, 11.15],
  TN: [7.5, 30.2, 11.6, 37.55],
  TZ: [29.3, -11.75, 40.45, -0.95],
  UG: [29.55, -1.5, 35.05, 4.25],
  ZA: [16.4, -34.85, 32.95, -22.1],
  ZM: [21.95, -18.1, 33.7, -8.2],
  ZW: [25.2, -22.45, 33.1, -15.6],
};

// Tolerance for coastal ports, offshore terminals and rounded coordinates.
const PAD = 0.3;

export function inBounds(code, lat, lon) {
  const box = COUNTRY_BOUNDS[code];
  if (!box) return null;
  const [minLon, minLat, maxLon, maxLat] = box;
  return lon >= minLon - PAD && lon <= maxLon + PAD && lat >= minLat - PAD && lat <= maxLat + PAD;
}

// Returns null when the coordinates look plausible, otherwise a finding describing why not.
export function checkCoordinates(record) {
  const { latitude: lat, longitude: lon, country_code: code } = record;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return { code: 'coordinates_out_of_range', message: `(${lat}, ${lon}) is not a valid WGS84 coordinate.` };
  }
  const ok = inBounds(code, lat, lon);
  if (ok === null) {
    return { code: 'coordinates_unchecked', message: `No bounding box for country code ${code}.` };
  }
  if (ok) return null;
  const hints = [];
  if (inBounds(code, -lat, lon)) hints.push('latitude sign appears inverted');
  if (inBounds(code, lat, -lon)) hints.push('longitude sign appears inverted');
  if (inBounds(code, lon, lat)) hints.push('latitude/longitude appear swapped');
  return {
    code: 'coordinates_outside_country',
    message: `(${lat}, ${lon}) falls outside the approximate bounds of ${record.country}${hints.length ? `: ${hints.join('; ')}` : ''}.`,
    hints,
  };
}
