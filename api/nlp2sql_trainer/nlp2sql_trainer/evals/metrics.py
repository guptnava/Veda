from __future__ import annotations
import numpy as np
from typing import List, Dict

def accuracy_at_k(golds: List[int], preds: List[List[int]], k: int) -> float:
    ok = 0
    for g, p in zip(golds, preds):
        if g in p[:k]:
            ok += 1
    return ok / max(1, len(golds))

def mrr(golds: List[int], preds: List[List[int]]) -> float:
    s = 0.0
    for g, p in zip(golds, preds):
        try:
            rank = p.index(g) + 1
            s += 1.0 / rank
        except ValueError:
            pass
    return s / max(1, len(golds))

def ndcg_at_k(golds: List[int], preds: List[List[int]], k: int) -> float:
    # binary relevance
    import math
    def dcg(rel):
        return sum([(1 if r else 0) / math.log2(i+2) for i, r in enumerate(rel)])
    total = 0.0
    for g, p in zip(golds, preds):
        rel = [(1 if idx == g else 0) for idx in p[:k]]
        idcg = 1.0  # only one relevant item
        total += dcg(rel) / idcg
    return total / max(1, len(golds))
