# NLP↔SQL Training App (Oracle-focused)

This project provides an end-to-end pipeline to **generate training data**, **build embeddings**, **auto-generate synonymous questions**, **index and retrieve**, and **run evaluation metrics** for an NLP-to-SQL system targeting **Oracle** schemas.

## What it does
- Connects to an Oracle database, introspects any schema (tables, columns, types, FKs).
- Auto-generates templated **SQL queries** and paired **natural-language questions** from the schema.
- Expands questions with **synonymous paraphrases** using WordNet.
- Encodes questions with pluggable **embeddings backends** (default: `sentence-transformers`).
- **Index backends** (toggle in config):
  - **Oracle** (default): stores vectors in Oracle. Supports **23ai VECTOR** in-database search; transparently falls back to **JSON+CLOB** storage with Python-side search for **12c**.
  - **FAISS**: local ANN index for fast experiments.
- Runs **evals** (Accuracy@1, Recall@K, MRR, nDCG) by checking if the gold SQL is retrieved for each prompt.
- (Optional) Executes SQL against Oracle for result-shape validation.
- Outputs detailed **metrics reports** (CSV/JSON) and a simple **Streamlit dashboard**.

## Quickstart

### 0) Dependencies
- Python 3.10+ recommended.
- Oracle Client (Instant Client) if using `oracledb` Thick mode; Thin mode can work without it.
- Create a virtualenv and install requirements:
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m nltk.downloader wordnet omw-1.4
```

### 1) Configure
Copy and edit the sample config:
```bash
cp config.example.yaml config.yaml
```
- Set `index.backend` to `oracle` (default) or `faiss`.
- For `oracle` backend, `index.table_name` is where vectors go. If on **23ai**, the app attempts native `VECTOR` type. On **12c**, it uses JSON-in-CLOB + Python cosine search automatically.

### 2) Extract schema & generate dataset
```bash
python -m nlp2sql_trainer.cli extract-schema --config config.yaml --out data/schema.json
python -m nlp2sql_trainer.cli gen-dataset --config config.yaml --schema data/schema.json --out data/dataset.jsonl
```

### 3) Build embeddings + index
```bash
python -m nlp2sql_trainer.cli embed --config config.yaml --dataset data/dataset.jsonl --out data/embeddings.parquet

# Choose backend in config:
# Oracle backend: inserts vectors into Oracle table
python -m nlp2sql_trainer.cli build-index --config config.yaml --embeddings data/embeddings.parquet

# FAISS backend: saves a local index file
python -m nlp2sql_trainer.cli build-index --config config.yaml --embeddings data/embeddings.parquet --out data/faiss.index
```

### 4) Run evals
```bash
# Oracle backend (config index.backend=oracle)
python -m nlp2sql_trainer.cli eval --config config.yaml --dataset data/dataset.jsonl --embeddings data/embeddings.parquet --report reports/metrics.json

# FAISS backend (config index.backend=faiss)
python -m nlp2sql_trainer.cli eval --config config.yaml --dataset data/dataset.jsonl --embeddings data/embeddings.parquet --index data/faiss.index --report reports/metrics.json
```

### 5) (Optional) Validate SQL on Oracle
```bash
python -m nlp2sql_trainer.cli validate --config config.yaml --dataset data/dataset.jsonl --out reports/validation.csv
```

### 6) Dashboard
```bash
streamlit run app/dashboard.py
```

## Notes & 23ai specifics
- If your Python `oracledb` driver exposes `DB_TYPE_VECTOR`, the app creates a `VECTOR(dim, FLOAT)` column and uses `ORDER BY embedding <-> :vec` (cosine). If the bind or query fails, it **automatically falls back** to JSON storage + Python-side cosine search.
- On 12c, there is **no native vector type**; vectors are stored as JSON CLOBs and similarity is computed in Python. You still use Oracle for storage and auditing.
- You can switch backends by editing `config.yaml` (`index.backend`).

## Project structure
- `nlp2sql_trainer/` — library code
  - `connectors/oracle_schema.py`
  - `data/gen_questions.py`
  - `embeddings/embedder.py`
  - `index/faiss_store.py`
  - `index/oracle_store.py`  ← **new**
  - `evals/metrics.py`
  - `evals/runner.py`
  - `validation/oracle_runner.py`
  - `utils/io.py`
  - `cli.py`
- `app/dashboard.py`
- `config.example.yaml`
- `requirements.txt`
- `tests/`

## Troubleshooting
- If you hit errors inserting into `VECTOR` columns, set `index.prefer_native_vector: false` to force JSON mode.
- For large datasets on 12c, consider paging or creating a materialized view with precomputed norms to accelerate Python-side scoring via batch fetch.
