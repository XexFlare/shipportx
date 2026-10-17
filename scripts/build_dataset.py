#!/usr/bin/env python3
"""
ShipPortX dataset builder.

Parses the Markdown research corpus (ShipPortX-Research/ShipPortX/ports/**, discovered/**, sources/**)
into the canonical ShipPortX schema and emits CSV / JSON / JSONL / Parquet derived artifacts
plus a validation report and summary statistics.

The Markdown files remain the source of truth. This script never writes back into the research repo.
"""
import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# Project layout: ../ShipPortX-Research/ShipPortX (input, a separate local repo that is never published),
# <project>/Data and <project>/reports (output). Set SHIPPORTX_RESEARCH_DIR to use another location.
ROOT = Path(__file__).resolve().parent.parent
RESEARCH_REPO = Path(os.environ.get("SHIPPORTX_RESEARCH_DIR") or ROOT.parent / "ShipPortX-Research")
RESEARCH = RESEARCH_REPO / "ShipPortX"
PORTS_DIR = RESEARCH / "ports"
DISCOVERED_DIR = RESEARCH / "discovered"
SOURCES_DIR = RESEARCH / "sources"
DATA_DIR = ROOT / "Data"
REPORTS_DIR = ROOT / "reports"

DATASET_VERSION = "1.0.0"
SCHEMA_VERSION = "1.0"
RESEARCH_CUTOFF_DATE = "2026-08-23"
GENERATION_DATE = "2026-08-23"

# ---------------------------------------------------------------------------
# Country metadata: folder-slug -> (canonical name, ISO2, ISO3, region)
# ---------------------------------------------------------------------------
COUNTRY_META = {
    "algeria": ("Algeria", "DZ", "DZA", "North Africa"),
    "angola": ("Angola", "AO", "AGO", "Southern Africa"),
    "benin": ("Benin", "BJ", "BEN", "West Africa"),
    "botswana": ("Botswana", "BW", "BWA", "Southern Africa"),
    "burkina-faso": ("Burkina Faso", "BF", "BFA", "West Africa"),
    "burundi": ("Burundi", "BI", "BDI", "East Africa"),
    "cabo-verde": ("Cabo Verde", "CV", "CPV", "West Africa"),
    "cameroon": ("Cameroon", "CM", "CMR", "Central Africa"),
    "central-african-republic": ("Central African Republic", "CF", "CAF", "Central Africa"),
    "chad": ("Chad", "TD", "TCD", "Central Africa"),
    "comoros": ("Comoros", "KM", "COM", "Island Africa"),
    "cote-divoire": ("Côte d'Ivoire", "CI", "CIV", "West Africa"),
    "djibouti": ("Djibouti", "DJ", "DJI", "East Africa"),
    "dr-congo": ("Democratic Republic of the Congo", "CD", "COD", "Central Africa"),
    "egypt": ("Egypt", "EG", "EGY", "North Africa"),
    "equatorial-guinea": ("Equatorial Guinea", "GQ", "GNQ", "Central Africa"),
    "eritrea": ("Eritrea", "ER", "ERI", "East Africa"),
    "eswatini": ("Eswatini", "SZ", "SWZ", "Southern Africa"),
    "ethiopia": ("Ethiopia", "ET", "ETH", "East Africa"),
    "gabon": ("Gabon", "GA", "GAB", "Central Africa"),
    "gambia": ("The Gambia", "GM", "GMB", "West Africa"),
    "ghana": ("Ghana", "GH", "GHA", "West Africa"),
    "guinea": ("Guinea", "GN", "GIN", "West Africa"),
    "guinea-bissau": ("Guinea-Bissau", "GW", "GNB", "West Africa"),
    "kenya": ("Kenya", "KE", "KEN", "East Africa"),
    "lesotho": ("Lesotho", "LS", "LSO", "Southern Africa"),
    "liberia": ("Liberia", "LR", "LBR", "West Africa"),
    "libya": ("Libya", "LY", "LBY", "North Africa"),
    "madagascar": ("Madagascar", "MG", "MDG", "Island Africa"),
    "malawi": ("Malawi", "MW", "MWI", "East Africa"),
    "mali": ("Mali", "ML", "MLI", "West Africa"),
    "mauritania": ("Mauritania", "MR", "MRT", "West Africa"),
    "mauritius": ("Mauritius", "MU", "MUS", "Island Africa"),
    "morocco": ("Morocco", "MA", "MAR", "North Africa"),
    "mozambique": ("Mozambique", "MZ", "MOZ", "East Africa"),
    "namibia": ("Namibia", "NA", "NAM", "Southern Africa"),
    "niger": ("Niger", "NE", "NER", "West Africa"),
    "nigeria": ("Nigeria", "NG", "NGA", "West Africa"),
    "republic-of-congo": ("Republic of the Congo", "CG", "COG", "Central Africa"),
    "rwanda": ("Rwanda", "RW", "RWA", "East Africa"),
    "sao-tome-and-principe": ("São Tomé and Príncipe", "ST", "STP", "Central Africa"),
    "senegal": ("Senegal", "SN", "SEN", "West Africa"),
    "seychelles": ("Seychelles", "SC", "SYC", "Island Africa"),
    "sierra-leone": ("Sierra Leone", "SL", "SLE", "West Africa"),
    "somalia": ("Somalia", "SO", "SOM", "East Africa"),
    "south-africa": ("South Africa", "ZA", "ZAF", "Southern Africa"),
    "south-sudan": ("South Sudan", "SS", "SSD", "East Africa"),
    "sudan": ("Sudan", "SD", "SDN", "North Africa"),
    "tanzania": ("Tanzania", "TZ", "TZA", "East Africa"),
    "togo": ("Togo", "TG", "TGO", "West Africa"),
    "tunisia": ("Tunisia", "TN", "TUN", "North Africa"),
    "uganda": ("Uganda", "UG", "UGA", "East Africa"),
    "zambia": ("Zambia", "ZM", "ZMB", "Southern Africa"),
    "zimbabwe": ("Zimbabwe", "ZW", "ZWE", "Southern Africa"),
}

