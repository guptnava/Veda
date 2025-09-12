from __future__ import annotations
import click, json, os, pandas as pd
from .utils.io import read_json, write_json, write_jsonl, ensure_dir, write_parquet, read_parquet
from .connectors.oracle_schema import connect, fetch_schema
from .data.gen_questions import generate_questions_from_schema
from .embeddings.embedder import build_embedder
from .index.faiss_store import save as save_faiss, load as load_faiss, build_faiss_index
from .evals.runner import run_retrieval_eval
from .validation.oracle_runner import try_execute
from .index import oracle_store
import pyarrow as pa, pyarrow.parquet as pq

import oracledb
import datetime

def _load_config(path: str) -> dict:
    import yaml
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

@click.group()
def cli():
    pass


def serialize_value(val):
    if isinstance(val, oracledb.LOB):
        return val.read()  # read as string
    elif isinstance(val, bytes):
        return val.decode("utf-8", errors="ignore")
    elif isinstance(val, datetime.datetime):
        return val.isoformat()
    return val

def make_json_serializable(obj):
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(v) for v in obj]
    else:
        return serialize_value(obj)


@cli.command()
@click.option("--config", required=True, help="Path to config.yaml")
@click.option("--out", required=True, help="Output schema JSON")
def extract_schema(config, out):
    import traceback
    import oracledb
    import datetime
    print("hello=============")
    
    cfg = _load_config(config)

    print("DEBUG: include_schemas =", cfg["schema"]["include_schemas"])
    print("DEBUG: exclude_tables =", cfg["schema"].get("exclude_tables", []))
    print("DEBUG: sample_rows_per_table =", cfg["schema"].get("sample_rows_per_table", 0))

    try:
        conn = connect(cfg["oracle"])
        print("DEBUG: Oracle connection success")
    except Exception as e:
        print("ERROR: Oracle connection failed")
        traceback.print_exc()
        return

    try:
        sch = fetch_schema(
            conn,
            cfg["schema"]["include_schemas"],
            cfg["schema"].get("exclude_tables", []),
            cfg["schema"].get("sample_rows_per_table", 0)
        )
        print("DEBUG: fetched schema keys:", list(sch.keys()) if sch else "None or empty")

        # Remove LOB/BLOB data from samples
        for schema_name, schema in sch.get("schemas", {}).items():
            for table_name, table in schema.get("tables", {}).items():
                lob_cols = [c["name"] for c in table.get("columns", []) if c["type"] in ("CLOB", "BLOB")]
                for row in table.get("samples", []):
                    for col in lob_cols:
                        row.pop(col, None)  # Remove LOB/BLOB column

        safe_sch = make_json_serializable(sch)
        write_json(safe_sch, out)

        print("DEBUG: wrote schema to", os.path.abspath(out))

    except Exception as e:
        print("ERROR: fetch_schema or JSON serialization failed")
        traceback.print_exc()
        return




@cli.command("gen-dataset")
@click.option("--config", required=True)
@click.option("--schema", "schema_path", required=True)
@click.option("--out", required=True, help="Output dataset JSONL")
def gen_dataset(config, schema_path, out):
    cfg = _load_config(config)
    sch = read_json(schema_path)
    rows = list(generate_questions_from_schema(
        sch,
        max_questions_per_table=cfg["generation"]["max_questions_per_table"],
        paraphrase_strategy=cfg["generation"]["paraphrase_strategy"],
        max_paraphrases=cfg["generation"]["max_paraphrases_per_question"],
        seed=cfg["eval"]["seed"],
    ))
    write_jsonl(rows, out)
    click.echo(f"Wrote dataset with {len(rows)} rows to {out}")

@cli.command()
@click.option("--config", required=True)
@click.option("--dataset", required=True)
@click.option("--out", required=True, help="Output embeddings Parquet")
def embed(config, dataset, out):
    cfg = _load_config(config)
    import json
    # Load dataset
    records = [json.loads(line) for line in open(dataset, "r", encoding="utf-8").read().splitlines() if line.strip()]
    df = pd.DataFrame.from_records(records)
    # Texts = main + paraphrases as separate rows but keep group id
    texts, qids = [], []
    for i, r in df.iterrows():
        texts.append(r["question"])
        qids.append(i)
        for p in r.get("paraphrases", []) or []:
            texts.append(p)
            qids.append(i)
    embedder = build_embedder(cfg["embeddings"])
    X = embedder.embed_texts(texts)
    out_df = pd.DataFrame({"text": texts, "gold_id": qids})
    for j in range(X.shape[1]):
        out_df[f"dim{j}"] = X[:, j]
    ensure_dir(out)
    out_df.to_parquet(out, index=False)
    click.echo(f"Wrote embeddings to {out} with shape {X.shape}")

