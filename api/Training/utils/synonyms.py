# synonyms.py — optimized for speed & multi-CPU
import os
import re
import math
import itertools
from functools import lru_cache
from typing import Iterable, List, Tuple, Optional

# NLTK WordNet
from nltk.corpus import wordnet as wn

# SentenceTransformers (lazy-loaded)
from sentence_transformers import SentenceTransformer, util
import numpy as np

# --------------------
# Configurable limits
# --------------------
MAX_SYNS_PER_WORD = 3          # cap word-level syns
MAX_WORDS_TO_EXPAND = 3        # expand only top N content words per sentence
MAX_SENTENCE_VARIANTS = 64     # cap before phrase/paraphrase steps
MAX_PARAPHRASE_SEEDS = 5       # seed paraphraser with at most N sentences
PARAPHRASE_TOPK = 5            # paraphrases per seed

# Light stopword list to avoid expanding glue words
STOPWORDS = {
    "the","a","an","of","to","in","on","for","by","is","are","was","were","be","been","and","or",
    "me","my","i","you","your","our","their","with","as","at","from","that","this","these","those",
    "please","can","could","would","should","show","give"  # keep common verbs minimal
}

# --------------------
# Static synonym maps
# --------------------
SYNONYM_DICT = {
    "show": ["list", "display", "give me"],
    "records": ["rows", "entries", "data"],
    "count": ["number", "total", "how many"],
    "customers": ["clients", "buyers", "users"],
    "orders": ["purchases", "transactions", "sales"],
    "employees": ["staff", "workers", "team members"],
    "products": ["items", "goods", "inventory"],
    "dataset definitions": ["feed", "dataset", "users"],
    "report definition": ["report", "outgoing feed", ""],
    "dispatcher": ["staff", "workers", "team members"],
    "extracts": ["items", "goods", "inventory"],
    "data quality": ["items", "goods", "inventory"],
    "data quality rules": ["items", "goods", "inventory"],
    "data quality logs": ["items", "goods", "inventory"],
    "Streaming workflow logs": ["items", "goods", "inventory"],
    
}

PHRASE_SYNONYM_DICT = {
    "show me": ["could you show", "please show", "i want to see", "list for me", "could you display"],
    "give me": ["provide me", "can i have", "please give", "let me have"],
    "how many": ["what is the number of", "count of", "total number of"],
}

# --------------------
# Model loading (lazy)
# --------------------
_semantic_model: Optional[SentenceTransformer] = None
_paraphrase_model: Optional[SentenceTransformer] = None

def _resolve_model(path_relative_to_this_file: str) -> str:
    from pathlib import Path
    base = Path(__file__).resolve().parent
    return str((base / path_relative_to_this_file).resolve())

def _load_models_once() -> Tuple[SentenceTransformer, SentenceTransformer]:
    """
    Lazy, per-process model init. Import-time loading in your old file caused
    slow starts and complicated multiprocessing. We keep it here.  """
    global _semantic_model, _paraphrase_model
    if _semantic_model is None:
        # Adjust these paths for your environment if needed:
        semantic_path = _resolve_model("../../local_all-MiniLM-L6-v2")
        _semantic_model = SentenceTransformer(semantic_path)
    if _paraphrase_model is None:
        paraphrase_path = _resolve_model("../../local_paraphrase-MiniLM-L6-v2")
        _paraphrase_model = SentenceTransformer(paraphrase_path)
    return _semantic_model, _paraphrase_model

# ---------------------------------
# WordNet + paraphrase helpers (cached)
# ---------------------------------
@lru_cache(maxsize=10000)
def _wordnet_synonyms_cached(word: str, max_syns: int = MAX_SYNS_PER_WORD) -> Tuple[str, ...]:
    syns = set()
    try:
        for synset in wn.synsets(word):
            for lemma in synset.lemmas():
                syns.add(lemma.name().replace("_", " "))
    except Exception:
        pass
    syns.discard(word)
    out = list(syns)[:max_syns]
    return tuple(out)

