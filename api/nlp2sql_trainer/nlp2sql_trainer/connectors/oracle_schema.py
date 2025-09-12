# connectors/oracle_schema.py
import oracledb

def connect(cfg):
    return oracledb.connect(
        user=cfg["user"], 
        password=cfg["password"], 
        dsn=cfg["dsn"]
    )

def fetch_schema(conn, include_schemas=None, exclude_tables=None):
    include_schemas = include_schemas or []
    exclude_tables = exclude_tables or []
    cursor = conn.cursor()
    schemas = {}
    for schema in include_schemas:
        cursor.execute(f"""
            SELECT table_name, column_name, data_type
            FROM all_tab_columns
            WHERE owner='{schema}'
        """)
        tables = {}
        for row in cursor.fetchall():
            t_name, c_name, c_type = row
            if t_name not in tables:
                tables[t_name] = {"columns": []}
            if c_type not in ("CLOB", "BLOB"):  # Skip large objects
                tables[t_name]["columns"].append({"name": c_name, "type": c_type})
        schemas[schema] = {"tables": tables}
    return {"schemas": schemas}
