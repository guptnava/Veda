import os
import json
import requests
import pandas as pd
import importlib

matplotlib = None
plt = None
try:
    matplotlib_spec = importlib.util.find_spec('matplotlib')
except Exception:
    matplotlib_spec = None
if matplotlib_spec is not None:
    try:
        matplotlib = importlib.import_module('matplotlib')
        matplotlib.use('Agg')
        plt = importlib.import_module('matplotlib.pyplot')
    except Exception:
        matplotlib = None
        plt = None

API_BASE_URL = os.getenv("VEDA_API_BASE", "http://localhost:3000")
API_TOKEN = os.getenv("VEDA_API_TOKEN")

_session = requests.Session()
if API_TOKEN:
    _session.headers.update({"Authorization": f"Bearer {API_TOKEN}"})

# Dataset: view_90_kcpn | rows=216
query_payload = json.loads('''{
  "model": "llama3.2:1b",
  "mode": "database",
  "prompt": "list all employees",
  "page": 1,
  "pageSize": 10,
  "tableOpsMode": "flask",
  "pushDownDb": false,
  "baseSql": "SELECT * FROM user_tables",
  "columnTypes": {
    "activity_tracking": "string",
    "avg_row_len": "number",
    "avg_space": "number",
    "avg_space_freelist_blocks": "number",
    "backed_up": "string",
    "blocks": "number",
    "buffer_pool": "string",
    "cache": "string",
    "cell_flash_cache": "string",
    "chain_cnt": "number",
    "cluster_name": "string",
    "cluster_owner": "string",
    "clustering": "string",
    "compress_for": "string",
    "compression": "string",
    "container_data": "string",
    "degree": "string",
    "dependencies": "string",
    "dml_timestamp": "string",
    "dropped": "string",
    "duration": "string",
    "empty_blocks": "number",
    "flash_cache": "string",
    "freelist_groups": "string",
    "freelists": "string",
    "global_stats": "string",
    "has_identity": "string",
    "ini_trans": "number",
    "initial_extent": "string",
    "inmemory": "string",
    "inmemory_compression": "string",
    "inmemory_distribute": "string",
    "inmemory_duplicate": "string",
    "inmemory_priority": "string",
    "instances": "string",
    "iot_name": "string",
    "iot_type": "string",
    "last_analyzed": "date",
    "logging": "string",
    "max_extents": "string",
    "max_trans": "number",
    "min_extents": "string",
    "monitoring": "string",
    "nested": "string",
    "next_extent": "string",
    "num_freelist_blocks": "number",
    "num_rows": "number",
    "partitioned": "string",
    "pct_free": "number",
    "pct_increase": "string",
    "pct_used": "string",
    "read_only": "string",
    "result_cache": "string",
    "row_movement": "string",
    "sample_size": "number",
    "secondary": "string",
    "segment_created": "string",
    "skip_corrupt": "string",
    "status": "string",
    "table_lock": "string",
    "table_name": "string",
    "tablespace_name": "string",
    "temporary": "string",
    "user_stats": "string"
  },
  "searchColumns": [
    "table_name",
    "tablespace_name",
    "cluster_name",
    "iot_name",
    "status",
    "pct_free",
    "pct_used",
    "ini_trans",
    "max_trans",
    "initial_extent",
    "next_extent",
    "min_extents",
    "max_extents",
    "pct_increase",
    "freelists",
    "freelist_groups",
    "logging",
    "backed_up",
    "num_rows",
    "blocks",
    "empty_blocks",
    "avg_space",
    "chain_cnt",
    "avg_row_len",
    "avg_space_freelist_blocks",
    "num_freelist_blocks",
    "degree",
    "instances",
    "cache",
    "table_lock",
    "sample_size",
    "last_analyzed",
    "partitioned",
    "iot_type",
    "temporary",
    "secondary",
    "nested",
    "buffer_pool",
    "flash_cache",
    "cell_flash_cache",
    "row_movement",
    "global_stats",
    "user_stats",
    "duration",
    "skip_corrupt",
    "monitoring",
    "cluster_owner",
    "dependencies",
    "compression",
    "compress_for",
    "dropped",
    "read_only",
    "segment_created",
    "result_cache",
    "clustering",
    "activity_tracking",
    "dml_timestamp",
    "has_identity",
    "container_data",
    "inmemory",
    "inmemory_priority",
    "inmemory_distribute",
    "inmemory_compression",
    "inmemory_duplicate"
  ]
}''')
query_payload['all'] = True
response = _session.post(f"{API_BASE_URL}/api/table/query", json=query_payload, timeout=180)
response.raise_for_status()
result = response.json()

rows = result.get("rows") or result.get("data") or []
columns = result.get("columns")
if not columns:
    table = result.get("table") or {}
    columns = table.get("columns") or table.get("headers")
if columns and rows and isinstance(rows[0], (list, tuple)):
    records = [dict(zip(columns, row)) for row in rows]
else:
    records = rows

view_90_kcpn = pd.DataFrame(records)
# publish(view_90_kcpn, "view_90_kcpn")  # Uncomment to preview in notebook
if plt is not None:
    try:
        numeric_cols = [col for col in view_90_kcpn.select_dtypes(include=['number']).columns]
        if numeric_cols:
            preview = view_90_kcpn.head(10)
            fig, ax = plt.subplots(figsize=(8, 4))
            preview[numeric_cols].plot(kind='bar', ax=ax)
            ax.set_title('view_90_kcpn (first 10 rows)')
            ax.set_xlabel('Row Index')
            ax.set_ylabel('Value')
            fig.tight_layout()
    except Exception:
        pass
view_90_kcpn