@lru_cache(maxsize=10000)
def _paraphrases_cached(sentence: str, top_k: int = PARAPHRASE_TOPK) -> Tuple[str, ...]:
    _, paraphrase_model = _load_models_once()
    # mine paraphrases from simple candidates via cosine similarity
    candidates = [
        sentence.replace("show", "display"),
        sentence.replace("show", "list"),
        "Can you " + sentence.lower(),
        "Please " + sentence.lower(),
        "I would like to " + sentence.lower(),
    ]
    emb = paraphrase_model.encode(candidates, convert_to_numpy=True)
    q = paraphrase_model.encode(sentence, convert_to_numpy=True)
    sims = util.cos_sim(q, emb)[0].cpu().numpy()
    ranked = [c for c, s in sorted(zip(candidates, sims), key=lambda x: x[1], reverse=True)]
    return tuple(ranked[:top_k])

# ---------------------------------
# Core generation (bounded expansion)
# ---------------------------------
TOKEN_RE = re.compile(r"[A-Za-z0-9']+|[^\w\s]")

def _tokenize(text: str) -> List[str]:
    """  _tokenize("Don't panic, 3.14!") becomes:
        ["Don't", "panic", ",", "3", ".", "14", "!"]"""
    
    print("inside _tokenize.................")
    return TOKEN_RE.findall(text)

def _is_content_word(token: str) -> bool:

    """Normalize & trim edge punctuation
        token.lower() → case-insensitive checks.
        .strip("?,.!:;\"'") → removes those characters only at the start/end (keeps internal punctuation like "O'Reilly" or co-op).
        Reject non-words
        not t → empty after stripping? (e.g., just "!") ⇒ False.
        not any(ch.isalpha() for ch in t) → must contain at least one letter (Unicode-aware).
        Pure numbers ("123"), symbols ("©"), punctuation-only, or emoji-only ⇒ False.
        Reject stopwords
        If the cleaned token is in STOPWORDS (e.g., the, and, me, please) ⇒ False.
        Otherwise → True (it’s a content word).
        Quick examples
        "Employees" → employees → has letters, not a stopword ⇒ True
        "me" → in STOPWORDS ⇒ False
        "3.14" → contains no letters ⇒ False
        "Don't" → don't (apostrophe not stripped from middle), has letters, not a stopword ⇒ True
        "—" or "!" → stripped to empty ⇒ False
        "café" → letters present (Unicode), not a stopword ⇒ True
        "snake_case" → has letters, not a stopword ⇒ True
        """
    t = token.lower().strip("?,.!:;\"'")
    if not t or not any(ch.isalpha() for ch in t):
        return False
    if t in STOPWORDS:
        return False
    return True

def _word_syns(token: str) -> List[str]:

    """Example
        If token = "Employees,", and:
        SYNONYM_DICT["employees"] = ["staff", "workers", "team members"]
        WordNet adds ["employees", "workers", "personnel"]
        Then the function might return (with MAX_SYNS_PER_WORD = 3):
        ["staff", "workers", "team members"]"""

    key = token.lower().strip("?,.!:;\"'")
    syns = []
    syns.extend(SYNONYM_DICT.get(key, []))              # custom dict first
    syns.extend(_wordnet_synonyms_cached(key))          # then WordNet (cached)
    # keep unique while preserving order
    seen = set()
    out = []
    for s in syns:
        if s not in seen and s:
            seen.add(s)
            out.append(s)
        if len(out) >= MAX_SYNS_PER_WORD:
            break
    return out

