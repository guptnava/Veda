NLP→SQL Training & Evaluation Centre

Streamlit application to manage the full lifecycle of retrieval training against Oracle: ingest schema, synthesize questions and synonyms, embed vectors, build an in‑memory index, and evaluate prompts.

Features
- Oracle integration (schema ingest; persistent training corpus)
- Synthetic question generation (template‑driven)
- Synonyms/paraphrases (WordNet + SBERT; optional semantic filter)
- Vector embeddings (SentenceTransformers, local models)
- In‑memory KD‑Tree index (fast top‑K lookup)
- Bulk evaluation + metrics logging

Prerequisites
- Python 3.8+
- Oracle DB with a user that can read `ALL_TAB_COLUMNS` and create tables in its schema
- Local models in `api/local_all-MiniLM-L6-v2` and `api/local_paraphrase-MiniLM-L6-v2`

Install
```
pip install -r api/Training/requirements.txt
```

Run (UI)
```
streamlit run api/Training/training_app.py
```

Run (headless)
```
python api/Training/run_training.py \
  --host HOST --port 1521 --service SERVICE \
  --user USER --password PASS \
  --schema-owner OWNER
```

Workflow (tabs)
1. Scan Schema → store `NL2SQL_SCHEMA`
2. Generate Questions → `NL2SQL_TRAINING` + `NL2SQL_SYNONYMS`
3. Build Embeddings → `NL2SQL_EMBEDDINGS` + refresh KD‑Tree
4. Evaluation → single prompt + bulk runs to `NL2SQL_METRICS`

Tables
- `NL2SQL_SCHEMA(schema_name, table_name, column_name, data_type, sql_type, qualified_table_name, qualified_column_name)`
- `NL2SQL_TRAINING(id, schema_name, table_name, question, sql_template)`
- `NL2SQL_SYNONYMS(id, training_id, question_syn)`
- `NL2SQL_EMBEDDINGS(id, training_id, question, embedding BLOB)`
- `NL2SQL_EVALUATION(id, prompt, expected_sql)`
- `NL2SQL_METRICS(run_id, prompt_id, is_hit, timestamp)`

Notes
- The KD‑Tree uses Euclidean distance; reported similarity is a derived value. Consider normalized vectors + cosine distance.
- The schema extractor is currently filtered to sample tables (`SALES`, `EMPLOYEES`). Broaden this for real deployments.
