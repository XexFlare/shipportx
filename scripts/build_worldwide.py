"""Build the worldwide port index: ShipPortX (Africa) merged with the NGA World Port Index.

Merge rule (TOOLS_FIX_PLAN.md 4.2):
- ShipPortX research wins for Africa. A WPI port that matches a ShipPortX record is dropped
  (its number is kept on the ShipPortX record as a cross-reference); WPI values never overwrite
  ShipPortX values.
- WPI fills the rest of the world, plus African ports ShipPortX does not have.
- Matching: same UN/LOCODE first; then a ShipPortX record in the same country within
  MATCH_RADIUS_KM with a similar name; then the nearest one within SAME_PLACE_KM whatever its name.
- Every record carries `source` ("shipportx" or "wpi") and `scope` ("africa" or "world").

The published ShipPortX dataset (Data/) stays Africa-only; this index is an API feature.

Inputs:  Data/shipportx.json (+ derived *_primary fields from Data/shipportx.csv), newest External/wpi/world-port-index-*.json
Outputs: Worldwide/ports-worldwide.json, reports/worldwide_merge_report.json,
         reports/wpi_research_leads.json

Usage: python scripts/build_worldwide.py
"""
import csv
import difflib
import json
import math
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHIPPORTX_JSON = ROOT / "Data" / "shipportx.json"
SHIPPORTX_CSV = ROOT / "Data" / "shipportx.csv"
WPI_DIR = ROOT / "External" / "wpi"
OUT_DIR = ROOT / "Worldwide"
REPORTS_DIR = ROOT / "reports"

MATCH_RADIUS_KM = 10.0
SAME_PLACE_KM = 3.0
OCEAN_GOING_MIN_DEPTH_M = 7.0
CREDIT = "Port data: ShipPortX (Africa), NGA World Port Index (worldwide)"

AFRICA = set(
    "DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML "
    "MR MU YT MA MZ NA NE NG RE RW SH ST SN SC SL SO ZA SS SD TZ TG TN UG EH ZM ZW".split()
)

# Cargo tags shared by both sources (API `cargo` filter).
CARGO_TAGS = ["container", "dry_bulk", "liquid_bulk", "break_bulk", "roro", "oil", "gas", "passenger", "fishing"]
WPI_CARGO_FLAGS = {
    "loContainer": "container",
    "loSolidBulk": "dry_bulk",
    "loLiquidBulk": "liquid_bulk",
    "loBreakBulk": "break_bulk",
    "loRoro": "roro",
    "loOilTerm": "oil",
}
SHIPPORTX_CARGO_KEYWORDS = {
    "container": r"container|teu",
    "dry_bulk": r"dry bulk|bulk \(|grain|bauxite|iron ore|\bore\b|coal|manganese|clinker|cement|fertili[sz]er|phosphate|alumina",
    "liquid_bulk": r"liquid bulk|bulk liquid|tanker|petroleum products|chemicals",
    "break_bulk": r"break ?bulk|general cargo|general/|multipurpose|multi-purpose|bagged",
    "roro": r"ro-?ro|vehicle",
    "oil": r"\boil\b|crude|petroleum|fpso",
    "gas": r"\blng\b|\blpg\b|\bgas\b",
    "passenger": r"passenger|ferry|cruise",
    "fishing": r"fish",
}
SHIPPORTX_PORT_TYPE_CARGO = {
    "oil_terminal": ["oil"],
    "gas_terminal": ["gas"],
    "fishing_harbour": ["fishing"],
    "ferry_terminal": ["passenger"],
    "passenger_port": ["passenger"],
}
# Port types that are never reached by ocean-going ships; river ports depend on depth (Matadi is).
SHIPPORTX_NOT_OCEAN = {"lake_port", "fishing_harbour", "ferry_terminal", "passenger_port"}
SHIPPORTX_OCEAN = {
    "major_commercial", "secondary_commercial", "oil_terminal", "gas_terminal",
    "mining_export_terminal", "industrial_port", "seaport", "terminal",
}
WPI_HARBOR_TYPE = {
    "CN": "coastal_natural", "CB": "coastal_breakwater", "CT": "coastal_tide_gate",
    "RN": "river_natural", "RB": "river_basin", "RT": "river_tide_gate",
    "LC": "lake_or_canal", "OR": "open_roadstead", "TH": "typhoon_harbor",
}
WPI_HARBOR_SIZE = {"V": "very_small", "S": "small", "M": "medium", "L": "large"}