def _bounded_expand(tokens: List[str]) -> List[str]:
    """
    Expand only up to MAX_WORDS_TO_EXPAND content tokens. Bound total variants.  -- THIS IS IMPORTANT as controls cartesian product to max variants
    Here’s what _bounded_expand() does, step by step. It’s a controlled synonym expander that avoids combinatorial blow-ups.

            1) Pick which words can be expanded
            idxs = [i for i, t in enumerate(tokens) if _is_content_word(t)]
            expand_idxs = idxs[:MAX_WORDS_TO_EXPAND]
            It scans tokens and keeps the indices of content words (using your _is_content_word heuristic—usually “real” words, not stopwords/punctuation).
            It then takes only the first MAX_WORDS_TO_EXPAND of those indices (bias: earlier words matter more).
            2) Build the choices per token
            choices: List[List[str]] = []
            for i, tok in enumerate(tokens):
                if i in expand_idxs:
                    syns = _word_syns(tok)
                    opts = [tok] + syns        # original first, then synonyms
                else:
                    opts = [tok]               # not expandable -> only itself
                choices.append(opts)
            For each token:
            If it’s chosen for expansion, options are [original, synonym1, synonym2, ...].
            Otherwise, options are just [original].
            Putting the original first biases the earliest variants to look natural.
            3) Cartesian product (but bounded)
            variants = []
            for prod in itertools.product(*choices):
                variants.append(" ".join(prod))
                if len(variants) >= MAX_SENTENCE_VARIANTS:
                    break
            itertools.product(*choices) generates all combinations of picks—i.e., every way to choose one option per token.
            That can explode, so it stops early after MAX_SENTENCE_VARIANTS sentences. This is the key guardrail.
            4) Case-insensitive de-duplication (order preserved)
            seen = set()
            out = []
            for s in variants:
                k = s.lower()
                if k not in seen:
                    seen.add(k)
                    out.append(s)
            return out
            It removes duplicates by comparing lowercase strings, keeping the first occurrence.
            Returns the pruned, ordered list.
            Tiny example
            Suppose:
            tokens = ["show", "me", "employees"]
            # _is_content_word("show")     -> True
            # _is_content_word("me")       -> False (stopword)
            # _is_content_word("employees")-> True
            MAX_WORDS_TO_EXPAND = 2
            _word_syns("show")      -> ["display", "list"]
            _word_syns("employees") -> ["staff", "workers"]
            expand_idxs = indices of show and employees.
            choices becomes:
            for "show": ["show", "display", "list"]
            for "me": ["me"]
            for "employees": ["employees", "staff", "workers"]
            Cartesian product (bounded) yields, e.g.:
            "show me employees"
            "show me staff"
            "show me workers"
            "display me employees"
            "display me staff"
            "display me workers"
            "list me employees"
            ...
            Capped at MAX_SENTENCE_VARIANTS.
                """
    print("inside _bounded_expand.................")
    # pick indices of content words
    idxs = [i for i, t in enumerate(tokens) if _is_content_word(t)]
    # choose first N content words to expand (heuristic: earlier words matter more)
    expand_idxs = idxs[:MAX_WORDS_TO_EXPAND]

    # build per-token choice lists
    choices: List[List[str]] = []
    for i, tok in enumerate(tokens):
        if i in expand_idxs:
            syns = _word_syns(tok)
            # keep original first to bias towards natural variants
            opts = [tok] + syns
        else:
            opts = [tok]
        choices.append(opts)

    # bounded cartesian product
    variants = []
    for prod in itertools.product(*choices):
        variants.append(" ".join(prod))
        if len(variants) >= MAX_SENTENCE_VARIANTS:
            break
    # dedupe keeping order
    seen = set()
    out = []
    for s in variants:
        k = s.lower()
        if k not in seen:
            seen.add(k)
            out.append(s)
    return out


"""Example
    Suppose:
    pythonPHRASE_SYNONYM_DICT = {"happy": ["joyful", "cheerful"]}
    MAX_SENTENCE_VARIANTS = 2
    sentences = ["I am happy", "Stay positive"]

    For "I am happy":

    Original: "I am happy" → added to out.
    Lowercase: "i am happy".
    Phrase "happy" found, synonyms are "joyful" and "cheerful".
    Variants: "I am joyful", "I am cheerful" → added to out.


    For "Stay positive":

    Original: "Stay positive" → added to out.
    No matching phrases in PHRASE_SYNONYM_DICT, so no variants added.


    If len(out) > 4 (i.e., 2 * MAX_SENTENCE_VARIANTS), the loop breaks (not reached here).
    Final output: ["I am happy", "I am joyful", "I am cheerful", "Stay positive"]."""
def _apply_phrase_synonyms(sentences: Iterable[str]) -> List[str]:
    print("inside _apply_phrase_synonyms...........")
    out = set()
    for sent in sentences:
        out.add(sent)
        lower = sent.lower()
        for phrase, syns in PHRASE_SYNONYM_DICT.items():
            if phrase in lower:
                for s in syns:
                    out.add(re.sub(phrase, s, sent, flags=re.IGNORECASE))
        if len(out) > MAX_SENTENCE_VARIANTS * 2:  # keep it bounded
            break
    return list(out)

