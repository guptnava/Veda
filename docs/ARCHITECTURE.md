# Architecture Overview

This repository implements an end‑to‑end NL→SQL training and retrieval stack with a modern React UI, a Node proxy, multiple Flask microservices, and an Oracle‑backed training pipeline. The training surface is a Streamlit app that orchestrates schema ingestion, question synthesis, synonym/paraphrase generation, embedding, and evaluation.

## System Diagram

```mermaid
flowchart LR
  subgraph Client
    UI[React/Vite UI]
  end

  subgraph Node[Node Proxy]
    Srv[server/server.js]
  end

  subgraph APIs[Flask Services]
    DBI["database_NoLLM_agent<br>ai_db_intent_interface"]
    Other["Other Flask agents<br>langchain, llamaindex, etc."]
  end

  subgraph Train[Training & Eval]
    ST["Streamlit Training App<br>api/Training/training_app.py"]
    RUN["Headless Pipeline<br>api/Training/run_training.py"]
    KD[(In‑memory KD‑Tree Index)]
  end

  Oracle[(Oracle DB)]

  UI -->|NDJSON over HTTP| Srv
  Srv -->|/api/generate| DBI
  Srv -->|/api/generate| Other
  DBI -->|SELECT| Oracle
  Other -->|SELECT/Vector| Oracle
  ST <-->|DDL/Train/Eval| Oracle
  RUN -->|Populate NL2SQL_*| Oracle
  ST --> KD

```

## Key Components

- `client/` (Vite + React): Rich table/chart UI, streaming NDJSON support, training manager link.
- `server/server.js` (Node): Single entry for UI to call; proxies to Flask services and streams responses.
- `api/database_NoLLM_agent/ai_db_intent_interface.py` (Flask): Intent→SQL lookup + Oracle execution; streams rows as NDJSON with safe serialization (CLOB/BLOB supported).
- `api/Training/training_app.py` (Streamlit): Human‑in‑the‑loop training/evaluation manager.
- `api/Training/run_training.py`: Headless pipeline (schema→questions→synonyms→embeddings→eval).
- `api/Training/utils/*`: Oracle helpers, KD‑Tree index, question and synonym generation.

## Data Model (Oracle)

- `NL2SQL_SCHEMA(schema_name, table_name, column_name, data_type, sql_type, qualified_table_name, qualified_column_name)`
- `NL2SQL_TRAINING(id, schema_name, table_name, question, sql_template)`
- `NL2SQL_SYNONYMS(id, training_id, question_syn)`
- `NL2SQL_EMBEDDINGS(id, training_id, question, embedding BLOB)`
- `NL2SQL_EVALUATION(id, prompt, expected_sql)`
- `NL2SQL_METRICS(run_id, prompt_id, is_hit, timestamp)`

## Data Flow

```mermaid
sequenceDiagram
  participant ST as Streamlit
  participant Q as QuestionGen
  participant SY as Synonyms
  participant SB as SBERT
  participant DB as Oracle
  participant IDX as KD‑Tree

  ST->>DB: Ensure NL2SQL_* tables
  ST->>DB: Insert NL2SQL_SCHEMA (owner)
  ST->>Q: Build tables payload from schema
  Q-->>ST: Synthetic NL→SQL pairs
  ST->>DB: Insert NL2SQL_TRAINING
  ST->>SY: Generate synonyms (threads/processes)
  SY-->>ST: List of paraphrases per question
  ST->>DB: Insert NL2SQL_SYNONYMS
  ST->>SB: Encode questions + synonyms (SentenceTransformers)
  SB-->>ST: Vectors
  ST->>DB: Insert NL2SQL_EMBEDDINGS
  ST->>IDX: Build/refresh in‑memory KD‑Tree
```

## Notes & Trade‑offs

- KD‑Tree uses Euclidean distance; app reports a derived similarity value. Consider pre‑normalizing vectors and using cosine distance for interpretability.
- Synonyms blend WordNet, custom maps, and SBERT‑based paraphrases; optional semantic filtering prunes outliers.
- The intent Flask has a static intent→SQL map; it’s intended as a thin direct‑SQL baseline, not a learned model.