# ---------------------------------------------------------------------------
# Field-name normalization: raw markdown field label -> canonical schema field
# Built from direct inspection of the corpus (see reports/field_inventory.json)
# ---------------------------------------------------------------------------
FIELD_MAP = {
    "port_name": "official_name",
    "alternative_names": "alternate_names",
    "unlocode": "unlocode",
    "country": "country_raw",
    "administrative_area": "administrative_area",
    "region": "region",
    "nearby_city": "city",
    "nearby_city / settlement": "city",
    "settlement": "city",
    "part_of": "part_of",
    "part_of / related_port": "part_of",
    "related_port": "part_of",
    "port_type": "port_type",
    "primary_activity": "primary_activity",
    "secondary_activities": "secondary_activities",
    "commercial_status": "commercial_status",
    "operating_status": "operating_status",
    "latitude": "latitude",
    "longitude": "longitude",
    "latitude / longitude": "lat_lon_raw",
    "approach_notes": "approach_notes",
    "port_authority": "port_authority",
    "port_authority / operator": "port_authority",
    "operator": "port_authority",
    "ownership": "ownership",
    "year_established": "year_established",
    "port_area": "port_area",
    "water_area": "water_area",
    "number_of_berths": "number_of_berths",
    "number_of_terminals": "number_of_terminals",
    "berth_length_total": "berth_length_total",
    "max_vessel_length": "max_vessel_length",
    "turning_basin": "turning_basin",
    "cargo_types": "cargo_types",
    "annual_throughput_teu": "annual_throughput_teu",
    "annual_throughput_tonnage": "annual_throughput_tonnage",
    "annual_throughput_notes": "annual_throughput_notes",
    "annual_throughput": "annual_throughput_notes",
    "storage_capacity": "storage_capacity",
    "berth_capacity_notes": "berth_capacity_notes",
    "terminals": "terminals",
    "cranes_equipment": "cranes_equipment",
    "storage_facilities": "storage_facilities",
    "road_connection": "road_connection",
    "rail_connection": "rail_connection",
    "inland_waterway_connection": "inland_waterway_connection",
    "nearby_airport": "nearby_airport",
    "max_draft_m": "max_draft_m",
    "channel_depth_m": "channel_depth_m",
    "berth_depth_m": "berth_depth_m",
    "tidal_restrictions": "tidal_restrictions",
    "pilotage": "pilotage",
    "tug_availability": "tug_availability",
    "access_restrictions": "access_restrictions",
    "hours_of_operation": "hours_of_operation",
    "seasonal_limitations": "seasonal_limitations",
    "major_restrictions": "major_restrictions",
    "website": "website",
    "notes": "general_notes",
    "vessel_capability": "vessel_capability",
    "vessel_traffic": "vessel_traffic_notes",
    "adjacent_facilities": "adjacent_facilities",
    "approach": "approach_notes",
    "under_construction": "under_construction_notes",
    "quay_length": "berth_length_total",
    "vehicle_handling": "cranes_equipment",
    "container_terminal_capacity": "annual_throughput_teu",
    "project_budget": "under_construction_notes",
    "project_completion": "under_construction_notes",
    "target_start": "under_construction_notes",
    "year_established_major_upgrade": "year_established",
    "year_established / major_upgrade": "year_established",
}