def generate_synonyms(
    question: str,
    max_variants: int = 20,
    similarity_threshold: float = 0.90,
    use_semantic_filter: bool = False,
) -> List[str]:
    """
    Expand a natural language question into synonyms/paraphrases efficiently.

    - Bounded word-level expansion on content words.
    - Phrase-level substitutions.
    - (Optional) Semantic filtering via SBERT cosine similarity.
    """
    question = (question or "").strip()
    if not question:
        return []

    tokens = _tokenize(question)
    sentences = _bounded_expand(tokens)                         # fast bounded expansion
    sentences = _apply_phrase_synonyms(sentences)               # phrase-level expansion

    # add paraphrases from model (cached, per seed)
    seeds = sentences[:MAX_PARAPHRASE_SEEDS]
    for s in seeds:
        sentences.extend(_paraphrases_cached(s))

    # dedupe
    uniq = []
    seen = set()
    for s in sentences:
        k = s.strip()
        if not k:
            continue
        lk = k.lower()
        if lk not in seen:
            seen.add(lk)
            uniq.append(k)

    
    """This is important check, it ensures that the synonyms are very similar to the questions. 
       Even though the  word expansion is bounded it can still results in meaning less synonyms e.g a name "notification" can be turned into all kind of words"""
    if use_semantic_filter:
        semantic_model, _ = _load_models_once()
        base = semantic_model.encode([question], convert_to_numpy=True)
        embs = semantic_model.encode(uniq, convert_to_numpy=True, batch_size=64, show_progress_bar=False)
        sims = (embs @ base[0]) / (np.linalg.norm(embs, axis=1) * (np.linalg.norm(base[0]) + 1e-8))
        kept = [(s, float(sim)) for s, sim in zip(uniq, sims) if sim >= similarity_threshold]
        kept.sort(key=lambda x: x[1], reverse=True)
        uniq = [s for s, _ in kept]

    # final cap
    return uniq[:max_variants]

# ---------------------------------
# Parallel bulk generation (CPU-aware)
# ---------------------------------
def _init_worker_torch(num_threads: int = 1):
    # Prevent torch / MKL from oversubscribing across processes
    try:
        import torch
        torch.set_num_threads(max(1, int(num_threads)))
    except Exception:
        pass
    os.environ.setdefault("OMP_NUM_THREADS", str(num_threads))
    os.environ.setdefault("OPENBLAS_NUM_THREADS", str(num_threads))
    os.environ.setdefault("MKL_NUM_THREADS", str(num_threads))
    # Warm models in this worker
    _load_models_once()

def generate_synonyms_bulk(
    questions: Iterable[str],
    max_variants: int = 20,
    workers: Optional[int] = None,
    use_processes: bool = False,
    use_semantic_filter: bool = False,
) -> List[List[str]]:
    """
    Generate synonyms for many questions in parallel.

    - threads (default): shares model in one process; good when encode() uses native threads.
    - processes: one model per worker process; safer on CPU-heavy boxes. We cap torch threads per proc.
    """
    questions = list(questions)
    if not questions:
        return []

    workers = workers or os.cpu_count() or 4

    if use_processes:
        from concurrent.futures import ProcessPoolExecutor
        # Set per-process torch threads to avoid oversubscription (e.g., 1–2)
        per_proc_threads = max(1, math.floor(max(1, os.cpu_count() or 4) / workers))
        with ProcessPoolExecutor(
            max_workers=workers,
            initializer=_init_worker_torch,
            initargs=(per_proc_threads,)
        ) as ex:
            futs = [
                ex.submit(generate_synonyms, q, max_variants, 0.90, use_semantic_filter)
                for q in questions
            ]
            return [f.result() for f in futs]
    else:
        # Threads: keep single process, rely on torch/BLAS internal threads
        from concurrent.futures import ThreadPoolExecutor
        # Warm models once in main thread
        _load_models_once()
        with ThreadPoolExecutor(max_workers=workers) as ex:
            futs = [
                ex.submit(generate_synonyms, q, max_variants, 0.90, use_semantic_filter)  #similarity hard coded TBD
                for q in questions
            ]
            return [f.result() for f in futs]

# ---------------------------------
# CLI quick test
# ---------------------------------
if __name__ == "__main__":
    question = "Show me the number of employees?"
    out = generate_synonyms(question, max_variants=20, use_semantic_filter=False)
    print("Original:", question)
    for s in out:
        print("-", s)
