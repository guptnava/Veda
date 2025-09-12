from __future__ import annotations
from typing import Dict, Any, List
import pandas as pd
from ..connectors.oracle_schema import connect

def try_execute(cfg: dict, sql: str, max_rows: int = 10) -> Dict[str, Any]:
    try:
        conn = connect(cfg)
        cur = conn.cursor()
        cur.execute(sql)
        cols = [d[0] for d in cur.description] if cur.description else []
        rows = cur.fetchmany(numRows=max_rows) if cols else []
        return {"ok": True, "columns": cols, "rows": [list(r) for r in rows], "error": None}
    except Exception as e:
        return {"ok": False, "columns": [], "rows": [], "error": str(e)}
    finally:
        try:
            cur.close()
            conn.close()
        except Exception:
            pass
