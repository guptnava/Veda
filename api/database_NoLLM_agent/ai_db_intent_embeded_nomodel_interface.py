"""
app_oracle_ndjson_named_params.py

Flask service:
- Matches SQL templates in Oracle using embeddings
- Allows user queries to provide parameters in {param=value} format
- Automatically maps parameters to SQL placeholders
- Streams results in x-ndjson format

Requirements:
pip install flask sentence-transformers numpy oracledb scipy
Set Oracle environment variables:
export ORACLE_USER=...
export ORACLE_PASS=...
export ORACLE_DSN=host:port/service_name
"""

import os
import json
import re
import numpy as np
from flask import Flask, request, Response, jsonify
# Removed urllib; HTTP calls are currently disabled/commented
from sentence_transformers import SentenceTransformer
import oracledb
from scipy.spatial import KDTree
import datetime


###############################################################################
# 0) Config
###############################################################################

ORACLE_USER = os.environ.get("DB_USER", "user")
ORACLE_PASS = os.environ.get("DB_PASSWORD", "pass")
ORACLE_HOST  = os.environ.get("DB_HOST", "localhost")
ORACLE_PORT = os.environ.get("DB_PORT", "1521")
ORACLE_SERVICE  = os.environ.get("DB_SERVICE", "orcl")

EMBEDDER_MODEL = os.environ.get("LOCAL_EMBED_MODEL", "/Users/naveengupta/veda-chatbot/api/local_all-MiniLM-L6-v2")
SIMILARITY_THRESHOLD = 0.52
DEFAULT_LIMIT = 10
SEARCH_K = 20  # Number of neighbors to retrieve from KD-Tree for similarity check

# Global variables for the index and data
kdtree_index = None
templates_data = []


###############################################################################
# 1) Oracle connection
###############################################################################

pool = oracledb.create_pool(
    user=ORACLE_USER,
    password=ORACLE_PASS,
    dsn=f"{ORACLE_HOST}:{ORACLE_PORT}/?service_name={ORACLE_SERVICE}",
    min=1,
    max=5,
    increment=1
)

def get_conn():
    return pool.acquire()

#def get_conn():
 #   return oracledb.connect(user=ORACLE_USER, password=ORACLE_PASS, dsn=f"{ORACLE_HOST}:{ORACLE_PORT}/?service_name={ORACLE_SERVICE}")

###############################################################################
# Load Templates + Embeddings
###############################################################################
print("Loading embedder...")
EMBEDDER = SentenceTransformer(EMBEDDER_MODEL)

def load_templates_from_db():
    """
    Loads all query templates and their embeddings from the Oracle database.
    """
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT a.id, a.training_id name, a.question intent_text, b.sql_template, a.embedding FROM nl2sql_embeddings a , nl2sql_training b where b.id=a.training_id")
    templates = []
    for row in cur:
        id_, name, intent_text, sql_template, embedding_blob = row

        # Convert CLOB -> str, handling potential LOB objects for intent_text
        if isinstance(intent_text, oracledb.LOB):
            intent_text_str = intent_text.read()
        elif isinstance(intent_text, str):
            intent_text_str = intent_text
        else:
            intent_text_str = ""

        # Convert CLOB -> str, handling potential LOB objects for sql_template
        sql_text = ""
        if isinstance(sql_template, oracledb.LOB):
            sql_text = sql_template.read()
        elif isinstance(sql_template, str):
            sql_text = sql_template
        
        # Convert BLOB -> numpy array, handling potential LOB objects
        emb = None
        if isinstance(embedding_blob, oracledb.LOB):
            emb_bytes = embedding_blob.read()
            emb = np.frombuffer(emb_bytes, dtype=np.float32)

        templates.append({
            "id": id_,
            "name": name,
            "intent_text": intent_text_str,
            "sql": sql_text,
            "embedding": emb
        })
    cur.close()
    conn.close()
    return templates