CANONICAL_ORDER = [
    # IDENTITY
    "port_id", "official_name", "alternate_names", "country", "country_code",
    "country_code_iso3", "region_continental", "administrative_area", "city",
    "port_type", "part_of",
    # LOCATION
    "latitude", "longitude", "unlocode",
    # ACTIVITY
    "primary_activity", "secondary_activities", "cargo_types",
    "commercial_status", "operating_status",
    # INFRASTRUCTURE
    "port_authority", "ownership", "year_established", "port_area", "water_area",
    "number_of_berths", "number_of_terminals", "berth_length_total",
    "max_vessel_length", "turning_basin", "terminals", "cranes_equipment",
    "storage_facilities", "max_draft_m", "channel_depth_m", "berth_depth_m",
    "tidal_restrictions", "pilotage", "tug_availability", "access_restrictions",
    # CAPACITY
    "annual_throughput_teu", "annual_throughput_tonnage", "storage_capacity",
    "berth_capacity_notes", "annual_throughput_notes",
    # CONNECTIVITY
    "road_connection", "rail_connection", "inland_waterway_connection", "nearby_airport",
    # OPERATIONS
    "hours_of_operation", "seasonal_limitations", "major_restrictions", "website",
    "general_notes", "vessel_capability", "vessel_traffic_notes", "adjacent_facilities",
    "under_construction_notes",
    # PROVENANCE / QUALITY
    "research_status", "confidence_core", "source_ids", "record_path",
    "last_verified", "research_notes",
]

LIST_FIELDS = {"alternate_names", "secondary_activities", "cargo_types", "terminals", "source_ids"}

TABLE_ROW_RE = re.compile(r"^\|(.+)\|\s*$")
# Port file titles read "# <port name>: <country>". The legacy em dash separator (U+2014)
# is still accepted so older research files parse the same way.
def record_path(path):
    # Stable, lowercase identifier for the research file, independent of folder casing.
    return "research/ShipPortX/" + path.relative_to(RESEARCH).as_posix()


H1_RE = re.compile(r"^#\s+(.+?)(?::|\s+\u2014)\s+(.+?)\s*$")


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def split_pipe_row(line):
    inner = line.strip()
    if inner.startswith("|"):
        inner = inner[1:]
    if inner.endswith("|"):
        inner = inner[:-1]
    return [c.strip() for c in inner.split("|")]


def is_separator_row(cells):
    return all(re.fullmatch(r":?-{2,}:?", c.strip()) for c in cells if c.strip() != "") and any(
        "-" in c for c in cells
    )


def parse_markdown_tables(text):
    """Return list of (field, value, confidence, source, notes) 5-col rows found anywhere in the file."""
    rows = []
    for line in text.splitlines():
        m = TABLE_ROW_RE.match(line)
        if not m:
            continue
        cells = split_pipe_row(line)
        if len(cells) != 5:
            continue
        if cells[0].lower() in ("field",):
            continue
        if is_separator_row(cells):
            continue
        rows.append(tuple(cells))
    return rows


def parse_h1(text):
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("# "):
            m = H1_RE.match(line)
            if m:
                return m.group(1).strip(), m.group(2).strip()
            return line[2:].strip(), None
    return None, None


def parse_footer(text):
    status, verified = None, None
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("**Research status:**"):
            status = s.split("**Research status:**", 1)[1].strip()
        elif s.startswith("**Last verified:**"):
            verified = s.split("**Last verified:**", 1)[1].strip().rstrip(".")
    return status, verified


def norm_key(raw):
    return raw.strip().lower()


def extract_sources(source_cell):
    # Source cell often like "GH-01, GH-06" or "GH-07 (range) vs. ...": extract ID-like tokens.
    ids = re.findall(r"\b[A-Z]{2,3}-\d{2,3}\b", source_cell)
    return sorted(set(ids), key=lambda x: (x.split("-")[0], int(x.split("-")[1])))


def first_number(text):
    if text is None:
        return None
    m = re.search(r"-?\d+\.\d+|-?\d+", text.replace("−", "-"))
    return float(m.group(0)) if m else None


def parse_latlon(raw_value):
    """Parse strings like '5.63285° N, 0.01270° E' or '-4.322°S, 15.307°E' into signed decimal degrees."""
    if not raw_value:
        return None, None
    txt = raw_value.replace("’", "'").strip()
    parts = re.split(r",|;", txt)
    if len(parts) < 2:
        return None, None
    lat_txt, lon_txt = parts[0], parts[1]
    lat = coordinate_to_signed(lat_txt, "N", "S")[0]
    lon = coordinate_to_signed(lon_txt, "E", "W")[0]
    return lat, lon


