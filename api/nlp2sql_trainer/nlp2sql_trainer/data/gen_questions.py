from __future__ import annotations
from typing import Dict, List, Iterable, Tuple
import random, re
from nltk.corpus import wordnet as wn

def _syns(words: List[str], max_per_word: int = 5) -> Dict[str, List[str]]:
    out = {}
    for w in words:
        syns = set([w])
        for syn in wn.synsets(w):
            for lemma in syn.lemmas():
                s = lemma.name().replace("_", " ")
                if s.isalpha() or " " in s:
                    syns.add(s.lower())
                if len(syns) >= max_per_word:
                    break
            if len(syns) >= max_per_word:
                break
        out[w] = list(syns)[:max_per_word]
    return out

BASE_SYNONYMS = {
    "list": ["list", "show", "display", "return"],
    "find": ["find", "get", "retrieve", "fetch"],
    "count": ["count", "number of", "how many"],
    "average": ["average", "mean", "avg"],
    "total": ["total", "sum", "aggregate"],
    "maximum": ["maximum", "max", "highest"],
    "minimum": ["minimum", "min", "lowest"],
    "where": ["where", "with", "that have"],
}

def _expand_verbs(words: List[str], strategy: str = "wordnet", cap: int = 5) -> Dict[str, List[str]]:
    if strategy == "none":
        return {w: [w] for w in words}
    try:
        wn.ensure_loaded()
        wn_syns = _syns(words, max_per_word=cap)
        return {w: sorted(set(BASE_SYNONYMS.get(w, [w]) + wn_syns.get(w, [])))[:cap] for w in words}
    except LookupError:
        # NLTK WordNet not downloaded; fallback to static
        return {w: BASE_SYNONYMS.get(w, [w])[:cap] for w in words}

def generate_questions_from_schema(schema: dict, max_questions_per_table: int = 50, paraphrase_strategy: str = "wordnet", max_paraphrases: int = 5, seed: int = 42) -> Iterable[dict]:
    random.seed(seed)
    verb_alts = _expand_verbs(["list", "find", "count", "average", "total", "maximum", "minimum"], strategy=paraphrase_strategy, cap=max_paraphrases)

    for owner, sinfo in schema.get("schemas", {}).items():
        for tname, tinfo in sinfo.get("tables", {}).items():
            cols = [c["name"] for c in tinfo["columns"]]
            num_cols = [c["name"] for c in tinfo["columns"] if any((c["type"] or "").startswith(p) for p in ["NUMBER", "FLOAT", "BINARY_DOUBLE"])]
            # Simple templates
            templates = []

            # List all rows (with optional limit)
            templates.append({
                "sql": f"SELECT * FROM {owner}.{tname} FETCH FIRST 50 ROWS ONLY",
                "nl": f"{random.choice(verb_alts['list'])} the first 50 rows from {owner}.{tname}",
                "tags": ["simple", "limit"]
            })

            # Count rows
            templates.append({
                "sql": f"SELECT COUNT(*) AS cnt FROM {owner}.{tname}",
                "nl": f"{random.choice(verb_alts['count'])} records in {owner}.{tname}",
                "tags": ["aggregate", "count"]
            })

            # Max/min/avg on numeric columns
            for col in num_cols[:3]:
                templates.extend([
                    {
                        "sql": f"SELECT MAX({col}) AS max_{col} FROM {owner}.{tname}",
                        "nl": f"{random.choice(verb_alts['maximum'])} {col} in {owner}.{tname}",
                        "tags": ["aggregate", "max"]
                    },
                    {
                        "sql": f"SELECT MIN({col}) AS min_{col} FROM {owner}.{tname}",
                        "nl": f"{random.choice(verb_alts['minimum'])} {col} in {owner}.{tname}",
                        "tags": ["aggregate", "min"]
                    },
                    {
                        "sql": f"SELECT AVG({col}) AS avg_{col} FROM {owner}.{tname}",
                        "nl": f"{random.choice(verb_alts['average'])} {col} in {owner}.{tname}",
                        "tags": ["aggregate", "avg"]
                    }
                ])

            # Group by first categorical column with numeric agg
            cat_cols = [c for c in cols if c not in num_cols]
            if cat_cols and num_cols:
                cat = cat_cols[0]
                num = num_cols[0]
                templates.append({
                    "sql": f"SELECT {cat}, AVG({num}) AS avg_{num} FROM {owner}.{tname} GROUP BY {cat} ORDER BY avg_{num} DESC FETCH FIRST 10 ROWS ONLY",
                    "nl": f"{random.choice(verb_alts['list'])} top 10 {owner}.{tname} {cat} by average {num}",
                    "tags": ["groupby", "avg", "topn"]
                })

            # Where clause using sample values if available
            sample_candidates = []
            for row in tinfo.get("samples", []):
                for c in cols:
                    val = row.get(c)
                    if isinstance(val, (str, int, float)) and val not in (None, ""):
                        sample_candidates.append((c, val))
            sample_candidates = sample_candidates[:10]
            for c, v in sample_candidates[:3]:
                v_str = f"'{v}'" if isinstance(v, str) else str(v)
                templates.append({
                    "sql": f"SELECT * FROM {owner}.{tname} WHERE {c} = {v_str} FETCH FIRST 50 ROWS ONLY",
                    "nl": f"{random.choice(verb_alts['find'])} rows in {owner}.{tname} where {c} equals {v}",
                    "tags": ["filter", "equals"]
                })

            # Trim to max
            random.shuffle(templates)
            templates = templates[:max_questions_per_table]

            for temp in templates:
                # Paraphrases: vary verbs and minor wording
                paraphrases = []
                base = temp["nl"]
                for _ in range(max_paraphrases-1):
                    p = base
                    # Substitute common verbs with synonyms
                    for key, alts in verb_alts.items():
                        for a in alts:
                            if re.search(rf"\\b{key}\\b", p, flags=re.I):
                                p = re.sub(rf"\\b{key}\\b", random.choice(alts), p, flags=re.I)
                                break
                    paraphrases.append(p)

                yield {
                    "schema": owner,
                    "table": tname,
                    "question": temp["nl"],
                    "paraphrases": list(dict.fromkeys(paraphrases))[:max_paraphrases],
                    "sql": temp["sql"],
                    "tags": temp.get("tags", [])
                }
