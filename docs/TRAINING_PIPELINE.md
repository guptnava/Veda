# Training Pipeline

The training system produces a retrieval corpus that maps natural language prompts to SQL templates, along with dense embeddings for similarity search.

## Overview

Steps (toggleable in UI and CLI):
1) Extract schema → `NL2SQL_SCHEMA`
2) Generate NL→SQL training pairs → `NL2SQL_TRAINING`
3) Generate synonyms/paraphrases → `NL2SQL_SYNONYMS`
4) Encode embeddings and store → `NL2SQL_EMBEDDINGS`; build KD‑Tree
5) Bulk evaluation → `NL2SQL_METRICS`

## Streamlit App

- File: `api/Training/training_app.py`
- Tabs:
  - Scan Schema: connect to Oracle and ingest metadata.
  - Generate Questions: template‑driven NL→SQL generation; configurable synonym generation.
  - Build Embeddings: encodes questions and synonyms using local SentenceTransformers models.
  - Evaluation: single prompt retrieval + bulk evaluation to compute hit rate.

Launch:
```
streamlit run api/Training/training_app.py
```

Model paths (local):
- `api/local_all-MiniLM-L6-v2` (embedding model)
- `api/local_paraphrase-MiniLM-L6-v2` (paraphraser)

## Headless CLI

- File: `api/Training/run_training.py`

Example:
```
python api/Training/run_training.py \
  --host HOST --port 1521 --service SERVICE \
  --user USER --password PASS \
  --schema-owner OWNER \
  --workers 4 --max-variants 20 --semantic-filter
```

Useful flags:
- `--skip-schema | --skip-questions | --skip-synonyms | --skip-embeddings | --skip-eval`
- `--use-processes` to enable process pool for synonyms
- `--model-path` to override embedding model path

## Schema Extraction

- Helper: `utils/oracle_utils.py::insert_schema`
- Stores table/column/type and qualifiers into `NL2SQL_SCHEMA`.
- Note: current extraction is restricted to sample tables (e.g., SALES, EMPLOYEES). See recommendations to broaden this.

## Question Generation

- Helper: `utils/synthetic_questions.py::generate_questions`
- Templates cover select, count/aggregate, distinct, filter, group_by, order_by. JOIN templates are scaffolded.
- Uses `sql_type` hints to avoid aggregating IDs and to choose meaningful columns.

## Synonym Generation

- Helper: `utils/synonyms.py`
- Combines:
  - Light stopword‑aware word substitutions (custom dict + WordNet)
  - Phrase synonyms
  - SBERT paraphrase seeds
  - Optional semantic filtering by cosine similarity
- Parallelism: threads by default; processes optional with per‑proc thread limits.

## Embedding + Index

- Embedding: SentenceTransformers encodes questions and synonyms; BLOB stored in `NL2SQL_EMBEDDINGS`.
- Index: `KDTree` built in memory; `refresh_embedding_index()` loads all vectors and builds the index.

## Evaluation

- `NL2SQL_EVALUATION` holds prompts + expected SQL.
- Bulk evaluation encodes prompts and checks hits within top‑K retrieval using KD‑Tree; writes results to `NL2SQL_METRICS`.
- Matching currently normalizes quotes and casing for exact string compare.

## Tables

- `NL2SQL_SCHEMA`: schema_name, table_name, column_name, data_type, sql_type, qualified names
- `NL2SQL_TRAINING`: NL question + SQL template pairs
- `NL2SQL_SYNONYMS`: alternative phrasings per training ID
- `NL2SQL_EMBEDDINGS`: question (or synonym) text + vector
- `NL2SQL_EVALUATION`: prompt + expected SQL
- `NL2SQL_METRICS`: run_id, prompt_id, is_hit, timestamp

## Recommendations

- Broaden schema ingestion to all owner tables; compute `sql_type` via `ALL_CONSTRAINTS`/`ALL_CONS_COLUMNS` joins to detect PK/FK.
- Normalize vectors at insert‑time and use cosine distance for KD‑Tree queries.
- Add a `kind` column to `NL2SQL_EMBEDDINGS` to distinguish question vs synonym (optional but useful).
- Improve evaluation to do normalized SQL comparison (strip comments, collapse whitespace) or use an AST‑level compare if possible.

