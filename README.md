# InsightFlow Lite

Owner: Naveen Gupta 
Contact: g_naveen@hotmail.com
Free version. See Licence , September 2025

Rapidly builds AI agents, integrates enterprise databases, RESTful APIs, using NLP, evaluates against test prompts, and provides advanced data visualization (tables, pivots, charts, filters, virtualization, downloads). Also, intgerates seamlessly to local LLM models such as LLama, Phi, Gema, SQLCoder etc in a standard and generic fashion, just download the model, plug and play to the stack to use and evaluate.

Quick links:
- docs/ARCHITECTURE.md
- docs/TRAINING_PIPELINE.md
- docs/APIS.md
- docs/FRONTEND.md

Quick start:
- Backend training app (Streamlit): `streamlit run api/Training/training_app.py`
- Headless training pipeline: `python api/Training/run_training.py --host HOST --port 1521 --service SERVICE --user USER --password PASS --schema-owner OWNER`
- Node proxy server: `node server/server.js`
- Database Flask API: `python api/database_NoLLM_agent/ai_db_intent_interface.py`

## High‑level architecture:

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
    Other["Other Flask agents<br>(RESTful,Hive/Hadoop, Web, langchain, llamaindex,etc.)"]
  end

  subgraph Train[Training & Eval]
    ST["Streamlit Training App<br>api/Training/training_app.py"]
    RUN["Headless Pipeline<br>api/Training/run_training.py"]
    KD[(In‑memory KD‑Tree Index)]
  end

  Oracle[(Oracle DB)]

  UI -->|NDJSON over HTTP| Srv
  Srv -->|/query| DBI
  Srv -->|/query| Other
  DBI -->|SELECT| Oracle
  Other -->|SELECT/Vector| Oracle
  ST <-->|DDL/Train/Eval| Oracle
  RUN -->|Populate NL2SQL_*| Oracle
  ST --> KD

```
