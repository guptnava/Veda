from __future__ import annotations
from typing import Tuple, Dict, Any
import numpy as np
import pandas as pd

# Attempt to import FAISS, but provide dummy fallback if not installed
try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    print("Warning: FAISS not available. Using Oracle backend only.")

def build_faiss_index(embeddings: np.ndarray, factory: str = "IVF64,Flat") -> Tuple[Any, Dict[str, Any]]:
    if not FAISS_AVAILABLE:
        print("FAISS is skipped. Returning None index.")
        return None, {"dim": embeddings.shape[1]}
    d = embeddings.shape[1]
    index = faiss.index_factory(d, factory)
    if not isinstance(index, faiss.IndexFlat):
        quantizer = faiss.IndexFlatIP(d)
        index = faiss.IndexIVFFlat(quantizer, d, 64, faiss.METRIC_INNER_PRODUCT) if factory.startswith("IVF") else index
    faiss.normalize_L2(embeddings)
    if isinstance(index, faiss.IndexIVFFlat):
        index.train(embeddings)
    index.add(embeddings)
    return index, {"dim": d}

def search(index: Any, queries: np.ndarray, k: int = 10) -> Tuple[np.ndarray, np.ndarray]:
    if not FAISS_AVAILABLE or index is None:
        raise RuntimeError("FAISS not available. Cannot perform FAISS search.")
    faiss.normalize_L2(queries)
    D, I = index.search(queries, k)
    return I, D

def save(index: Any, path: str):
    if FAISS_AVAILABLE and index is not None:
        faiss.write_index(index, path)
    else:
        print("FAISS not available. Skipping save.")

def load(path: str) -> Any:
    if FAISS_AVAILABLE:
        return faiss.read_index(path)
    else:
        print("FAISS not available. Returning None.")
        return None