@cli.command("build-index")
@click.option("--config", required=True)
@click.option("--embeddings", required=True)
@click.option("--out", required=False, help="When backend=faiss, path to index file")
def build_index(config, embeddings, out):
    cfg = _load_config(config)
    backend = cfg["index"].get("backend", "oracle")
    df = read_parquet(embeddings)
    vec_cols = [c for c in df.columns if c.startswith("dim")]
    import numpy as np
    X = df[vec_cols].to_numpy(dtype="float32")
    texts = df["text"].tolist()
    golds = df["gold_id"].tolist()

    if backend == "faiss":
        if not out:
            raise click.UsageError("--out is required when backend=faiss")
        from .index.faiss_store import build_faiss_index, save as save_faiss
        index, _ = build_faiss_index(X, factory=cfg["index"].get("faiss_factory","IVF64,Flat"))
        save_faiss(index, out)
        click.echo(f"Saved FAISS index to {out}")
    elif backend == "oracle":
        conn = connect(cfg["oracle"])
        info = oracle_store.create_table(conn, cfg["index"]["table_name"], dim=X.shape[1], prefer_native=cfg["index"].get("prefer_native_vector", True))
        oracle_store.insert_embeddings(conn, cfg["index"]["table_name"], texts, golds, X, mode=info["mode"])
        click.echo(f"Inserted {len(texts)} embeddings into Oracle table {cfg['index']['table_name']} (mode={info['mode']})")
    else:
        raise click.ClickException(f"Unknown index backend: {backend}")

@cli.command()
@click.option("--config", required=True)
@click.option("--dataset", required=True)
@click.option("--index", "index_path", required=False, help="When backend=faiss, path to index file")
@click.option("--embeddings", required=True, help="The same embeddings parquet used for index")
@click.option("--report", required=True)
def eval(config, dataset, index_path, embeddings, report):
    cfg = _load_config(config)
    backend = cfg["index"].get("backend", "oracle")
    # load dataset
    import json
    records = [json.loads(line) for line in open(dataset, "r", encoding="utf-8").read().splitlines() if line.strip()]
    df = pd.DataFrame.from_records(records)

    # Build queries from *main* questions only
    from .embeddings.embedder import build_embedder
    embedder = build_embedder(cfg["embeddings"])
    Q = embedder.embed_texts(df["question"].astype(str).tolist())

    gold_ids = list(range(len(df)))
    kmax = max(cfg["eval"]["k_values"])
    retrieved_gold = []

    if backend == "faiss":
        if not index_path:
            raise click.UsageError("--index is required when backend=faiss")
        from .index import faiss_store as _fs
        import faiss
        index = faiss.read_index(index_path)
        I, D = _fs.search(index, Q, k=kmax)
        # Need candidate->gold map from embeddings file
        emb_df = read_parquet(embeddings)
        gold_map = emb_df["gold_id"].astype(int).tolist()
        for row in I:
            retrieved_gold.append([gold_map[j] for j in row])
    elif backend == "oracle":
        # Oracle backend: run top-k search per query in DB (or Python fallback)
        conn = connect(cfg["oracle"])
        for q in Q:
            hits = oracle_store.search(conn, cfg["index"]["table_name"], q, kmax)
            retrieved_gold.append([h["gold_id"] for h in hits])
    else:
        raise click.ClickException(f"Unknown index backend: {backend}")

    from .evals.metrics import accuracy_at_k, mrr, ndcg_at_k
    metrics = {}
    for k in cfg["eval"]["k_values"]:
        metrics[f"accuracy@{k}"] = accuracy_at_k(gold_ids, retrieved_gold, k=k)
        metrics[f"ndcg@{k}"] = ndcg_at_k(gold_ids, retrieved_gold, k=k)
    metrics["mrr"] = mrr(gold_ids, retrieved_gold)

    out = {"metrics": metrics, "k_values": cfg["eval"]["k_values"], "backend": backend}
    ensure_dir(report)
    with open(report, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    click.echo(f"Wrote eval report to {report}\nMetrics: {metrics}")


if __name__ == "__main__":
    try:
        cli()
    except Exception as e:
        import traceback
        print("CLI failed with exception:")
        traceback.print_exc()
