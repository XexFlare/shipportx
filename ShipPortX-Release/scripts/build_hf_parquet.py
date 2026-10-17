"""Build the two derived Parquet files used by the Hugging Face dataset configs.

The Hugging Face `datasets` library picks ONE file format for all configs of a repository, so
the `full` (nested provenance) and `sources` configs need Parquet twins of shipportx.jsonl and
sources.csv. These are lossless format conversions; the originals are still published unchanged
and scripts/validate.mjs checks the twins against them.

    python scripts/build_hf_parquet.py          (requires: pip install pyarrow)
"""

import json
from pathlib import Path

import pyarrow as pa
import pyarrow.csv as pacsv
import pyarrow.json as pajson
import pyarrow.parquet as pq

RELEASE_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DATA = RELEASE_ROOT.parent / "Data"
OUT = RELEASE_ROOT / "huggingface-dataset" / "data"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Full records with nested fields_detail. Block size covers the whole file so the struct
    # schema is inferred from every record at once.
    jsonl = SOURCE_DATA / "shipportx.jsonl"
    # Explicit types for every top-level field so nothing is re-typed by inference (e.g. the
    # reader would otherwise turn "2026-08-23" strings into dates). Only fields_detail is inferred.
    first = json.loads(jsonl.read_text(encoding="utf-8").splitlines()[0])
    special = {"latitude": pa.float64(), "longitude": pa.float64(), "source_ids": pa.list_(pa.string())}
    schema = pa.schema([(key, special.get(key, pa.string())) for key in first if key != "fields_detail"])
    full = pajson.read_json(
        jsonl,
        read_options=pajson.ReadOptions(block_size=jsonl.stat().st_size + 1),
        parse_options=pajson.ParseOptions(explicit_schema=schema, unexpected_field_behavior="infer"),
    )
    # Keep the original column order.
    full = full.select(list(first.keys()))
    pq.write_table(full, OUT / "shipportx_full.parquet", compression="snappy")
    print(f"shipportx_full.parquet: {full.num_rows} rows, {full.num_columns} columns")

    # Source register: every column kept as text, empty cells stay empty strings as in the CSV.
    header = (SOURCE_DATA / "sources.csv").read_text(encoding="utf-8-sig").splitlines()[0].split(",")
    sources = pacsv.read_csv(
        SOURCE_DATA / "sources.csv",
        convert_options=pacsv.ConvertOptions(
            column_types={name: pa.string() for name in header},
            strings_can_be_null=False,
        ),
    )
    pq.write_table(sources, OUT / "sources.parquet", compression="snappy")
    print(f"sources.parquet: {sources.num_rows} rows, {sources.num_columns} columns")


if __name__ == "__main__":
    main()
