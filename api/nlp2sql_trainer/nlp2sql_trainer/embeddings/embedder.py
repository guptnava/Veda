from __future__ import annotations
from typing import Sequence, Dict, Any, List
import numpy as np

class BaseEmbedder:
    def embed_texts(self, texts: Sequence[str]) -> np.ndarray:
        raise NotImplementedError

class SentenceTransformerEmbedder(BaseEmbedder):
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L6-v2", batch_size: int = 64):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer(model_name, device="cpu")
        self.batch_size = batch_size

    def embed_texts(self, texts: Sequence[str]) -> np.ndarray:
        return np.asarray(self.model.encode(list(texts), batch_size=self.batch_size, convert_to_numpy=True, normalize_embeddings=True))

def build_embedder(cfg: dict) -> BaseEmbedder:
    backend = cfg.get("backend", "sentence-transformers")
    if backend == "sentence-transformers":
        return SentenceTransformerEmbedder(model_name=cfg.get("model_name", "sentence-transformers/all-MiniLM-L6-v2"),
                                           batch_size=cfg.get("batch_size", 64))
    else:
        raise ValueError(f"Unknown embeddings backend: {backend}")
