from flask import Flask, request, jsonify, Response, stream_with_context
from dotenv import load_dotenv
import os
import time
import diskcache
from sqlalchemy import create_engine, text

import json

import datetime

import decimal  # ✅ Handle Decimal types
import base64   # ✅ Encode BLOB previews safely

try:
    import oracledb  # python-oracledb (successor to cx_Oracle)
except Exception:
    oracledb = None


# Load .env credentials
load_dotenv()

app = Flask(__name__)

# Cache setup (30 min)
CACHE_EXPIRATION_SECONDS = 1800
cache = diskcache.Cache("./llm_cache")

# DB setup
db_uri = f"oracle+oracledb://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT', '1521')}/?service_name={os.getenv('DB_SERVICE')}"
print("db_uri====", db_uri)
      
engine = create_engine(db_uri)



# Utility
def is_safe_sql(sql: str) -> bool:
    return sql.strip().lower().startswith("select")

def log_query(intent, sql, user_agent, client_ip, model):
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    with open("query_log.txt", "a") as f:
        f.write(f"\n---\n[{ts}] IP: {client_ip}, UA: {user_agent}, Model: {model}\nIntent: {intent}\nSQL: {sql}\n")

# Predefined intent-to-SQL map
INTENT_SQL_MAP = {
    "list all employees": "SELECT * FROM user_tables",
    "list all sales": "SELECT * FROM sales",
    "top 5 sales by amount": "SELECT * FROM sales ORDER BY amount",
    "employee count": "SELECT COUNT(*) AS employee_count FROM employees",
    # Add more intents and safe queries here
}

def detect_intent(prompt: str) -> str:
    prompt_lower = prompt.lower()
    # Simple intent detection by checking if any intent phrase is contained in prompt
    for intent in INTENT_SQL_MAP.keys():
        if intent in prompt_lower:
            return intent
    return None

# ✅ Updated to handle Decimal, CLOB, and BLOB serialization
def serialize_row(row, columns, max_clob_preview=None, max_blob_preview=None):
    MAX_CLOB_PREVIEW = int(max_clob_preview if max_clob_preview is not None else os.getenv('MAX_CLOB_PREVIEW', '8192'))
    MAX_BLOB_PREVIEW = int(max_blob_preview if max_blob_preview is not None else os.getenv('MAX_BLOB_PREVIEW', '2048'))

    def serialize_value(val):
        # Null passthrough
        if val is None:
            return None

        # Date/time → ISO strings
        if isinstance(val, (datetime.date, datetime.datetime)):
            return val.isoformat()

        # Decimal → float (or use str(val) to preserve precision)
        if isinstance(val, decimal.Decimal):
            try:
                return float(val)
            except Exception:
                return str(val)

        # Oracle LOBs (CLOB/BLOB) via python-oracledb
        if oracledb is not None:
            try:
                if isinstance(val, getattr(oracledb, 'LOB', ())):
                    try:
                        data = val.read()
                    except Exception:
                        # Fallback to string repr if reading fails
                        return {"_type": "LOB", "repr": str(val)}

                    # CLOB returns str; BLOB returns bytes
                    if isinstance(data, str):
                        length = len(data)
                        if length > MAX_CLOB_PREVIEW:
                            return {
                                "_type": "CLOB",
                                "length": length,
                                "preview": data[:MAX_CLOB_PREVIEW],
                                "truncated": True,
                            }
                        return data
                    elif isinstance(data, (bytes, bytearray, memoryview)):
                        b = bytes(data)
                        length = len(b)
                        preview_len = min(length, MAX_BLOB_PREVIEW)
                        preview_b64 = base64.b64encode(b[:preview_len]).decode('ascii')
                        return {
                            "_type": "BLOB",
                            "length": length,
                            "preview_base64": preview_b64,
                            "preview_bytes": preview_len,
                            "truncated": length > preview_len,
                        }
            except Exception:
                # If LOB handling fails, fall through to generic handling
                pass

        # Generic bytes-like (BLOBs mapped directly)
        if isinstance(val, (bytes, bytearray, memoryview)):
            b = bytes(val)
            length = len(b)
            preview_len = min(length, MAX_BLOB_PREVIEW)
            preview_b64 = base64.b64encode(b[:preview_len]).decode('ascii')
            return {
                "_type": "BLOB",
                "length": length,
                "preview_base64": preview_b64,
                "preview_bytes": preview_len,
                "truncated": length > preview_len,
            }

        # Default: return as-is (JSON serializer will handle primitives)
        return val

    return {col: serialize_value(val) for col, val in zip(columns, row)}

@app.route("/query", methods=["POST"])
def query_db():
    data = request.get_json()
    prompt = data.get("prompt")
    model = data.get("model", "llama3.2:1b")  # model param kept for API compatibility, but not used here
    # Optional per-request LOB preview overrides
    try:
        req_max_clob = int(data.get('maxClobPreview') or data.get('max_clob_preview') or 0) or None
    except Exception:
        req_max_clob = None
    try:
        req_max_blob = int(data.get('maxBlobPreview') or data.get('max_blob_preview') or 0) or None
    except Exception:
        req_max_blob = None

    if not prompt:
        return jsonify({"error": "Missing prompt"}), 400

    # Session info
    user_agent = request.headers.get('User-Agent', 'unknown')
    client_ip = request.remote_addr or 'unknown'

    # Detect intent
    intent = detect_intent(prompt)
    if not intent:
        return jsonify({"error": "Sorry, I don't understand that query."}), 400

    sql = INTENT_SQL_MAP[intent]

    if not is_safe_sql(sql):
        return jsonify({"error": "Unsafe SQL detected."}), 403

    # # Cache check by intent + model
    # cache_key = f"{model}:{intent}"
    # cached = cache.get(cache_key)
    # if cached:
    #     return jsonify({"response": cached, "cached": True})

    try:


        def generate():
            with engine.connect() as conn:
                result = conn.execution_options(stream_results=True).execute(text(sql))
                columns = result.keys()
                for row in result:
                    row_dict = serialize_row(row, columns, max_clob_preview=req_max_clob, max_blob_preview=req_max_blob)
                    yield json.dumps(row_dict) + "\n"
                    


        # Cache the full SQL result as text (optional: cache partial or JSON)
        # To cache the streamed result fully, we need to collect it first (here simplified)
        # with engine.connect() as conn:
        #     res = conn.execute(text(sql))
        #     all_rows = [dict(zip(res.keys(), row)) for row in res]

        #cache.set(cache_key, all_rows, expire=CACHE_EXPIRATION_SECONDS)
        log_query(intent, sql, user_agent, client_ip, model)

        # Return streamed CSV response
        return Response(stream_with_context(generate()), mimetype='application/x-ndjson')

    except Exception as e:
        log_query(intent, str(e), user_agent, client_ip, model)
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

@app.route("/clear_cache", methods=["POST"])
def clear_cache():
    cache.clear()
    return jsonify({"message": "Cache cleared"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
