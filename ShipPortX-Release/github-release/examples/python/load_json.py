"""Read the JSON file, including field-level provenance.  python examples/python/load_json.py"""

import json
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[2] / "data"

with open(DATA / "shipportx.json", encoding="utf-8") as f:
    payload = json.load(f)

print(payload["dataset"], payload["version"], "generated", payload["generated"], "-", payload["record_count"], "records")
records = payload["records"]

# Confidence levels across every researched field
levels = Counter(detail["confidence"] for r in records for detail in r["fields_detail"].values())
print("Field-level confidence:", dict(levels.most_common()))

# Fields of one record with their confidence and source
port = next(r for r in records if r["port_id"] == "GH-tema")
for field, detail in port["fields_detail"].items():
    print(f"{field:<28} {detail['confidence']:<11} {detail['source']}")

# Streaming alternative: one record per line
with open(DATA / "shipportx.jsonl", encoding="utf-8") as f:
    first = json.loads(next(f))
print("First JSONL record:", first["port_id"])
