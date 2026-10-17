# Publishing this folder to the Hugging Face Hub

This folder is a complete dataset repository. Nothing has been uploaded yet.

## Before uploading

1. The license is already set (`cc-by-4.0`).
2. Replace every `<HF_NAMESPACE>` in `README.md` with your user or organisation name.
3. Read the dataset card once end to end.

## Option A: Hugging Face CLI (recommended)

```bash
pip install -U "huggingface_hub[cli]"
hf auth login                                   # paste a token with write access
hf repo create <HF_NAMESPACE>/shipportx --repo-type dataset
# run from the release root (the folder that contains huggingface-dataset/)
hf upload <HF_NAMESPACE>/shipportx huggingface-dataset . --repo-type dataset \
  --commit-message "ShipPortX v1.0.0"
```

(Older CLI versions use `huggingface-cli login` / `huggingface-cli upload` with the same arguments.)

Optionally tag the release so users can pin it:

```bash
python -c "from huggingface_hub import create_tag; create_tag('<HF_NAMESPACE>/shipportx', tag='v1.0.0', repo_type='dataset')"
```

## Option B: web upload

1. https://huggingface.co/new-dataset → owner, name `shipportx`, visibility **Public**.
2. *Files and versions* → *Add file* → *Upload files*: upload `README.md`, `CHANGELOG.md`,
   `.gitattributes` and the `data/` folder (keep the `data/` path).

## Repository settings

- Visibility: Public. Gated access: off (open dataset).
- The dataset viewer uses the `configs` in the card: `default` (Parquet), `full` (JSONL), `sources`.

## Verify after publishing

```python
from datasets import load_dataset
ds = load_dataset("<HF_NAMESPACE>/shipportx", split="train")
assert ds.num_rows == 283
full = load_dataset("<HF_NAMESPACE>/shipportx", "full", split="train")
assert "fields_detail" in full.column_names
assert load_dataset("<HF_NAMESPACE>/shipportx", "sources", split="train").num_rows == 193
```

Also check in the browser that the dataset viewer renders all three configs, and that
`data/SHA256SUMS` matches your local files (`sha256sum -c SHA256SUMS` inside `data/`).
