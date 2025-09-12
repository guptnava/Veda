from __future__ import annotations
from typing import List, Dict, Any, Tuple
import numpy as np, pandas as pd, json
from ..embeddings.embedder import build_embedder
from ..index import faiss_store
from .metrics import accuracy_at_k, mrr, ndcg_at_k

def build_eval_matrix(dataset: pd.DataFrame, embedder_cfg: dict):
    # Build text list (use main question and paraphrases as separate entries mapped to same gold)
    texts = []
    gold_ids = []
    for i, row in dataset.iterrows():
        q = str(row["question"])
        texts.append(q)
        gold_ids.append(i)
        for p in row.get("paraphrases", []) or []:
            texts.append(str(p))
            gold_ids.append(i)
    # Embed
    from ..embeddings.embedder import build_embedder
    embedder = build_embedder(embedder_cfg)
    X = embedder.embed_texts(texts)
    return np.asarray(X), np.asarray(gold_ids), texts

def run_retrieval_eval(dataset: pd.DataFrame, embedder_cfg: dict, faiss_factory: str, k_values: List[int]):
    # Queries are the main questions; candidates are all (main+paraphrases). Gold is position of the row index.
    embedder = build_embedder(embedder_cfg)
    queries = embedder.embed_texts(dataset["question"].astype(str).tolist())

    # Build candidate pool with mapping to gold
    cand_texts = []
    cand_gold = []
    for i, row in dataset.iterrows():
        cand_texts.append(str(row["question"]))
        cand_gold.append(i)
        for p in row.get("paraphrases", []) or []:
            cand_texts.append(str(p))
            cand_gold.append(i)

    candidates = embedder.embed_texts(cand_texts)
    index, meta = faiss_store.build_faiss_index(candidates, factory=faiss_factory)
    I, D = faiss_store.search(index, queries, k=max(k_values))

    # map retrieved indices to dataset row ids
    retrieved_gold = [[cand_gold[j] for j in row] for row in I]
    gold_ids = list(range(len(dataset)))

    report = {"k_values": k_values, "metrics": {}, "per_query": []}
    for k in k_values:
        acc = accuracy_at_k(gold_ids, retrieved_gold, k=k)
        nd = ndcg_at_k(gold_ids, retrieved_gold, k=k)
        report["metrics"][f"accuracy@{k}"] = acc
        report["metrics"][f"ndcg@{k}"] = nd
    report["metrics"]["mrr"] = mrr(gold_ids, retrieved_gold)

    # per-query breakdown
    for qi, row in enumerate(I):
        hits = [cand_gold[j] for j in row]
        report["per_query"].append({
            "query_index": qi,
            "question": dataset.iloc[qi]["question"],
            "gold_row": qi,
            "retrieved_gold": hits,
            "correct@1": hits[0] == qi,
        })

    return report