DMS_RE = re.compile(r"(\d+(?:\.\d+)?)\s*°\s*(\d+(?:\.\d+)?)\s*'(?:\s*(\d+(?:\.\d+)?)\s*\")?")


def coordinate_to_signed(part, pos_letters, neg_letters):
    """Return (signed degrees, sign_conflict) for one coordinate such as '4.05° S' or '14°40'50"N'.

    Degrees-minutes-seconds are converted in full. A minus sign that contradicts the hemisphere
    letter (e.g. '-4.05° N') is reported as a conflict; the letter wins, as before.
    """
    part = part.replace("−", "-").replace("″", '"').replace("′", "'")
    first_digit = re.search(r"\d", part)
    dms = DMS_RE.match(part, first_digit.start()) if first_digit else None
    if dms:
        deg, mins, secs = (float(g) if g else 0.0 for g in dms.groups())
        num = deg + mins / 60 + secs / 3600
        if "-" in part[: dms.start() + 1]:
            num = -num
    else:
        num = first_number(part)
    if num is None:
        return None, False
    letter = None
    for ch in re.sub(r"[^A-Za-z]", " ", part).upper().split():
        if ch in pos_letters or ch in neg_letters:
            letter = ch
            break
    conflict = False
    if letter is not None and letter in neg_letters:
        conflict = num > 0 and "-" in part
        num = -abs(num)
    elif letter is not None and letter in pos_letters:
        conflict = num < 0
        num = abs(num)
    return round(num, 6), conflict


def latlon_sign_conflict(raw_value):
    """True when either half of a 'lat, lon' research value has a sign that contradicts its letter."""
    if not raw_value:
        return False
    parts = re.split(r",|;", raw_value)
    if len(parts) < 2:
        return False
    return coordinate_to_signed(parts[0], "N", "S")[1] or coordinate_to_signed(parts[1], "E", "W")[1]


def load_port_record(path, country_slug):
    text = path.read_text(encoding="utf-8")
    rows = parse_markdown_tables(text)
    h1_name, h1_country = parse_h1(text)
    research_status_footer, last_verified = parse_footer(text)

    raw = {}
    all_source_ids = set()
    confidences_seen = []
    for field, value, confidence, source, notes in rows:
        key = norm_key(field)
        canon = FIELD_MAP.get(key)
        ids = extract_sources(source)
        all_source_ids.update(ids)
        if confidence:
            confidences_seen.append(confidence.strip().upper())
        if canon is None:
            # unmapped field: keep under a namespaced raw key so nothing is silently dropped
            canon = f"raw__{re.sub(r'[^a-z0-9]+', '_', key).strip('_')}"
        entry = {"value": value, "confidence": confidence, "source": source, "notes": notes}
        if canon in raw:
            # duplicate field name in same file (rare) - keep first, note the rest
            raw.setdefault("_duplicate_fields", []).append((canon, entry))
        else:
            raw[canon] = entry

    rec = {"fields_detail": {k: v for k, v in raw.items() if not k.startswith("_")}}

    def val(canon):
        d = raw.get(canon)
        return d["value"] if d else None

    def conf(canon):
        d = raw.get(canon)
        return d["confidence"] if d else None

    official_name = val("official_name") or h1_name
    country_disp, iso2, iso3, region = COUNTRY_META.get(
        country_slug, (h1_country or country_slug, None, None, None)
    )

    lat = val("latitude")
    lon = val("longitude")
    if lat is None and lon is None and val("lat_lon_raw"):
        lat, lon = parse_latlon(val("lat_lon_raw"))
    else:
        lat = first_number(lat) if lat else None
        lon = first_number(lon) if lon else None

    port_id = f"{iso2 or country_slug.upper()}-{slugify(path.stem)}"

    rec.update(
        {
            "port_id": port_id,
            "official_name": official_name,
            "alternate_names": val("alternate_names"),
            "country": country_disp,
            "country_code": iso2,
            "country_code_iso3": iso3,
            "region_continental": region,
            "administrative_area": val("administrative_area"),
            "city": val("city"),
            "port_type": val("port_type"),
            "part_of": val("part_of"),
            "latitude": lat,
            "longitude": lon,
            "unlocode": val("unlocode"),
            "primary_activity": val("primary_activity"),
            "secondary_activities": val("secondary_activities"),
            "cargo_types": val("cargo_types"),
            "commercial_status": val("commercial_status"),
            "operating_status": val("operating_status"),
            "port_authority": val("port_authority"),
            "ownership": val("ownership"),
            "year_established": val("year_established"),
            "port_area": val("port_area"),
            "water_area": val("water_area"),
            "number_of_berths": val("number_of_berths"),
            "number_of_terminals": val("number_of_terminals"),
            "berth_length_total": val("berth_length_total"),
            "max_vessel_length": val("max_vessel_length"),
            "turning_basin": val("turning_basin"),
            "terminals": val("terminals"),
            "cranes_equipment": val("cranes_equipment"),
            "storage_facilities": val("storage_facilities"),
            "max_draft_m": val("max_draft_m"),
            "channel_depth_m": val("channel_depth_m"),
            "berth_depth_m": val("berth_depth_m"),
            "tidal_restrictions": val("tidal_restrictions"),
            "pilotage": val("pilotage"),
            "tug_availability": val("tug_availability"),
            "access_restrictions": val("access_restrictions"),
            "annual_throughput_teu": val("annual_throughput_teu"),
            "annual_throughput_tonnage": val("annual_throughput_tonnage"),
            "storage_capacity": val("storage_capacity"),
            "berth_capacity_notes": val("berth_capacity_notes"),
            "annual_throughput_notes": val("annual_throughput_notes"),
            "road_connection": val("road_connection"),
            "rail_connection": val("rail_connection"),
            "inland_waterway_connection": val("inland_waterway_connection"),
            "nearby_airport": val("nearby_airport"),
            "hours_of_operation": val("hours_of_operation"),
            "seasonal_limitations": val("seasonal_limitations"),
            "major_restrictions": val("major_restrictions"),
            "website": val("website"),
            "general_notes": val("general_notes"),
            "vessel_capability": val("vessel_capability"),
            "vessel_traffic_notes": val("vessel_traffic_notes"),
            "adjacent_facilities": val("adjacent_facilities"),
            "under_construction_notes": val("under_construction_notes"),
            "research_status": "VERIFIED",
            "confidence_core": conf("operating_status") or conf("port_type"),
            "source_ids": sorted(all_source_ids, key=lambda x: (x.split("-")[0], int(x.split("-")[1]))),
            "record_path": record_path(path),
            "last_verified": last_verified,
            "research_notes": research_status_footer,
        }
    )
    return rec