def km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def clean_locode(value):
    if not value:
        return None
    code = re.sub(r"\s+", "", str(value)).upper()
    return code if re.fullmatch(r"[A-Z]{2}[A-Z2-9]{3}", code) else None


def number(value):
    """First number in a value such as '26.8 m', '18 metres' or '9'; None when absent."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    m = re.search(r"\d+(?:\.\d+)?", str(value))
    return float(m.group(0)) if m else None


def latest_wpi_snapshot():
    snapshots = sorted(WPI_DIR.glob("world-port-index-*.json"))
    if not snapshots:
        raise SystemExit(f"No WPI snapshot in {WPI_DIR}. Run: python scripts/import_wpi.py")
    return snapshots[-1]


def shipportx_cargo(rec):
    text = " ".join(
        str(rec.get(k) or "") for k in ("cargo_types", "primary_activity", "secondary_activities", "terminals")
    ).lower()
    tags = {tag for tag, pattern in SHIPPORTX_CARGO_KEYWORDS.items() if re.search(pattern, text)}
    tags.update(SHIPPORTX_PORT_TYPE_CARGO.get(rec.get("port_type_primary"), []))
    return [t for t in CARGO_TAGS if t in tags]


def shipportx_ocean_going(port_type, draft):
    if port_type in SHIPPORTX_NOT_OCEAN:
        return False
    if draft is not None:
        return draft >= OCEAN_GOING_MIN_DEPTH_M
    if port_type in SHIPPORTX_OCEAN:
        return True
    return None


def wpi_depth(port):
    depths = [number(port.get(k)) for k in ("maxVesselDraft", "chDepth", "cpDepth", "otDepth")]
    depths = [d for d in depths if d is not None and d > 0]
    return max(depths) if depths else None


def wpi_ocean_going(port):
    if port.get("harborType") == "LC":
        return False
    depth = wpi_depth(port)
    if depth is not None:
        return depth >= OCEAN_GOING_MIN_DEPTH_M
    size = port.get("harborSize")
    if size in ("M", "L"):
        return True
    if size in ("V", "S"):
        return False
    return None


def from_shipportx(rec):
    draft = number(rec.get("max_draft_m"))
    port_type = rec.get("port_type_primary")
    return {
        "id": rec["port_id"],
        "name": rec.get("official_name"),
        "alternate_names": rec.get("alternate_names"),
        "country": rec.get("country"),
        "country_code": rec.get("country_code"),
        "latitude": rec.get("latitude"),
        "longitude": rec.get("longitude"),
        "unlocode": clean_locode(rec.get("unlocode")),
        "source": "shipportx",
        "scope": "africa",
        "port_type": port_type,
        "harbor_size": None,
        "max_draft_m": draft,
        "channel_depth_m": number(rec.get("channel_depth_m")),
        "cargo": shipportx_cargo(rec),
        "ocean_going": shipportx_ocean_going(port_type, draft),
        "operating_status": rec.get("operating_status_primary"),
        "research_status": rec.get("research_status"),
        "wpi_port_numbers": [],
    }


def from_wpi(port):
    cc = port.get("countryCode")
    cargo = {tag for flag, tag in WPI_CARGO_FLAGS.items() if port.get(flag) == "Y"}
    if port.get("lngTerminalDepth"):
        cargo.add("gas")
    return {
        "id": f"WPI-{port['portNumber']}",
        "name": port.get("portName"),
        "alternate_names": port.get("alternateName"),
        "country": port.get("countryName"),
        "country_code": cc,
        "latitude": round(port["ycoord"], 6) if port.get("ycoord") is not None else None,
        "longitude": round(port["xcoord"], 6) if port.get("xcoord") is not None else None,
        "unlocode": clean_locode(port.get("unloCode")),
        "source": "wpi",
        "scope": "africa" if cc in AFRICA else "world",
        "port_type": WPI_HARBOR_TYPE.get(port.get("harborType")),
        "harbor_size": WPI_HARBOR_SIZE.get(port.get("harborSize")),
        "max_draft_m": number(port.get("maxVesselDraft")),
        "channel_depth_m": number(port.get("chDepth")),
        "cargo": [t for t in CARGO_TAGS if t in cargo],
        "ocean_going": wpi_ocean_going(port),
        "operating_status": None,
        "research_status": None,
        "wpi_port_numbers": [port["portNumber"]],
    }


def find_match(port, shipportx_by_locode, shipportx_by_country):
    """Return (ShipPortX record, method) for a WPI port, or (None, None)."""
    code = clean_locode(port.get("unloCode"))
    if code and code in shipportx_by_locode:
        return shipportx_by_locode[code], "unlocode"
    if port.get("ycoord") is None:
        return None, None
    nearby = sorted(
        (km(port["ycoord"], port["xcoord"], rec["latitude"], rec["longitude"]), rec)
        for rec in shipportx_by_country.get(port.get("countryCode"), [])
    )
    nearby = [(d, rec) for d, rec in nearby if d <= MATCH_RADIUS_KM]
    wpi_names = name_tokens(port.get("portName"), *(port.get("alternateName") or "").split(";"))
    for d, rec in nearby:
        if names_similar(wpi_names, shipportx_name_tokens(rec)):
            return rec, "proximity_and_name"
    # Different names only count as the same place when very close; a separate terminal
    # a few km away (e.g. an oil terminal beside a city port) stays its own record.
    if nearby and nearby[0][0] <= SAME_PLACE_KM:
        return nearby[0][1], "proximity"
    return None, None


GENERIC_NAME_WORDS = {
    "port", "of", "the", "de", "du", "la", "le", "el", "al", "harbour", "harbor", "terminal", "oil",
    "autonomous", "autonome", "international", "complex", "deepwater", "deep", "water", "new", "bay",
}


def name_tokens(*names):
    tokens = set()
    for name in names:
        text = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode().lower()
        tokens.update(t for t in re.split(r"[^a-z]+", text) if len(t) >= 4 and t not in GENERIC_NAME_WORDS)
    return tokens


def shipportx_name_tokens(rec):
    slug = rec["port_id"].split("-", 1)[-1].replace("-", " ")
    return name_tokens(rec.get("official_name"), rec.get("alternate_names"), rec.get("city"), slug)


def names_similar(a, b):
    return any(x == y or difflib.SequenceMatcher(None, x, y).ratio() >= 0.8 for x in a for y in b)


def merge(shipportx_records, wpi_ports):
    merged = {r["port_id"]: from_shipportx(r) for r in shipportx_records}
    by_locode, by_country = {}, {}
    for r in shipportx_records:
        code = clean_locode(r.get("unlocode"))
        if code:
            by_locode.setdefault(code, r)
        if r.get("latitude") is not None and r.get("longitude") is not None:
            by_country.setdefault(r.get("country_code"), []).append(r)

    matches, leads, wpi_records = [], [], []
    for port in wpi_ports:
        rec, method = (None, None)
        if port.get("countryCode") in AFRICA:
            rec, method = find_match(port, by_locode, by_country)
        if rec is None:
            wpi_records.append(from_wpi(port))
            continue
        target = merged[rec["port_id"]]
        target["wpi_port_numbers"].append(port["portNumber"])
        distance = None
        if rec.get("latitude") is not None and port.get("ycoord") is not None:
            distance = round(km(rec["latitude"], rec["longitude"], port["ycoord"], port["xcoord"]), 1)
        matches.append({"shipportx_id": rec["port_id"], "wpi_port_number": port["portNumber"],
                        "wpi_name": port.get("portName"), "method": method, "distance_km": distance})
        lead = research_lead(rec, port)
        if lead:
            leads.append(lead)

    records = sorted(merged.values(), key=lambda r: r["id"]) + sorted(wpi_records, key=lambda r: r["id"])
    return records, matches, leads


def research_lead(rec, port):
    """Fields ShipPortX lacks that WPI has: leads for the normal research process, never copied in."""
    gaps = {}
    if rec.get("latitude") is None and port.get("ycoord") is not None:
        gaps["coordinates"] = {"latitude": port.get("latitude"), "longitude": port.get("longitude")}
    if rec.get("max_draft_m") in (None, "") and port.get("maxVesselDraft"):
        gaps["max_draft_m"] = number(port["maxVesselDraft"])
    if rec.get("channel_depth_m") in (None, "") and port.get("chDepth"):
        gaps["channel_depth_m"] = number(port["chDepth"])
    if not clean_locode(rec.get("unlocode")) and clean_locode(port.get("unloCode")):
        gaps["unlocode"] = clean_locode(port["unloCode"])
    if not gaps:
        return None
    return {"shipportx_id": rec["port_id"], "record_path": rec.get("record_path"),
            "wpi_port_number": port["portNumber"], "wpi_name": port.get("portName"), "wpi_values": gaps}


def unmatched_african_leads(wpi_records):
    return [{"wpi_port_number": r["wpi_port_numbers"][0], "name": r["name"], "country_code": r["country_code"],
             "unlocode": r["unlocode"], "latitude": r["latitude"], "longitude": r["longitude"]}
            for r in wpi_records if r["source"] == "wpi" and r["scope"] == "africa"]


def main():
    shipportx = json.loads(SHIPPORTX_JSON.read_text(encoding="utf-8"))
    # The derived *_primary fields are only in the flat CSV.
    with SHIPPORTX_CSV.open(encoding="utf-8", newline="") as f:
        primaries = {row["port_id"]: row for row in csv.DictReader(f)}
    for rec in shipportx["records"]:
        row = primaries.get(rec["port_id"], {})
        rec["port_type_primary"] = row.get("port_type_primary") or None
        rec["operating_status_primary"] = row.get("operating_status_primary") or None
    snapshot_path = latest_wpi_snapshot()
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    records, matches, leads = merge(shipportx["records"], snapshot["ports"])

    metadata = {
        "dataset": "ShipPortX worldwide port index",
        "shipportx_version": shipportx["version"],
        "wpi_snapshot": snapshot_path.name,
        "wpi_retrieved": snapshot["meta"]["retrieved"],
        "record_count": len(records),
        "by_source": dict(Counter(r["source"] for r in records)),
        "by_scope": dict(Counter(r["scope"] for r in records)),
        "credit": CREDIT,
        "licenses": {"shipportx": "CC BY 4.0", "wpi": "Public domain (US government work)"},
        "cargo_tags": CARGO_TAGS,
        "notes": [
            "ShipPortX records win for Africa; WPI values never overwrite them.",
            f"ocean_going is a heuristic: known depth or draft >= {OCEAN_GOING_MIN_DEPTH_M} m, "
            "otherwise port type (ShipPortX) or harbor size medium/large (WPI); null when unknown.",
            "WPI cargo flags are mostly unknown ('U'), so the cargo filter under-reports WPI ports.",
        ],
    }
    OUT_DIR.mkdir(exist_ok=True)
    lines = [json.dumps(r, ensure_ascii=False, sort_keys=True) for r in records]
    (OUT_DIR / "ports-worldwide.json").write_text(
        '{"metadata": ' + json.dumps(metadata, ensure_ascii=False) + ',\n"records": [\n' + ",\n".join(lines) + "\n]}\n",
        encoding="utf-8",
    )

    wpi_only = [r for r in records if r["source"] == "wpi"]
    report = {
        "wpi_snapshot": snapshot_path.name,
        "shipportx_records": len(shipportx["records"]),
        "wpi_ports": len(snapshot["ports"]),
        "wpi_african_ports": sum(1 for p in snapshot["ports"] if p.get("countryCode") in AFRICA),
        "matched": len(matches),
        "matched_by_method": dict(Counter(m["method"] for m in matches)),
        "matches_over_25_km": [m for m in matches if (m["distance_km"] or 0) > 25],
        "wpi_added": len(wpi_only),
        "wpi_added_in_africa": sum(1 for r in wpi_only if r["scope"] == "africa"),
        "total_records": len(records),
        "duplicate_ids": [i for i, c in Counter(r["id"] for r in records).items() if c > 1],
        "matches": matches,
    }
    (REPORTS_DIR / "worldwide_merge_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    (REPORTS_DIR / "wpi_research_leads.json").write_text(json.dumps({
        "purpose": "Research leads only. Verify through the normal research process before editing the ShipPortX-Research repo.",
        "matched_records_with_gaps": leads,
        "african_wpi_ports_not_in_shipportx": unmatched_african_leads(records),
    }, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"Worldwide index: {len(records)} records ({metadata['by_source']}), scope {metadata['by_scope']}")
    print(f"Matched {len(matches)} WPI ports to ShipPortX {report['matched_by_method']}; "
          f"{len(report['matches_over_25_km'])} matches over 25 km; {len(leads)} research leads")
    return records, report


if __name__ == "__main__":
    main()
