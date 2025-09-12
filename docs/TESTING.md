# Testing

This repo includes a pytest suite focusing on core Python modules used by the training pipeline and the database intent API.

Run Python tests:
```
python -m pytest
```

With coverage:
```
python -m pytest --cov --cov-config=.coveragerc --cov-report=term-missing
```

Notes
- Tests avoid heavy dependencies by monkeypatching and faking external modules (e.g., `sentence_transformers`, `oracledb`).
- UI (Streamlit/React) and Node proxy are not covered by this unit test suite; consider e2e tests or integration tests for those layers.
- To extend coverage to `oracle_utils`, add tests that mock a DB cursor/connection and exercise `ensure_tables`, `insert_*`, and KD‑Tree helpers.

JS/React tests (Vitest)
1) Install dev dependencies in `client/`:
```
cd client
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```
2) Run tests:
```
npm run test
```
Configuration notes:
- Vitest is configured in `client/vite.config.js` with `environment: 'jsdom'` and setup file `src/test.setup.tsx`.
- Tests live under `client/src/__tests__/`.

Node server tests (Vitest + Supertest)
1) Install dev dependencies in `server/`:
```
cd server
npm install --save-dev vitest supertest
```
2) Run tests:
```
npm test
```
Notes:
- `server/server.js` exports the Express `app` and skips `app.listen()` when `NODE_ENV==='test'` to allow Supertest.
- Basic tests live under `server/test/` and cover error paths without external services.


pytest test suite targeting the core Python modules and set up coverage config. It’s isolated from external deps via fakes/monkeypatches so you can run locally without Oracle/models.

What I added

### Python tests
- tests/test_synonyms.py: Unit tests for tokenization, content-word detection, bounded expansion, phrase synonyms, and end-to-end generation (with and without semantic filter; models patched).
- tests/test_synthetic_questions.py: Deterministic tests for question/template generation across select/count/distinct/order_by.
- tests/test_run_training.py: Argument parsing (no external deps).
- tests/test_ai_db_intent_interface.py: is_safe_sql, detect_intent, and serialize_row for datetime/Decimal/CLOB/BLOB-safe handling.
#### Test scaffolding
- tests/conftest.py: Lightweight fakes for missing modules (oracledb, pandas, sentence_transformers) so imports don’t break during tests.
- pytest.ini: Test discovery config.
- .coveragerc: Coverage config focusing on api/Training and api/database_NoLLM_agent; omits Streamlit UI, Node, and client code.
- docs/TESTING.md: How to run tests and produce coverage reports.

#### How to run (locally)

- Unit tests: python -m pytest
- With coverage: python -m pytest --cov --cov-config=.coveragerc --cov-report=term-missing

#### Coverage scope

- Included: api/Training/utils (synonyms, synthetic_questions), api/Training (run_training parse_args), api/database_NoLLM_agent (intent API serialization and helpers).
- Excluded by config: Streamlit UI, Node proxy, React frontend.
- Rationale: Unit testing UI/Node here would require separate frameworks and adds little to the core training/intent logic.

#### Notes and next steps

- Oracle utilities: I did not add tests for utils/oracle_utils.py because it requires DB/LOB and SciPy KDTree. If you want, I can add high-value tests with a mocked DB cursor/connection to cover:

- ensure_tables()
- insert_* (questions/synonyms/embeddings)
- search_embeddings_kdtree() using a fake KDTree and small in-memory vectors

#### “Full coverage” across the entire repo (including UI/Node) would require:

- JS tests (Jest/Vitest) for server/server.js route selection and streaming proxy behavior.
- React component tests (React Testing Library) for HeaderBar/LeftPanel/TableComponent interactions.
- Optional integration tests that spin up the Flask API(s) with a temporary SQLite/Oracle mock and hit them via the Node proxy.


#### Python: oracle utils tests

- tests/test_oracle_utils.py:
  - Builds a fake KD-Tree and Oracle connection to cover refresh_embedding_index() + search_embeddings_kdtree() with real byte-encoded vectors.
  - Verifies ensure_tables() executes CREATE blocks and commits.
- tests already present cover synonyms, question generation, run_training args, and Flask intent API.
- tests/conftest.py: Expanded fakes for sentence_transformers and provided a minimal sciPy KDTree replacement via monkeypatch in tests (per-test).
- JS/React: Vitest + Testing Library

  - client/src/tests/HeaderBar.test.jsx: Renders and verifies the Training Manager button opens a new tab.
  - client/src/tests/LeftPanel.test.jsx: Renders Settings panel.
  - client/src/tests/TableComponent.test.jsx: Smoke render with minimal data.
  - client/vite.config.js: Added vitest test config (jsdom env + setup).
  - client/package.json: Added scripts and devDependencies for testing.
  - client/src/test.setup.tsx: Jest-DOM setup + small polyfills.
  
- Config and docs

  - .coveragerc: Coverage focus on Python training and DB intent modules.
  - pytest.ini: Test discovery config.
  - docs/TESTING.md: Instructions for running Python and frontend tests with coverage.


