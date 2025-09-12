#!/usr/bin/env python3
"""
End-to-end training automation for the Streamlit Training app pipeline.

Steps (all togglable):
 1) Extract schema for a given owner and store in NL2SQL_SCHEMA
 2) Generate synthetic questions and store in NL2SQL_TRAINING
 3) Generate synonyms for each question and store in NL2SQL_SYNONYMS
 4) Build embeddings (questions + synonyms) into NL2SQL_EMBEDDINGS and refresh KD-Tree index
 5) Run evaluation prompts (if present) and store results in NL2SQL_METRICS

Usage:
  python api/Training/run_training.py \
    --host HOST --port 1521 --service SERVICE --user USER --password PASS \
    --schema-owner SCHEMA_OWNER \
    [--skip-schema] [--skip-questions] [--skip-synonyms] [--skip-embeddings] [--skip-eval] \
    [--workers 4] [--use-processes] [--semantic-filter]
"""

from __future__ import annotations

import argparse
import sys
import time
from typing import List

import pandas as pd
from sentence_transformers import SentenceTransformer

# Local imports
from utils.oracle_utils import (
    connect_oracle,
    insert_schema,
    fetch_schema_from_db,
    insert_questions,
    fetch_training_data,
    insert_synonyms,
    fetch_training_synonym_data,
    insert_embeddings,
    refresh_embedding_index,
    fetch_evaluation_prompts,
    insert_evaluation_metric,
    search_embeddings_kdtree,
)
from utils.synthetic_questions import generate_questions
from utils.synonyms import generate_synonyms_bulk


def build_tables_payload(schema_df: pd.DataFrame) -> List[dict]:
    """
    Transform NL2SQL_SCHEMA rows to the shape expected by generate_questions().
    Expects columns: SCHEMA_NAME, TABLE_NAME, QUALIFIED_TABLE_NAME, COLUMN_NAME, DATA_TYPE, SQL_TYPE, QUALIFIED_COLUMN_NAME
    """
    if schema_df.empty:
        return []
    grouped = schema_df.groupby(["SCHEMA_NAME", "TABLE_NAME", "QUALIFIED_TABLE_NAME"], dropna=False)
    tables = []
    for (schema_name, table_name, qualified_name), group in grouped:
        cols = []
        for _, r in group.iterrows():
            cols.append({
                "name": r["COLUMN_NAME"],
                "type": r["DATA_TYPE"],
                "sql_type": r.get("SQL_TYPE", None),
                "col_qualified_name": r.get("QUALIFIED_COLUMN_NAME", r["COLUMN_NAME"]),
            })
        if cols:
            tables.append({
                "schema_name": schema_name,
                "table_name": table_name,
                "qualified_name": qualified_name,
                "columns": cols,
            })
    return tables