def retrieve_best_template(query: str):
    """
    Searches for the best matching template using the KD-Tree index.
    """
    global kdtree_index
    global templates_data

    if kdtree_index is None or not templates_data:
        raise RuntimeError("Index has not been built. Please call /build_index first.")

    # Encode the user query
    q_emb = EMBEDDER.encode([query], normalize_embeddings=True)[0]

    # Use the KD-Tree to find the top K nearest neighbors by Euclidean distance
    distances, indices = kdtree_index.query(q_emb, k=SEARCH_K)

    # KD-Tree returns Euclidean distance. We need cosine similarity
    # Formula for L2-normalized vectors: cos_sim = 1 - (dist^2 / 2)
    # This is a bit of a hack, but ensures consistency with the threshold.
    # A more robust solution might be to re-calculate dot product on top K.
    similarities = 1 - (distances**2 / 2)

    # Combine global indices and similarities for sorting
    ranked_results = sorted(list(zip(indices, similarities)), key=lambda x: x[1], reverse=True)

    # The best result is the first one in the sorted list
    best_match_global_index, best_sim = ranked_results[0]
    
    # Get the best template object from the global data list using the correct index
    best_template = templates_data[best_match_global_index]
    
    # Return the full ranked list for the fallback message
    ranked = ranked_results
    
    return best_template, best_sim, ranked


###############################################################################
# Named Parameter Extraction
###############################################################################
def extract_named_parameters(user_query: str) -> dict:
    """
    Extract parameters in the format {param=value} from user query.
    Returns a dict of param_name -> value
    """
    params = {}
    matches = re.findall(r"\{(.*?)=(.*?)\}", user_query)
    for name, value in matches:
        name = name.strip()
        value = value.strip()
        # Convert numeric if possible
        if value.isdigit():
            value = int(value)
        else:
            try:
                value = float(value)
            except ValueError:
                pass
        params[name] = value
    return params

def inject_named_parameters(sql_template: str, param_dict: dict) -> str:
    """
    Replace {param_name} in SQL template with :param_name bind variables.
    Case-insensitive for parameter names.
    """
    new_sql = sql_template

    # Build lowercase dict for matching
    lower_param_dict = {k.lower(): v for k, v in param_dict.items()}

    # Find all placeholders like {param}
    placeholders = re.findall(r"\{(.*?)\}", sql_template)

    for ph in placeholders:
        key = ph.lower()
        if key not in lower_param_dict:
            raise ValueError(f"Missing value for parameter: {ph} SQL:{new_sql}")
        # Replace exactly as it appears in the template with the bind variable
        new_sql = new_sql.replace(f"{{{ph}}}", f":{key}")

    return new_sql, lower_param_dict

def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, (datetime.datetime, datetime.date)):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

###############################################################################
# Flask App
###############################################################################
app = Flask(__name__)

@app.route("/build_index", methods=["POST"])
def build_index():
    """
    Endpoint to build or rebuild the KD-Tree index from Oracle embeddings.
    """
    global kdtree_index
    global templates_data

    try:
        # Step 1: Load all templates and embeddings from the database
        templates_data = load_templates_from_db()

        # Step 2: Extract just the embedding vectors into a NumPy array
        # Note: We filter out any templates that might have a missing embedding
        embedding_vectors = np.array([t["embedding"] for t in templates_data if t["embedding"] is not None])

        if len(embedding_vectors) == 0:
            return jsonify({"Success": False, "error": "No valid embeddings found to build the index."})
        
        # Step 3: Build the KD-Tree index
        print("Building KD-Tree index...")
        kdtree_index = KDTree(embedding_vectors)
        print("KD-Tree index built successfully.")

        return jsonify({"Success": True, "Message": "Index successfully built"})
    
    except Exception as e:
        print(f"Error building index: {e}")
        return jsonify({"Success": False, "error": f"Failed to build index: {str(e)}"})
    

import re

_BIND_RE = re.compile(r"(?<!:):([A-Za-z_][A-Za-z0-9_$#]*)")

def _strip_comments_and_strings(sql: str) -> str:
    # Remove block comments
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    # Remove line comments
    sql = re.sub(r"--.*?$", "", sql, flags=re.MULTILINE)
    # Remove Oracle q-quoted strings: q'<delim> ... <delim>'
    # Example: q'[hello:world]' or q'~text:here~'
    sql = re.sub(r"q'(.).*?\1'", "''", sql, flags=re.IGNORECASE | re.DOTALL)
    # Remove normal single-quoted strings (handles escaped single quotes '')
    sql = re.sub(r"'(?:''|[^'])*'", "''", sql)
    return sql