DISCOVERY_ROW_RE = re.compile(r"^\|(.+)\|\s*$")


def load_discovery_register(path, country_slug, existing_names):
    """Parse a discovered/<country>.md register and return sparse records for
    non-VERIFIED rows only (VERIFIED rows already have full port files)."""
    text = path.read_text(encoding="utf-8")
    out = []
    country_disp, iso2, iso3, region = COUNTRY_META.get(country_slug, (country_slug, None, None, None))
    for line in text.splitlines():
        m = DISCOVERY_ROW_RE.match(line)
        if not m:
            continue
        cells = split_pipe_row(line)
        if len(cells) != 5:
            continue
        if cells[0].lower() in ("entity", "candidate"):
            continue
        if is_separator_row(cells):
            continue
        entity, ptype, disc_source, status, notes = cells
        status_norm = status.strip().upper()
        if status_norm not in ("DISCOVERED", "RESEARCHED", "UNRESOLVED"):
            continue  # VERIFIED already captured from ports/, OUT_OF_SCOPE excluded from dataset
        name_clean = re.sub(r"\s*\(candidate\)\s*", "", entity).strip()
        port_id = f"{iso2 or country_slug.upper()}-{slugify(name_clean)}-{status_norm.lower()}"
        out.append(
            {
                "port_id": port_id,
                "official_name": name_clean,
                "alternate_names": None,
                "country": country_disp,
                "country_code": iso2,
                "country_code_iso3": iso3,
                "region_continental": region,
                "administrative_area": None,
                "city": None,
                "port_type": ptype.strip() or None,
                "part_of": None,
                "latitude": None,
                "longitude": None,
                "unlocode": None,
                "primary_activity": None,
                "secondary_activities": None,
                "cargo_types": None,
                "commercial_status": None,
                "operating_status": None,
                "port_authority": None,
                "ownership": None,
                "year_established": None,
                "port_area": None,
                "water_area": None,
                "number_of_berths": None,
                "number_of_terminals": None,
                "berth_length_total": None,
                "max_vessel_length": None,
                "turning_basin": None,
                "terminals": None,
                "cranes_equipment": None,
                "storage_facilities": None,
                "max_draft_m": None,
                "channel_depth_m": None,
                "berth_depth_m": None,
                "tidal_restrictions": None,
                "pilotage": None,
                "tug_availability": None,
                "access_restrictions": None,
                "annual_throughput_teu": None,
                "annual_throughput_tonnage": None,
                "storage_capacity": None,
                "berth_capacity_notes": None,
                "annual_throughput_notes": None,
                "road_connection": None,
                "rail_connection": None,
                "inland_waterway_connection": None,
                "nearby_airport": None,
                "hours_of_operation": None,
                "seasonal_limitations": None,
                "major_restrictions": None,
                "website": None,
                "general_notes": notes.strip() or None,
                "vessel_capability": None,
                "vessel_traffic_notes": None,
                "adjacent_facilities": None,
                "under_construction_notes": None,
                "research_status": status_norm,
                "confidence_core": None,
                "source_ids": extract_sources(disc_source),
                "record_path": record_path(path),
                "last_verified": None,
                "research_notes": notes.strip() or None,
                "fields_detail": {},
            }
        )
    return out


