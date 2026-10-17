"""Download a dated snapshot of the NGA World Port Index (WPI, Pub. 150).

The WPI is public domain US government data. Builds read the newest snapshot in
External/wpi/, never the live API, so a build is reproducible from the repo alone.

Usage: python scripts/import_wpi.py            (writes External/wpi/world-port-index-<today>.json)
"""
import datetime
import json
import sys
import urllib.request
from pathlib import Path

WPI_URL = "https://msi.nga.mil/api/publications/world-port-index?output=json"
SNAPSHOT_DIR = Path(__file__).resolve().parent.parent / "External" / "wpi"


def fetch_ports(url=WPI_URL):
    with urllib.request.urlopen(url, timeout=180) as resp:
        payload = json.load(resp)
    ports = payload.get("ports")
    if not isinstance(ports, list) or not ports:
        raise SystemExit(f"Unexpected WPI response: no 'ports' list from {url}")
    return ports


def write_snapshot(ports, day):
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    path = SNAPSHOT_DIR / f"world-port-index-{day}.json"
    ports = sorted(ports, key=lambda p: p["portNumber"])
    # One port per line keeps git diffs between snapshots readable.
    lines = [json.dumps(p, ensure_ascii=False, sort_keys=True) for p in ports]
    meta = {"source": WPI_URL, "retrieved": day, "port_count": len(ports), "license": "Public domain (US government work)"}
    path.write_text(
        '{"meta": ' + json.dumps(meta) + ',\n"ports": [\n' + ",\n".join(lines) + "\n]}\n", encoding="utf-8"
    )
    return path


if __name__ == "__main__":
    day = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().isoformat()
    ports = fetch_ports()
    path = write_snapshot(ports, day)
    print(f"Wrote {len(ports)} WPI ports to {path}")