#### How to run locally

- Python unit tests:
  - python -m pytest
  - With coverage: python -m pytest --cov --cov-config=.coveragerc --cov-report=term-missing
- JS/React tests:
  - cd client
  - npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
  - npm run test

Notes and next steps

- The Python tests run with minimal fakes and do not require a live Oracle DB or real models.
- If you want deeper oracle_utils coverage (insert_* behavior, read_sql paths), I can add tests that mock pandas.read_sql and verify SQL/parameters passed.
- If you want Node server route tests, I can add vitest + supertest tests for server/server.js, but that requires adding supertest/dev deps and a small export for the app instance.



#### Added Vitest + Supertest test setup and server export for testing.


- Exported the Express app and gated listen in test:
  - server/server.js: Exports app and wraps app.listen() with if (process.env.NODE_ENV !== 'test').
- Server test suite (Vitest + Supertest):
  - server/test/server.test.js: Supertest-based tests for:
    - POST /api/generate with invalid mode → 400
    - POST /api/download-csv with missing data → 400
  - server/package.json: Added devDependencies and scripts:
    - devDependencies: vitest, supertest
    - scripts: "test": "vitest"
- Frontend test setup (already added earlier):
  - Vitest configured in client/vite.config.js with jsdom environment and setup file.
  - Client tests under client/src/__tests__/ for HeaderBar, LeftPanel, TableComponent.
  - client/package.json: Added devDependencies and scripts for Vitest.

Docs updated

- docs/TESTING.md:
  - Added instructions for running JS/React tests (client) and Node server tests (server) with required dev dependencies and notes about test environment.

How to run tests locally

- Python unit tests (from repo root):
  - python -m pytest
  - With coverage: python -m pytest --cov --cov-config=.coveragerc --cov-report=term-missing
- JS/React tests (client):
  - cd client
  - npm install
  - npm run test
- Node server tests:
  - cd server
  - npm install
  - npm test


Notes

- server/server.js now skips binding a port when NODE_ENV=test, enabling Supertest to import and use the app directly.
- Server tests exercise non-network error paths to avoid external dependencies; you can extend with mocks for undici fetch to cover success paths too.
- If you want tests for the Node proxy streaming behavior, I can add a mock fetch responder inside Vitest to simulate NDJSON and assert piping behavior.


##### Added streaming tests for the Node proxy using Vitest + Supertest and mocked undici fetch.

What’s included

- Module mocking for undici:
  - server/test/streaming.test.js
    - Mocks undici’s fetch to return a Response-like object whose body.getReader() yields encoded NDJSON chunks.
    - Tests:
      - /api/generate (mode=database): verifies Content-Type application/x-ndjson and presence of streamed lines.
      - /api/download-json-query: verifies NDJSON is aggregated into a JSON array and narration lines are skipped.

Supporting changes

- server/server.js:
  - Exports Express app and skips listen when NODE_ENV=test to support Supertest.
  - server/package.json:
    - Added devDependencies: vitest, supertest
    - Script: test runs vitest

How to run

- Node server tests:

  - cd server
  - npm install
  - npm test
- JS/React tests (already added earlier):

  - cd client
  - npm install
  - npm run test

- Python tests + coverage:

  - python -m pytest
  - python -m pytest --cov --cov-config=.coveragerc --cov-report=term-missing

Optional next steps

  - Add a mock for node-fetch in tests to cover /health path behavior.
  - Add a streaming test for /api/download-excel-query by mocking undici to yield NDJSON and asserting response headers/content-type, though binary assertions are less informative without parsing XLSX.


Added a streaming test for /api/download-excel-query.

What’s included

- server/test/excel-streaming.test.js
  - Mocks undici.fetch to yield NDJSON lines.
  - Calls POST /api/download-excel-query with a valid body.
  - Asserts:
    - 200 response
    - Content-Type includes application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    - Response body is a non-trivial Buffer and starts with ZIP magic number PK (xlsx file).

How to run

- From server directory:
  - npm install
  - npm test

If you want, I can add a similar test for /api/download-pdf-query verifying Content-Type and that the returned Buffer starts with a valid PDF header (%PDF).


Added streaming tests for PDF, CSV, and confirmed JSON.

What’s new

- /api/download-pdf-query

  - server/test/pdf-streaming.test.js
    - Mocks undici.fetch to stream NDJSON.
    - Asserts 200, Content-Type application/pdf, and PDF magic header %PDF- in Buffer.

- /api/download-csv-query

  - server/test/csv-streaming.test.js
    - Mocks undici.fetch to stream NDJSON with commas and newlines plus a narration line.
    - Asserts 200, Content-Type text/csv, header row present, quoting for commas, and presence of newline content.

- Existing JSON streaming test remains:

  - server/test/streaming.test.js already covers /api/download-json-query and /api/generate streaming.

How to run

- From server:
  - npm install
  - npm test