def load_sources():
    """Parse sources/*.md into a flat list of source records."""
    out = []
    for path in sorted(SOURCES_DIR.glob("*.md")):
        country_slug = path.stem
        text = path.read_text(encoding="utf-8")
        for line in text.splitlines():
            m = TABLE_ROW_RE.match(line)
            if not m:
                continue
            cells = split_pipe_row(line)
            if len(cells) != 7:
                continue
            if cells[0].strip().upper() == "ID":
                continue
            if is_separator_row(cells):
                continue
            sid, title, url, stype, tier, accessed, establishes = cells
            if not re.fullmatch(r"[A-Z]{2,3}-\d{2,3}", sid.strip()):
                continue
            out.append(
                {
                    "source_id": sid.strip(),
                    "country_file": country_slug,
                    "source_name": title.strip(),
                    "source_url": url.strip(),
                    "source_type": stype.strip(),
                    "tier": tier.strip(),
                    "accessed_date": accessed.strip(),
                    "what_it_establishes": establishes.strip(),
                }
            )
    return out


def main():
    DATA_DIR.mkdir(exist_ok=True)
    REPORTS_DIR.mkdir(exist_ok=True)

    records = []
    field_inventory = Counter()
    unmapped_fields = Counter()

    for country_dir in sorted(PORTS_DIR.iterdir()):
        if not country_dir.is_dir():
            continue
        slug = country_dir.name
        if slug not in COUNTRY_META:
            print(f"WARNING: no country metadata for folder '{slug}'", file=sys.stderr)
        for md_file in sorted(country_dir.glob("*.md")):
            rec = load_port_record(md_file, slug)
            records.append(rec)
            for k in rec["fields_detail"]:
                field_inventory[k] += 1
                if k.startswith("raw__"):
                    unmapped_fields[k] += 1

    verified_names_by_country = defaultdict(set)
    for r in records:
        verified_names_by_country[r["country"]].add(r["official_name"])

    discovery_records = []
    for disc_file in sorted(DISCOVERED_DIR.glob("*.md")):
        slug = disc_file.stem
        discovery_records.extend(load_discovery_register(disc_file, slug, verified_names_by_country))

    all_records = records + discovery_records

    sources = load_sources()

    # ---- write field inventory report ----
    (REPORTS_DIR / "field_inventory.json").write_text(
        json.dumps(
            {
                "mapped_field_counts": {k: v for k, v in field_inventory.items() if not k.startswith("raw__")},
                "unmapped_raw_field_counts": dict(unmapped_fields),
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    return all_records, sources, records, discovery_records


ALLOWED_OPERATING_STATUS = {
    "ACTIVE", "ACTIVE_LIMITED", "SEASONAL", "INACTIVE", "HISTORICAL",
    "UNDER_CONSTRUCTION", "PROPOSED", "ABANDONED", "UNKNOWN",
}


def derive_primary_token(value):
    if not value:
        return None
    # strip parenthetical qualifiers first so an internal comma/slash inside
    # "(dry port, container)" doesn't get mistaken for a top-level separator
    stripped = re.sub(r"\s*\(.*?\)\s*", " ", value.strip()).strip()
    first = re.split(r"\s*/\s*|\s*,\s*", stripped)[0].strip()
    return first or None


def normalize_operating_status_primary(value):
    tok = derive_primary_token(value)
    if not tok:
        return None
    tok_up = tok.strip().upper().replace(" ", "_")
    if tok_up in ALLOWED_OPERATING_STATUS:
        return tok_up
    # handle values like "ACTIVE_LIMITED (Kenya)" already split; try direct match ignoring case
    for allowed in ALLOWED_OPERATING_STATUS:
        if allowed in value.upper():
            return allowed
    return tok_up


def to_flat_row(rec):
    row = {}
    for f in CANONICAL_ORDER:
        v = rec.get(f)
        if f in LIST_FIELDS and isinstance(v, list):
            row[f] = "; ".join(v) if v else None
        else:
            row[f] = v
    row["port_type_primary"] = derive_primary_token(rec.get("port_type"))
    row["operating_status_primary"] = normalize_operating_status_primary(rec.get("operating_status"))
    return row


def to_nested(rec):
    d = dict(rec)
    return d


def write_csv(rows, path):
    fieldnames = CANONICAL_ORDER + ["port_type_primary", "operating_status_primary"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def write_json(records, path):
    path.write_text(
        json.dumps(
            {
                "dataset": "ShipPortX",
                "version": DATASET_VERSION,
                "schema_version": SCHEMA_VERSION,
                "generated": GENERATION_DATE,
                "research_cutoff_date": RESEARCH_CUTOFF_DATE,
                "record_count": len(records),
                "records": records,
            },
            indent=2,
            ensure_ascii=False,
            default=str,
        ),
        encoding="utf-8",
    )


def write_jsonl(records, path):
    with open(path, "w", encoding="utf-8") as f:
        for r in records:
            f.write(json.dumps(r, ensure_ascii=False, default=str))
            f.write("\n")


def write_parquet(flat_rows, path):
    try:
        import pandas as pd
    except ImportError:
        print("pandas not available, skipping Parquet output", file=sys.stderr)
        return False
    df = pd.DataFrame(flat_rows, columns=CANONICAL_ORDER + ["port_type_primary", "operating_status_primary"])
    numeric_cols = ["latitude", "longitude"]
    for c in numeric_cols:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    df.to_parquet(path, index=False)
    return True


def write_sources_csv(sources, path):
    fieldnames = [
        "source_id", "country_file", "source_name", "source_url",
        "source_type", "tier", "accessed_date", "what_it_establishes",
    ]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for s in sources:
            w.writerow(s)


UNLOCODE_RE = re.compile(r"^[A-Z]{2}[A-Z0-9]{3}$")


def validate(all_records, sources):
    issues = defaultdict(list)

    seen_ids = {}
    seen_name_country = defaultdict(list)
    for r in all_records:
        pid = r["port_id"]
        if pid in seen_ids:
            issues["duplicate_port_id"].append(pid)
        seen_ids[pid] = r

        key = (r["official_name"] or "").strip().lower(), (r["country"] or "").strip().lower()
        seen_name_country[key].append(pid)

        if not r.get("official_name"):
            issues["missing_official_name"].append(pid)
        if not r.get("country"):
            issues["missing_country"].append(pid)
        if r["research_status"] == "VERIFIED":
            if not r.get("port_type"):
                issues["verified_missing_port_type"].append(pid)
            if not r.get("operating_status"):
                issues["verified_missing_operating_status"].append(pid)

        if r.get("country_code") and (len(r["country_code"]) != 2 or not r["country_code"].isalpha()):
            issues["invalid_country_code"].append(pid)

        lat, lon = r.get("latitude"), r.get("longitude")
        if lat is not None:
            if not (-90 <= lat <= 90):
                issues["invalid_latitude"].append(pid)
            if lat == 0 and lon == 0:
                issues["null_island_coordinates"].append(pid)
        if lon is not None and not (-180 <= lon <= 180):
            issues["invalid_longitude"].append(pid)
        raw_latlon = (r.get("fields_detail") or {}).get("lat_lon_raw", {}).get("value")
        if latlon_sign_conflict(raw_latlon):
            issues["coordinate_sign_conflict"].append((pid, raw_latlon))

        unl = r.get("unlocode")
        if unl:
            unl_clean = unl.strip().upper()
            if unl_clean in ("UNKNOWN", "N/A", "NONE", "NOT ASSIGNED", "NOT CONFIRMED"):
                issues["unlocode_explicitly_unknown"].append(pid)
            elif not UNLOCODE_RE.match(unl_clean):
                # Free-text values (e.g. a documented CONFLICTING narrative) rather than a
                # malformed code attempt, surfaced separately so genuine format errors
                # aren't mixed in with intentionally-preserved research conflicts.
                issues["unlocode_narrative_or_conflicting"].append((pid, unl))
            elif r.get("country_code") and not unl_clean.startswith(r["country_code"]):
                issues["unlocode_country_mismatch"].append((pid, unl, r["country_code"]))

        if r["research_status"] == "VERIFIED" and not r.get("source_ids"):
            issues["verified_without_sources"].append(pid)

    for key, ids in seen_name_country.items():
        if len(ids) > 1:
            issues["possible_duplicate_name_country"].append({"name_country": key, "port_ids": ids})

    # source registry checks
    src_ids = Counter(s["source_id"] for s in sources)
    dupes = [sid for sid, c in src_ids.items() if c > 1]
    if dupes:
        issues["duplicate_source_id"].extend(dupes)

    referenced = set()
    for r in all_records:
        referenced.update(r.get("source_ids") or [])
    known_source_ids = set(src_ids)
    missing_from_registry = sorted(referenced - known_source_ids)
    if missing_from_registry:
        issues["source_id_referenced_but_not_in_registry"] = missing_from_registry

    return issues


def build_summary(all_records, sources, issues):
    verified = [r for r in all_records if r["research_status"] == "VERIFIED"]
    by_country = Counter(r["country"] for r in all_records)
    by_port_type = Counter(derive_primary_token(r.get("port_type")) for r in all_records if r.get("port_type"))
    by_op_status = Counter(normalize_operating_status_primary(r.get("operating_status")) for r in verified if r.get("operating_status"))
    by_primary_activity = Counter(r.get("primary_activity") for r in verified if r.get("primary_activity"))
    with_coords = sum(1 for r in all_records if r.get("latitude") is not None and r.get("longitude") is not None)
    with_unlocode = sum(1 for r in all_records if r.get("unlocode"))
    missing_key_fields = sum(
        1 for r in verified if not (r.get("port_type") and r.get("operating_status") and r.get("country"))
    )
    research_status_counts = Counter(r["research_status"] for r in all_records)

    summary = {
        "dataset_version": DATASET_VERSION,
        "generated": GENERATION_DATE,
        "research_cutoff_date": RESEARCH_CUTOFF_DATE,
        "total_records": len(all_records),
        "verified_records": len(verified),
        "non_verified_records": len(all_records) - len(verified),
        "research_status_breakdown": dict(research_status_counts),
        "countries_represented": len(by_country),
        "records_by_country": dict(sorted(by_country.items(), key=lambda x: -x[1])),
        "records_by_port_type_primary": dict(sorted(by_port_type.items(), key=lambda x: -x[1])),
        "verified_records_by_operating_status": dict(sorted(by_op_status.items(), key=lambda x: -x[1])),
        "top_20_primary_activities": dict(Counter(by_primary_activity).most_common(20)),
        "records_with_coordinates": with_coords,
        "records_with_unlocode": with_unlocode,
        "verified_records_missing_key_fields": missing_key_fields,
        "total_sources": len(sources),
        "unique_source_ids": len(set(s["source_id"] for s in sources)),
        "validation_issue_counts": {k: len(v) for k, v in issues.items()},
    }
    return summary


if __name__ == "__main__":
    all_records, sources, verified_records, discovery_records = main()
    print(f"Parsed {len(verified_records)} VERIFIED port records from {PORTS_DIR}")
    print(f"Parsed {len(discovery_records)} DISCOVERED/RESEARCHED/UNRESOLVED register entries")
    print(f"Parsed {len(sources)} source registry entries")
    print(f"Total combined dataset records: {len(all_records)}")

    nested_records = [to_nested(r) for r in all_records]
    flat_rows = [to_flat_row(r) for r in all_records]

    write_csv(flat_rows, DATA_DIR / "shipportx.csv")
    write_json(nested_records, DATA_DIR / "shipportx.json")
    write_jsonl(nested_records, DATA_DIR / "shipportx.jsonl")
    parquet_ok = write_parquet(flat_rows, DATA_DIR / "shipportx.parquet")
    write_sources_csv(sources, DATA_DIR / "sources.csv")

    issues = validate(all_records, sources)
    (REPORTS_DIR / "validation_report.json").write_text(
        json.dumps(issues, indent=2, ensure_ascii=False, default=str), encoding="utf-8"
    )

    summary = build_summary(all_records, sources, issues)
    (REPORTS_DIR / "dataset_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # round-trip check
    reloaded_json = json.loads((DATA_DIR / "shipportx.json").read_text(encoding="utf-8"))
    reloaded_jsonl_count = sum(1 for _ in open(DATA_DIR / "shipportx.jsonl", encoding="utf-8"))
    csv_count = sum(1 for _ in open(DATA_DIR / "shipportx.csv", encoding="utf-8")) - 1

    print("\n=== OUTPUT FILES ===")
    print(f"CSV rows: {csv_count}")
    print(f"JSON records: {reloaded_json['record_count']} (file says {len(reloaded_json['records'])})")
    print(f"JSONL lines: {reloaded_jsonl_count}")
    print(f"Parquet written: {parquet_ok}")
    print(f"Sources CSV rows: {len(sources)}")
    print("\n=== VALIDATION ISSUE COUNTS ===")
    for k, v in issues.items():
        print(f"  {k}: {len(v)}")
    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2, ensure_ascii=False)[:2000])