def extract_bind_names_from_sql(sql: str) -> set:
    """
    Return a set of named bind identifiers (without the leading colon) present
    in the SQL, ignoring comments and string literals. Positional binds (:1) are ignored.
    """
    cleaned = _strip_comments_and_strings(sql)
    names = set()
    for m in _BIND_RE.finditer(cleaned):
        name = m.group(1)
        # skip positional binds like :1, :2 (already excluded by regex) but keep here defensively
        if not name[0].isdigit():
            names.add(name)
    return names

def filter_bind_params(sql: str, params: dict) -> dict:
    """
    Keep only params whose (colonless) key appears as a named bind in the SQL.
    Also normalizes keys by stripping a leading ':' if present.
    """
    if not params:
        return {}
    normalized = { (k[1:] if isinstance(k, str) and k.startswith(":") else k): v
                   for k, v in params.items() }
    needed = extract_bind_names_from_sql(sql)
    return { k: v for k, v in normalized.items() if k in needed }

def find_missing_binds(sql: str, params: dict) -> set:
    """
    Return bind names that exist in SQL but are not provided in params.
    """
    needed = extract_bind_names_from_sql(sql)
    normalized_keys = { (k[1:] if isinstance(k, str) and k.startswith(":") else k)
                        for k in (params or {}).keys() }
    return needed - normalized_keys


