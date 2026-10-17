"""Load ShipPortX with pandas.  pip install -r requirements.txt; python examples/python/load_pandas.py"""

from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parents[2] / "data"

# Parquet keeps types (latitude/longitude are float64); CSV is the same table.
df = pd.read_parquet(DATA / "shipportx.parquet")
print(f"{len(df)} records, {df['country'].nunique()} countries")

print("\nRecords by research status:")
print(df["research_status"].value_counts().to_string())

verified = df[df["research_status"] == "VERIFIED"]
mappable = df.dropna(subset=["latitude", "longitude"])
print(f"\nVERIFIED: {len(verified)}, with coordinates: {len(mappable)}")

print("\nTop port types (primary):")
print(df["port_type_primary"].value_counts().head(8).to_string())

# CSV: read as text so columns that are empty everywhere are not inferred as float.
csv = pd.read_csv(DATA / "shipportx.csv", dtype=str, keep_default_na=False, na_values=[""])
assert len(csv) == len(df)

# Resolve the source IDs of one record
sources = pd.read_csv(DATA / "sources.csv", dtype=str).set_index("source_id")
row = df.set_index("port_id").loc["KE-mombasa"]
for source_id in (row["source_ids"] or "").split("; "):
    if source_id:
        print(f"{source_id}: {sources.loc[source_id, 'source_name']}")