def run(args: argparse.Namespace) -> int:
    print("[run] Connecting to Oracle…")
    conn = connect_oracle(args.user, args.password, args.host, args.port, args.service)

    # 1) Schema extraction
    if not args.skip_schema:
        print(f"[schema] Extracting/storing schema for owner={args.schema_owner!r}")
        insert_schema(conn, args.schema_owner)
    else:
        print("[schema] Skipped")

    # 2) Generate questions
    if not args.skip_questions:
        print("[questions] Fetching stored schema…")
        schema_df = fetch_schema_from_db(conn)
        if schema_df.empty:
            print("[questions] No schema found. Aborting questions step.")
            return 2
        print(f"[questions] Rows in NL2SQL_SCHEMA: {len(schema_df)}")
        tables = build_tables_payload(schema_df)
        print(f"[questions] Tables to generate from: {len(tables)}")
        q_list = generate_questions(tables)
        if not q_list:
            print("[questions] No questions generated.")
        else:
            qdf = pd.DataFrame(q_list)
            print(f"[questions] Inserting {len(qdf)} questions…")
            insert_questions(conn, qdf)
    else:
        print("[questions] Skipped")

    # 3) Generate synonyms
    if not args.skip_synonyms:
        train_df = fetch_training_data(conn)  # columns: ID, QUESTION, SQL_TEMPLATE
        if train_df.empty:
            print("[synonyms] No training data found. Aborting.")
        else:
            print(f"[synonyms] Generating synonyms for {len(train_df)} questions…")
            questions = train_df["QUESTION"].tolist()
            syn_lists = generate_synonyms_bulk(
                questions,
                max_variants=args.max_variants,
                workers=args.workers,
                use_processes=args.use_processes,
                use_semantic_filter=args.semantic_filter,
            )
            # Flatten into DataFrame(training_id, question_syn)
            rows = []
            for (tid, _q), syns in zip(train_df[["ID", "QUESTION"]].itertuples(index=False), syn_lists):
                for s in syns:
                    rows.append({"training_id": int(tid), "question_syn": s})
            if rows:
                sdf = pd.DataFrame(rows)
                print(f"[synonyms] Inserting {len(sdf)} synonym rows…")
                insert_synonyms(conn, sdf)
            else:
                print("[synonyms] No synonyms generated.")
    else:
        print("[synonyms] Skipped")

    # 4) Build embeddings (questions + synonyms), refresh in-memory index
    if not args.skip_embeddings:
        # Load model for embeddings
        model_path = args.model_path
        print(f"[embeddings] Loading model from {model_path}")
        model = SentenceTransformer(model_path)

        # Questions
        qdf = fetch_training_data(conn)
        if not qdf.empty:
            print(f"[embeddings] Encoding {len(qdf)} questions…")
            q_emb = model.encode(qdf["QUESTION"].tolist(), convert_to_numpy=True, batch_size=128, show_progress_bar=False)
            insert_embeddings(conn, qdf.rename(columns=str.upper), q_emb, 'Quest')
        else:
            print("[embeddings] No questions found to embed.")

        # Synonyms
        sdf = fetch_training_synonym_data(conn)
        if not sdf.empty:
            print(f"[embeddings] Encoding {len(sdf)} synonyms…")
            s_emb = model.encode(sdf["QUESTION_SYN"].tolist(), convert_to_numpy=True, batch_size=128, show_progress_bar=False)
            insert_embeddings(conn, sdf.rename(columns=str.upper), s_emb, 'Syn')
        else:
            print("[embeddings] No synonyms found to embed.")

        print("[embeddings] Refreshing in-memory KD-Tree index…")
        refresh_embedding_index(conn)
    else:
        print("[embeddings] Skipped")

    # 5) Evaluation
    if not args.skip_eval:
        eval_df = fetch_evaluation_prompts(conn)
        if eval_df.empty:
            print("[eval] No evaluation prompts found; skipping.")
        else:
            print(f"[eval] Running bulk evaluation on {len(eval_df)} prompts…")
            # Reuse model if present, else load
            model_path = args.model_path
            model = SentenceTransformer(model_path)
            run_id = int(time.time())
            hits = 0
            for _, row in eval_df.iterrows():
                pid = int(row["ID"])
                prompt = str(row["PROMPT"]) or ""
                expected_sql = str(row["EXPECTED_SQL"]) or ""
                q_emb = model.encode([prompt], convert_to_numpy=True)[0]
                results = search_embeddings_kdtree(conn, q_emb, top_k=5)
                # Normalize quotes and whitespace for comparison
                exp_norm = expected_sql.strip().replace("'", '"').lower()
                is_hit = any((r["sql_template"] or "").strip().replace("'", '"').lower() == exp_norm for r in results)
                if is_hit:
                    hits += 1
                insert_evaluation_metric(conn, run_id, pid, is_hit)
            print(f"[eval] Completed. Run ID={run_id}, Total={len(eval_df)}, Hits={hits}, HitRate={hits/len(eval_df)*100:.2f}%")
    else:
        print("[eval] Skipped")

    print("[run] Done.")
    return 0


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="End-to-end training automation")
    p.add_argument("--host", required=True)
    p.add_argument("--port", default="1521")
    p.add_argument("--service", required=True)
    p.add_argument("--user", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--schema-owner", required=True, dest="schema_owner")

    # Steps toggles
    p.add_argument("--skip-schema", action="store_true")
    p.add_argument("--skip-questions", action="store_true")
    p.add_argument("--skip-synonyms", action="store_true")
    p.add_argument("--skip-embeddings", action="store_true")
    p.add_argument("--skip-eval", action="store_true")

    # Synonym generation
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--use-processes", action="store_true")
    p.add_argument("--max-variants", type=int, default=20)
    p.add_argument("--semantic-filter", action="store_true")

    # Embedding model path (default consistent with app usage)
    p.add_argument("--model-path", default="../local_all-MiniLM-L6-v2")

    return p.parse_args(argv)


if __name__ == "__main__":
    sys.exit(run(parse_args(sys.argv[1:])))