@app.route("/query", methods=["POST"])
def query():
    user_query = request.json.get("prompt", "").strip()
    # Optional flags from client
    send_sql_to_llm = bool(request.json.get("sendSqlToLlm") or request.json.get("send_sql_to_llm"))
    # Prefer "model" but accept legacy "model_name"
    model_name = request.json.get("model") or request.json.get("model_name") or "llama3.2:1b"
    # Optional LLM generation controls
    def _to_float(x):
        try:
            return float(x)
        except Exception:
            return None
    def _to_int(x):
        try:
            return int(x)
        except Exception:
            try:
                f = float(x)
                return int(f)
            except Exception:
                return None
    temperature = _to_float(request.json.get("temperature"))
    top_k = _to_int(request.json.get("topK") or request.json.get("top_k"))
    top_p = _to_float(request.json.get("topP") or request.json.get("top_p"))
    if not user_query:
        return Response(json.dumps({"matched": False, "error": "missing query"}) + "\n",
                        mimetype="application/x-ndjson")

    try:
        template, sim, ranked = retrieve_best_template(user_query)
    except RuntimeError as e:
        return Response(json.dumps({"matched": False, "error": str(e)}) + "\n",
                        mimetype="application/x-ndjson")
    
    print("sim====", sim)
    
    # Fallback message - user can use it like help or ?
    # Use client threshold when provided; otherwise default SIMILARITY_THRESHOLD
    client_thresh = request.json.get("cosineSimilarityThreshold")
    thresh = client_thresh if isinstance(client_thresh, (int, float)) else SIMILARITY_THRESHOLD
    if sim < thresh:
     
        print("cosineSimilarityThreshold===",request.json.get("cosineSimilarityThreshold"))
        print("SIMILARITY_THRESHOLD===", SIMILARITY_THRESHOLD)

        def fallback():

            # learn that the prompt is a mis so it can be supported
            with get_conn() as conn:   # conn will be closed automatically
                with conn.cursor() as cur:
                    cur.execute("insert into NL2SQL_FALLBACK(prompt) values(:user_query)", {"user_query": user_query})
                    conn.commit()
            # Get the top 3 suggestions from the already ranked list
            for idx, sim_score in ranked:
                template = templates_data[idx]
                template_sql = template["sql"]
                # Extract expected parameters from template
                placeholders = re.findall(r"\{(.*?)\}", template_sql)
                yield json.dumps({
                    "suggestion": template["intent_text"],
                    "parameters": placeholders,  # just the names, not values,
                    "Similarity": sim_score,
                    "Similarity found": sim
                }) + "\n"
        
        return Response(fallback(), mimetype="application/x-ndjson")

    try:
        param_dict = extract_named_parameters(user_query)
        new_sql, param_dict = inject_named_parameters(template["sql"], param_dict)

        # NEW: validate/filter params to avoid DPY-4008
        missing = find_missing_binds(new_sql, param_dict)
        if missing:
            # If you prefer to allow missing and let DB error, you can skip this block.
            return Response(json.dumps({
                "matched": False,
                "error": f"Missing values for bind(s): {sorted(missing)}"
            }) + "\n", mimetype="application/x-ndjson")

        bind_params = filter_bind_params(new_sql, param_dict)
        print("new_Sql========", new_sql)
    except ValueError as e:
        return Response(json.dumps({"matched": False, "error": str(e)}) + "\n",
                        mimetype="application/x-ndjson")

    def generate():
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(new_sql, bind_params)
        cols = [d[0] for d in cur.description]

        def to_jsonable(v):
            try:
                if isinstance(v, oracledb.LOB):
                    data = v.read()
                    # CLOB returns str; BLOB returns bytes. Avoid huge payloads for BLOBs.
                    if isinstance(data, bytes):
                        return f"(BLOB {len(data)} bytes)"
                    return data
                return v
            except Exception:
                # Fallback to string representation if anything goes wrong
                return str(v)

        for row in cur:
            row_obj = { c: to_jsonable(v) for c, v in zip(cols, row) }
            yield json.dumps(row_obj, default=json_serial) + "\n"
        cur.close()
        conn.close()


    def stream_query():
        """
        Stream rows to the client as NDJSON. If narration is enabled, also
        aggregate lightweight stats on the fly and send a final line with
        {"_narration": "..."} after all rows are streamed.
        Designed to be memory-safe for large result sets.
        """
        # Lazy import to avoid hard dependency if narration is off
        def call_llm(model: str, prompt: str) -> str:
            """Generate narration via Ollama. Tries python package, otherwise HTTP API.
            Returns the generated text or raises Exception.
            """
            # Try python package first
            try:
                import ollama  # type: ignore
                options = {}
                if temperature is not None: options["temperature"] = temperature
                if top_k is not None: options["top_k"] = top_k
                if top_p is not None: options["top_p"] = top_p
                resp = ollama.chat(model=model, messages=[{"role": "user", "content": prompt}], options=options or None)
                return (resp.get("message", {}) or {}).get("content", "")
            except Exception as e:
                #pass
                raise e
            
            # # Fallback: HTTP call to Ollama API
            # try:
            #     base = os.environ.get("OLLAMA_API_URL", "http://localhost:11434")
            #     url = base.rstrip("/") + "/api/generate"
            #     options = {}
            #     if temperature is not None: options["temperature"] = temperature
            #     if top_k is not None: options["top_k"] = top_k
            #     if top_p is not None: options["top_p"] = top_p
            #     payload = json.dumps({
            #         "model": model,
            #         "prompt": prompt,
            #         "stream": False,
            #         "options": options
            #     }).encode("utf-8")
            #     req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
            #     with urllib.request.urlopen(req, timeout=120) as resp:
            #         data = resp.read().decode("utf-8")
            #         # non-stream returns full JSON with "response"
            #         try:
            #             obj = json.loads(data)
            #             return obj.get("response", "")
            #         except Exception:
            #             # Some servers stream lines even when stream=false; try to parse last line
            #             lines = [l for l in data.splitlines() if l.strip()]
            #             if lines:
            #                 try:
            #                     obj = json.loads(lines[-1])
            #                     return obj.get("response", "")
            #                 except Exception:
            #                     return data
            #     # unreachable
            # except Exception as e:
            #     raise e

        with get_conn() as conn:   # conn will be closed automatically
            with conn.cursor() as cur:
                cur.execute(new_sql, bind_params)
                cols = [d[0] for d in cur.description]

                def to_jsonable(v):
                    try:
                        if isinstance(v, oracledb.LOB):
                            data = v.read()
                            if isinstance(data, bytes):
                                return f"(BLOB {len(data)} bytes)"
                            return data
                        return v
                    except Exception:
                        return str(v)

                # Stats accumulators
                row_count = 0
                num_stats = {c: {"count": 0, "sum": 0.0, "min": None, "max": None} for c in cols}
                cat_counts = {c: {} for c in cols}  # value -> count (capped)
                CAT_CAP = 200  # cap per-column unique tracking

                def try_float(v):
                    try:
                        if v is None or v == "":
                            return None
                        x = float(v)
                        if np.isfinite(x):
                            return x
                        return None
                    except Exception:
                        return None

                for row in cur:
                    row_count += 1
                    row_obj = { c: to_jsonable(v) for c, v in zip(cols, row) }
                    # Stream the row to client immediately
                    yield json.dumps(row_obj, default=json_serial) + "\n"

                    # Update stats (cheap ops)
                    for c in cols:
                        v = row_obj.get(c)
                        # numeric path
                        nv = try_float(v)
                        if nv is not None:
                            s = num_stats[c]
                            s["count"] += 1
                            s["sum"] += nv
                            s["min"] = nv if s["min"] is None else min(s["min"], nv)
                            s["max"] = nv if s["max"] is None else max(s["max"], nv)
                        # categorical/top-values (limit memory)
                        if v is not None and v != "":
                            d = cat_counts[c]
                            # keep the map bounded by pruning smallest counts occasionally
                            if len(d) >= CAT_CAP and v not in d:
                                # prune ~10% least frequent keys
                                try:
                                    # build a list of (key,count), sort by count asc, drop first N
                                    items = sorted(d.items(), key=lambda x: x[1])
                                    drop_n = max(1, CAT_CAP // 10)
                                    for k, _ in items[:drop_n]:
                                        d.pop(k, None)
                                except Exception:
                                    pass
                            d[v] = d.get(v, 0) + 1

                print("sqltollm=====", send_sql_to_llm)
                # After streaming rows, optionally generate narration
                if send_sql_to_llm:
                    try:
                        # Build compact summary for LLM
                        num_summary = []
                        for c, s in num_stats.items():
                            if s["count"] > 0:
                                avg = s["sum"] / max(1, s["count"])
                                num_summary.append({
                                    "column": c,
                                    "count": s["count"],
                                    "min": s["min"],
                                    "max": s["max"],
                                    "avg": avg,
                                })
                        cat_summary = []
                        for c, d in cat_counts.items():
                            if d:
                                top = sorted(d.items(), key=lambda x: x[1], reverse=True)[:5]
                                cat_summary.append({
                                    "column": c,
                                    "top_values": [{"value": str(k), "count": v} for k, v in top],
                                    "tracked_unique": len(d),
                                })

                        analysis = {
                            "rows": row_count,
                            "numeric": num_summary,
                            "categorical": cat_summary,
                            "sql": new_sql,
                            "params": bind_params,
                            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                        }

                        prompt = (
                            "You are a data analyst. Given the summarized profiling of an SQL result set, "
                            "write a concise narration of key insights. Identify trends, outliers, top categories, "
                            "and any notable relationships. Do not invent columns that are not present. "
                            "Use the statistics only; avoid referencing individual rows. Keep it under 140 words.\n\n"
                            f"User query: {user_query}\n"
                            f"SQL (bound parameters applied):\n{new_sql}\n"
                            f"Parameters: {json.dumps(param_dict, default=str)}\n\n"
                            f"Profile (JSON):\n{json.dumps(analysis, default=str)}\n\n"
                            "Narration:"
                        )

                        narration = call_llm(model_name, prompt)
                        if narration:
                            yield json.dumps({"_narration": narration}) + "\n"
                    except Exception as e:
                        # Non-fatal; just log and continue
                        try:
                            yield json.dumps({"_narration": f"(Failed to generate narration: {str(e)})"}) + "\n"
                        except Exception:
                            pass


    #return Response(generate(), mimetype="application/x-ndjson")
    return Response(stream_query(), mimetype="application/x-ndjson")

###############################################################################
# Run App
###############################################################################
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
