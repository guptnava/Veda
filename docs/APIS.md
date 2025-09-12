# APIs & Streaming

## Node Proxy (`server/server.js`)

- Endpoint: `POST /api/generate`
- Routes request by `mode` to appropriate Flask service; supports streaming.
- For DB modes, response is `application/x-ndjson` — each line is one JSON row.

Body (example):
```json
{ "mode": "database", "prompt": "list all employees", "model": "llama3.2:1b", "stream": true }
```

## Database Intent API (Flask)

- File: `api/database_NoLLM_agent/ai_db_intent_interface.py`
- Endpoint: `POST /query`
- Detects intent via simple string matching against `INTENT_SQL_MAP` and executes mapped SQL with SQLAlchemy.
- Streams NDJSON rows. Serializes Oracle types safely:
  - `datetime/date` → ISO string
  - `decimal.Decimal` → float (fallback to string)
  - CLOB → truncated preview object if large
  - BLOB → base64 preview object (length, preview)

Returns: NDJSON with one `{"col": value}` object per line.

## Health/Cache

- `GET /health` → `{ status: "ok" }`
- `POST /clear_cache` → clears disk cache

## Other Agents

Other Flask agents exist under `api/` (e.g., LangChain, LlamaIndex, RAG). The Node proxy forwards the same body to them and streams responses to the UI.

