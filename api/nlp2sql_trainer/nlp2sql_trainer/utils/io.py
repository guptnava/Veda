from __future__ import annotations
import json, os, gzip, io
from typing import Iterable, Dict, Any, List
import pandas as pd
from pathlib import Path

def read_json(path: str | os.PathLike) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


import os
import json
import oracledb
from collections.abc import Mapping, Iterable

import os
import json
import oracledb
from collections.abc import Mapping, Iterable
from datetime import datetime, date

def write_json(obj: dict, path: str | os.PathLike):
    """Write a JSON file safely, converting LOBs, bytes, and datetime to strings."""

    def convert_for_json(o):
        # LOB -> string
        if isinstance(o, oracledb.LOB):
            return o.read()
        # bytes -> utf-8 string, fallback to repr if decode fails
        elif isinstance(o, bytes):
            try:
                return o.decode("utf-8")
            except Exception:
                return repr(o)
        # datetime/date -> ISO format string
        elif isinstance(o, (datetime, date)):
            return o.isoformat()
        # Recursively convert dicts
        elif isinstance(o, Mapping):
            return {k: convert_for_json(v) for k, v in o.items()}
        # Recursively convert lists/tuples/sets
        elif isinstance(o, Iterable) and not isinstance(o, (str, int, float, bool, type(None))):
            return [convert_for_json(v) for v in o]
        else:
            return o

    safe_obj = convert_for_json(obj)

    folder = os.path.dirname(path)
    if folder:
        os.makedirs(folder, exist_ok=True)

    with open(path, "w", encoding="utf-8") as f:
        json.dump






def read_jsonl(path: str | os.PathLike) -> Iterable[dict]:
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        for line in f:
            if line.strip():
                yield json.loads(line)


    
def write_jsonl(rows: Iterable[dict], path: str | os.PathLike):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    opener = gzip.open if str(path).endswith(".gz") else open
    mode = "wt" if opener is gzip.open else "w"
    with opener(path, mode, encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

def write_parquet(df: pd.DataFrame, path: str | os.PathLike):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_parquet(path, index=False)

def read_parquet(path: str | os.PathLike) -> pd.DataFrame:
    return pd.read_parquet(path)

def ensure_dir(path: str | os.PathLike):
    Path(path).mkdir(parents=True, exist_ok=True)
