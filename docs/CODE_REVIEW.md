# Code Review Summary

This review focuses on the training pipeline (`api/Training`), Oracle utilities, the Flask database intent API, and key UI components. Overall the codebase is cohesive with clear separation of concerns. Below are specific strengths and pragmatic recommendations.

## Strengths

- Clear pipeline orchestration: `run_training.py` mirrors the Streamlit app steps and supports selective skipping.
- Useful utilities: `oracle_utils.py` centralizes table DDL, data IO, and KD‑Tree indexing; handles CLOB/BLOB reads safely.
- Synonym generation balances speed and quality: bounded expansion, custom + WordNet synonyms, optional SBERT filtering; parallelism with fallbacks.
- Frontend is modular, UI/UX polished: streaming NDJSON, virtualization, conditional formatting, chart panel, training link.
- Flask DB intent API streams rows and safely serializes Oracle LOBs and decimals.

## Recommendations

- Schema extraction
  - Issue: `insert_schema()` currently filters to sample tables (SALES, EMPLOYEES) and sets `sql_type` to `'PK'` in the SELECT literal.
  - Improve: Broaden to all tables for the owner; compute PK/FK by joining `ALL_CONSTRAINTS` and `ALL_CONS_COLUMNS`. Populate `qualified_*` names meaningfully.

- Embeddings and search
  - Consider storing unit‑normalized vectors and querying KD‑Tree with cosine distance (or pre/post normalize) to make similarity more interpretable.
  - Optionally add a `kind` column to `NL2SQL_EMBEDDINGS` (`'question'|'synonym'`) to aid analysis and troubleshooting.

- Evaluation
  - Current match uses normalized quote/case exact equality; this is brittle. Improve by collapsing whitespace and optionally removing trailing semicolons; for robust checks, consider SQL AST parsing when feasible.

- Robustness and performance
  - KD‑Tree build loads all vectors into memory; if corpus grows large, consider FAISS or an ANN index with paging.
  - `oracle_utils.py` imports `streamlit as st` but does not use it in many paths; remove to reduce non‑DB dependencies in utilities.
  - Ensure NLTK WordNet corpus availability at runtime (document `nltk.download('wordnet')` once or vendor a minimal resource).

- Security/production hardening
  - Flask intent API uses a static `INTENT_SQL_MAP`; acceptable for demos but not for production. Gate with auth, audit logs, and stronger intent detection. Validate/limit SQL surface if expanding.
  - Node proxy forwards full request body; document expected payload fields and enforce schema validation.

## Minor nits

- In `HeaderBar.jsx`, verify all icon assets exist and set sizes on `<img>` consistently (some style blocks are empty in the Training button).
- In `TableComponent.jsx`, non‑virtualized `CollapsibleCell` fragment contains a truncated JSX line; confirm code completion in that block.

## Suggested Next Steps

1) Upgrade `insert_schema()` to compute PK/FK and remove hardcoded table filters.
2) Normalize vectors at insertion and switch KD‑Tree queries to cosine distance.
3) Add SQL normalization utility for evaluation; consider using `sqlparse` for whitespace and casing normalization.
4) Gate Flask endpoints with basic auth/API keys in non‑demo environments.

