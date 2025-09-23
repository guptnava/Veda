"""
Lightweight Flask service to push table operations (filter/sort/paginate/distinct)
downstream from Node, centralize caching here, and optionally push to DB in future.

Run: uvicorn or flask
  FLASK_APP=api/table_ops_service/app.py flask run -p 5015

It proxies to existing Flask agents based on `mode` and reuses their NDJSON output
to build pages and distinct values. This avoids materializing full results in Node
and shares cache across Node instances.
"""
from flask import Flask, request, jsonify
from functools import lru_cache
import time
import json
import os
import requests
import oracledb
from dotenv import load_dotenv

app = Flask(__name__)

# Load .env from api/.env if present
try:
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))
except Exception:
    try:
        load_dotenv()
    except Exception:
        pass

HOST = os.environ.get('HOSTNAME', 'localhost')
FLASK_DATABASE_INTENT_URL = f"http://{HOST}:5012"
FLASK_DATABASE_LANGCHAIN_URL = f"http://{HOST}:5013"
FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL = f"http://{HOST}:5014"
FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL = f"http://{HOST}:5003"
FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL = f"http://{HOST}:5004"
FLASK_RESTFUL_PROMPT_ENG_EMBD_URL = f"http://{HOST}:5006"
FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL = f"http://{HOST}:5009"
FLASK_DATABASE_GENERIC_RAG_URL = f"http://{HOST}:5010"
FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL = f"http://{HOST}:5011"


def stable_stringify(obj):
    if obj is None or not isinstance(obj, (dict, list)):
        return json.dumps(obj, sort_keys=True, separators=(',', ':'))
    if isinstance(obj, list):
        return '[' + ','.join(stable_stringify(x) for x in obj) + ']'
    items = sorted((k, obj[k]) for k in obj.keys())
    return '{' + ','.join(json.dumps(k) + ':' + stable_stringify(v) for k, v in items) + '}'


def mode_to_endpoint(mode: str) -> str:
    if mode == 'database':
        return f"{FLASK_DATABASE_INTENT_URL}/query"
    if mode == 'langchain':
        return f"{FLASK_DATABASE_LANGCHAIN_URL}/query"
    if mode == 'langchainprompt':
        return f"{FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_URL}/query"
    if mode == 'restful':
        return f"{FLASK_RESTFUL_PROMPT_ENG_EMBD_URL}/query"
    if mode == 'embedded':
        return f"{FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_URL}/query"
    if mode == 'llamaindex':
        return f"{FLASK_DATABASE_LLAMAINDEX_PROMPT_ENG_URL}/query"
    if mode == 'embedded_narrated':
        return f"{FLASK_DATABASE_LANGCHAIN_PROMPT_ENG_EMBD_NARRATED_URL}/query"
    if mode == 'generic_rag':
        return f"{FLASK_DATABASE_GENERIC_RAG_URL}/query"
    if mode == 'database1':
        return f"{FLASK_DATABASE_INTENT_EMBDED_NOMODEL_URL}/query"
    return ''


# Simple in-process cache with TTL
_cache = {}
CACHE_TTL = 30 * 60  # 30 minutes


def get_cache(key):
    ent = _cache.get(key)
    if not ent:
        return None
    if ent['expires'] < time.time():
        _cache.pop(key, None)
        return None
    return ent['data']


def set_cache(key, data):
    _cache[key] = { 'data': data, 'expires': time.time() + CACHE_TTL }


def matches_col_filter(row, col, f):
    if not f or not f.get('op'):
        return True
    raw = row.get(col)
    val = '' if raw is None else raw
    op = f['op']
    v1 = f.get('value')
    v2 = f.get('value2')
    num_ops = ['=', '!=', '>', '>=', '<', '<=', 'between']
    if op in num_ops:
        try:
            n = float(val)
        except Exception:
            return False
        def to_num(x):
            try:
                return float(x)
            except Exception:
                return float('nan')
        a = to_num(v1)
        b = to_num(v2)
        if op == '=':
            return n == a
        if op == '!=':
            return n != a
        if op == '>':
            return n > a
        if op == '>=':
            return n >= a
        if op == '<':
            return n < a
        if op == '<=':
            return n <= a
        if op == 'between':
            if not (a == a and b == b):  # NaN check
                return True
            lo = min(a, b)
            hi = max(a, b)
            return n >= lo and n <= hi
        return True
    s = str(val).lower()
    t = str(v1 or '').lower()
    if op == 'contains':
        return t in s
    if op == 'equals':
        return s == t
    if op == 'startsWith':
        return s.startswith(t)
    if op == 'endsWith':
        return s.endswith(t)
    if op == 'notContains':
        return t not in s
    if op == 'isEmpty':
        return s == ''
    if op == 'notEmpty':
        return s != ''
    return True


def apply_context_filters(rows, column_filters, value_filters, advanced_filters):
    out = rows
    if column_filters:
        cols = [c for c, f in column_filters.items() if f and f.get('op') and (f['op'] in ('isEmpty','notEmpty') or (f.get('value') is not None and str(f.get('value')) != ''))]
        if cols:
            out = [r for r in out if all(matches_col_filter(r, c, column_filters[c]) for c in cols)]
    if advanced_filters and isinstance(advanced_filters.get('rules'), list) and advanced_filters['rules']:
        rules = advanced_filters['rules']
        combine = (advanced_filters.get('combine') or 'AND').upper()
        def eval_row(r):
            res = [matches_col_filter(r, f.get('column'), f) for f in rules]
            return any(res) if combine == 'OR' else all(res)
        out = [r for r in out if eval_row(r)]
    if value_filters:
        vf_cols = [c for c, arr in value_filters.items() if isinstance(arr, list)]
        if vf_cols:
            def pass_row(r):
                for c in vf_cols:
                    sel = value_filters[c]
                    v = str(r.get(c, ''))
                    if v not in sel:
                        return False
                return True
            out = [r for r in out if pass_row(r)]
    return out


def global_search(rows, search):
    if not search or not isinstance(search, dict):
        return rows
    q = search.get('query')
    if not q:
        return rows
    case = bool(search.get('caseSensitive'))
    mode = search.get('mode') or 'substring'
    import re
    if mode == 'regex':
        try:
            reobj = re.compile(q, 0 if case else re.I)
        except Exception:
            return rows
        return [r for r in rows if any(reobj.search(str(v or '')) for v in r.values())]
    qq = q if case else q.lower()
    out = []
    for r in rows:
        for v in r.values():
            s = str(v or '')
            if not case:
                s = s.lower()
            if mode == 'exact' and s == qq:
                out.append(r)
                break
            if mode != 'exact' and qq in s:
                out.append(r)
                break
    return out


def sort_rows(rows, sort):
    if not sort:
        return rows
    order = list(sort)
    def key_fn(r):
        out = []
        for s in order:
            v = r.get(s.get('key'))
            try:
                out.append(float(v))
            except Exception:
                out.append(str(v))
        return tuple(out)
    # If single sort and desc, reverse=True
    reverse = len(order) == 1 and (order[0].get('direction') == 'desc')
    return sorted(rows, key=key_fn, reverse=reverse)


def materialize_rows(body):
    """Fetch NDJSON from the underlying Flask agent and materialize into a list of dicts."""
    mode = body.get('mode')
    endpoint = mode_to_endpoint(mode)
    if not endpoint:
        return []
    try:
        resp = requests.post(endpoint, json=body, stream=True, timeout=60)
        resp.raise_for_status()
        rows = []
        for line in resp.iter_lines():
            if not line:
                continue
            try:
                obj = json.loads(line.decode('utf-8'))
                if isinstance(obj, dict) and (obj.get('_narration') or obj.get('_base_sql') or obj.get('_column_types') or obj.get('_search_columns')):
                    continue
                if isinstance(obj, dict):
                    rows.append(obj)
                elif isinstance(obj, list):
                    rows.extend(obj)
                else:
                    rows.append({'data': obj})
            except Exception:
                continue
        # Filter out accidental empty rows
        cleaned = []
        for r in rows:
            if not isinstance(r, dict) or not r:
                cleaned.append(r)
                continue
            # if every value is null/blank string, skip
            all_blank = True
            for v in r.values():
                if v is None:
                    continue
                if isinstance(v, str) and v.strip() == '':
                    continue
                all_blank = False
                break
            if not all_blank:
                cleaned.append(r)
        return cleaned
    except Exception:
        return []


@app.post('/table/query')
def table_query():
    body = request.get_json(force=True) or {}
    model = body.get('model')
    prompt = body.get('prompt')
    mode = body.get('mode')
    if not (model and prompt and mode):
        return jsonify({'error': 'Missing prompt/mode/model'}), 400
    page = int(body.get('page') or 1)
    page_size = int(body.get('pageSize') or 50)
    all_flag = bool(body.get('all') is True)
    sort = body.get('sort') or []
    search = body.get('search') or {}
    column_filters = body.get('columnFilters') or {}
    value_filters = body.get('valueFilters') or {}
    advanced_filters = body.get('advancedFilters') or {}

    # If pushDownDb is true and baseSql provided, push filters/sort/pagination to DB (Oracle adapter)
    push_down_db = bool(body.get('pushDownDb'))
    base_sql = body.get('baseSql')
    if push_down_db and base_sql:
        try:
            data, total = oracle_pushdown_query(
                base_sql=base_sql,
                page=page,
                page_size=page_size,
                sort=sort,
                search=search,
                column_filters=column_filters,
                value_filters=value_filters,
                advanced_filters=advanced_filters,
                search_columns=body.get('searchColumns')
            )
            if body.get('all') is True:
                # Fetch all rows without pagination using page_size large
                data, total = oracle_pushdown_query(
                    base_sql=base_sql,
                    page=1,
                    page_size=10_000_000,
                    sort=sort,
                    search=search,
                    column_filters=column_filters,
                    value_filters=value_filters,
                    advanced_filters=advanced_filters,
                    search_columns=body.get('searchColumns')
                )
                return jsonify({ 'rows': data, 'total': total, 'page': 1, 'pageSize': total, 'cached': False, 'all': True })
            return jsonify({ 'rows': data, 'total': total, 'page': page, 'pageSize': page_size, 'cached': False })
        except Exception as e:
            # Fall through to cached/materialized path if pushdown fails
            app.logger.warning(f"Oracle pushdown failed: {e}")

    sig = stable_stringify({ 'model': model, 'mode': mode, 'prompt': prompt })
    rows = get_cache(sig)
    if rows is None:
        rows = materialize_rows(body)
        set_cache(sig, rows)

    # Apply global search + filters + sort
    effective = global_search(rows, search)
    effective = apply_context_filters(effective, column_filters, value_filters, advanced_filters)
    # NOTE: Sorting on the full dataset; can be pushed to DB later by rewriting SQL
    if sort:
        # Basic multi-sort using Python sort with tuple keys
        def key_fn(r):
            out = []
            for s in sort:
                k = s.get('key')
                v = r.get(k)
                try:
                    out.append(float(v))
                except Exception:
                    out.append(str(v))
            return tuple(out)
        reverse = len(sort) == 1 and (sort[0].get('direction') == 'desc')
        effective = sorted(effective, key=key_fn, reverse=reverse)

    total = len(effective)
    if all_flag:
        return jsonify({ 'rows': effective, 'total': total, 'page': 1, 'pageSize': total, 'cached': True, 'all': True })
    start = (page - 1) * page_size
    page_rows = effective[start:start + page_size]
    return jsonify({ 'rows': page_rows, 'total': total, 'page': page, 'pageSize': page_size, 'cached': True })


@app.post('/table/distinct')
def table_distinct():
    body = request.get_json(force=True) or {}
    model = body.get('model')
    prompt = body.get('prompt')
    mode = body.get('mode')
    column = body.get('column')
    if not (model and prompt and mode and column):
        return jsonify({'error': 'Missing prompt/mode/model/column'}), 400
    search_term = body.get('searchTerm')
    limit = body.get('limit')
    try:
        limit = int(limit)
    except Exception:
        # treat 'full' as large bound
        limit = 5000

    column_filters = body.get('columnFilters') or {}
    value_filters = body.get('valueFilters') or {}
    advanced_filters = body.get('advancedFilters') or {}

    push_down_db = bool(body.get('pushDownDb'))
    base_sql = body.get('baseSql')
    if push_down_db and base_sql:
        try:
            values = oracle_pushdown_distinct(
                base_sql=base_sql,
                column=column,
                limit=limit,
                search= {'query': search_term} if search_term else {},
                column_filters=column_filters,
                value_filters=value_filters,
                advanced_filters=advanced_filters,
                search_columns=body.get('searchColumns')
            )
            return jsonify({ 'distinct': values, 'column': column, 'count': len(values) })
        except Exception as e:
            app.logger.warning(f"Oracle distinct pushdown failed: {e}")
    sig = stable_stringify({ 'model': model, 'mode': mode, 'prompt': prompt })
    rows = get_cache(sig)
    if rows is None:
        rows = materialize_rows(body)
        set_cache(sig, rows)

    effective = apply_context_filters(rows, column_filters, value_filters, advanced_filters)
    values = []
    st = str(search_term or '').lower()
    seen = set()
    for r in effective:
        raw = r.get(column)
        s = '' if raw is None else str(raw)
        if st and st not in s.lower():
            continue
        if s in seen:
            continue
        seen.add(s)
        values.append(s)
        if len(values) >= limit:
            break
    values.sort()
    return jsonify({ 'distinct': values, 'column': column, 'count': len(values) })


# ---------------- Save view to Oracle -----------------

def _ensure_views_table(conn):
    """Create the VEDA_SAVED_VIEWS table if it doesn't exist."""
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT table_name FROM user_tables WHERE table_name = 'VEDA_SAVED_VIEWS'
        """)
        row = cur.fetchone()
        if not row:
            cur.execute("""
                CREATE TABLE VEDA_SAVED_VIEWS (
                  VIEW_NAME    VARCHAR2(200),
                  DATASET_SIG  VARCHAR2(4000),
                  OWNER_NAME   VARCHAR2(200),
                  CREATED_AT   TIMESTAMP DEFAULT SYSTIMESTAMP,
                  CONTENT      CLOB
                )
            """)
            conn.commit()
    except Exception as e:
        app.logger.warning(f"Ensure views table failed: {e}")


@app.post('/table/save_view')
def table_save_view():
    body = request.get_json(force=True) or {}
    view_name = body.get('viewName')
    content = body.get('viewState') or {}
    dataset_sig = body.get('datasetSig') or ''
    owner = body.get('owner') or ''
    if not view_name:
        return jsonify({ 'error': 'viewName required' }), 400
    try:
        conn = _oracle_connect()
    except Exception as e:
        return jsonify({ 'error': f'Oracle connect failed: {e}' }), 500
    try:
        _ensure_views_table(conn)
        cur = conn.cursor()
        # Upsert: try update first, then insert if not exists
        cur.setinputsizes(content=oracledb.CLOB)
        cur.execute(
            "UPDATE VEDA_SAVED_VIEWS SET CONTENT = :content, CREATED_AT = SYSTIMESTAMP WHERE VIEW_NAME = :name AND NVL(OWNER_NAME,'') = NVL(:owner,'') AND NVL(DATASET_SIG,'') = NVL(:sig,'')",
            name=view_name, sig=dataset_sig, owner=owner, content=stable_stringify(content)
        )
        if cur.rowcount == 0:
            cur.execute(
                "INSERT INTO VEDA_SAVED_VIEWS (VIEW_NAME, DATASET_SIG, OWNER_NAME, CONTENT) VALUES (:name, :sig, :owner, :content)",
                name=view_name, sig=dataset_sig, owner=owner, content=stable_stringify(content)
            )
        conn.commit()
        return jsonify({ 'ok': True, 'viewName': view_name })
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        return jsonify({ 'error': f'Oracle insert failed: {e}' }), 500
    finally:
        try:
            conn.close()
        except Exception:
            pass


@app.get('/table/saved_views')
def table_saved_views():
    dataset_sig = request.args.get('datasetSig')
    owner = request.args.get('owner')
    try:
        conn = _oracle_connect()
    except Exception as e:
        return jsonify({ 'error': f'Oracle connect failed: {e}' }), 500
    try:
        _ensure_views_table(conn)
        cur = conn.cursor()
        sql = "SELECT VIEW_NAME, DATASET_SIG, NVL(OWNER_NAME,''), CREATED_AT, CONTENT FROM VEDA_SAVED_VIEWS WHERE 1=1"
        binds = {}
        if dataset_sig:
            sql += " AND NVL(DATASET_SIG,'') = NVL(:sig,'')"; binds['sig'] = dataset_sig
        if owner is not None and owner != '':
            sql += " AND NVL(OWNER_NAME,'') = NVL(:owner,'')"; binds['owner'] = owner
        sql += " ORDER BY CREATED_AT DESC"
        cur.execute(sql, **binds)
        rows = []
        for view_name, sig, owner_name, created_at, content in cur.fetchall():
            # CONTENT may be a LOB; fetch as string and try parse JSON
            try:
                if hasattr(content, 'read'):
                    content_str = content.read()
                else:
                    content_str = content
                parsed = json.loads(content_str) if content_str else {}
            except Exception:
                parsed = {}
            rows.append({
                'viewName': view_name,
                'datasetSig': sig,
                'ownerName': owner_name,
                'createdAt': str(created_at),
                'content': parsed,
            })
        return jsonify({ 'views': rows })
    except Exception as e:
        return jsonify({ 'error': f'Oracle select failed: {e}' }), 500
    finally:
        try:
            conn.close()
        except Exception:
            pass

# ---------------- Oracle pushdown adapters -----------------

def _oracle_connect():
    user = os.environ.get('DB_USER')
    password = os.environ.get('DB_PASSWORD')
    host = os.environ.get('DB_HOST', 'localhost')
    port = int(os.environ.get('DB_PORT', '1521'))
    service = os.environ.get('DB_SERVICE')
    dsn = oracledb.makedsn(host, port, service_name=service)
    conn = oracledb.connect(user=user, password=password, dsn=dsn)
    return conn


def _rows_to_dicts(cursor, rows):
    cols = [d[0] for d in cursor.description]
    out = []
    for r in rows:
        out.append({ cols[i]: r[i] for i in range(len(cols)) })
    return out


def qi(col: str) -> str:
    col = str(col)
    if col.startswith('"') and col.endswith('"'):
        return col
    return '"' + col.replace('"', '""') + '"'


def _date_cast(bind_name: str) -> str:
    # Assume ISO-8601 timestamps from client
    return f"TO_TIMESTAMP(:{bind_name}, 'YYYY-MM-DD\"T\"HH24:MI:SSFF')"


def _build_where_and_binds(column_filters, value_filters, advanced_filters, search, search_columns=None, column_types=None):
    where = []
    binds = {}
    p = 1

    # Column filters
    if column_filters:
        for col, f in column_filters.items():
            if not f or not f.get('op'):
                continue
            qcol = f"t.{qi(col)}"
            ctype = (column_types or {}).get(col)
            op = f['op']
            if op in ('isEmpty','notEmpty'):
                clause = f'({qcol} IS NULL OR {qcol} = \'\')' if op == 'isEmpty' else f'({qcol} IS NOT NULL AND {qcol} <> \'\')'
                where.append(clause)
                continue
            if op == 'between':
                a = f.get('value')
                b = f.get('value2')
                binds[f'p{p}'] = a; p += 1
                binds[f'p{p}'] = b; p += 1
                if ctype == 'date':
                    where.append(f"{qcol} BETWEEN {_date_cast(f'p{p-2}')} AND {_date_cast(f'p{p-1}')} ")
                else:
                    where.append(f"{qcol} BETWEEN :p{p-2} AND :p{p-1}")
                continue
            val = f.get('value')
            if op in ('>','>=','<','<=','=','!='):
                binds[f'p{p}'] = val; cmpop = '<>' if op == '!=' else op
                if ctype == 'date':
                    where.append(f"{qcol} {cmpop} {_date_cast(f'p{p}')} "); p += 1
                else:
                    where.append(f"{qcol} {cmpop} :p{p}"); p += 1
            else:
                # string ops using LIKE
                if op == 'contains':
                    binds[f'p{p}'] = f"%{val}%"; where.append(f"LOWER({col}) LIKE LOWER(:p{p})"); p += 1
                elif op == 'equals':
                    binds[f'p{p}'] = val; where.append(f"{qcol} = :p{p}"); p += 1
                elif op == 'startsWith':
                    binds[f'p{p}'] = f"{val}%"; where.append(f"LOWER({qcol}) LIKE LOWER(:p{p})"); p += 1
                elif op == 'endsWith':
                    binds[f'p{p}'] = f"%{val}"; where.append(f"LOWER({qcol}) LIKE LOWER(:p{p})"); p += 1

    # Advanced filters
    if advanced_filters and isinstance(advanced_filters.get('rules'), list) and advanced_filters['rules']:
        rules = []
        for f in advanced_filters['rules']:
            col = f.get('column'); op = f.get('op');
            if not col or not op:
                continue
            qcol = f"t.{qi(col)}"
            ctype = (column_types or {}).get(col)
            if op in ('isEmpty','notEmpty'):
                clause = f'({qcol} IS NULL OR {qcol} = \'\')' if op == 'isEmpty' else f'({qcol} IS NOT NULL AND {qcol} <> \'\')'
                rules.append(clause)
                continue
            if op == 'between':
                a = f.get('value'); b = f.get('value2')
                binds[f'p{p}'] = a; p += 1
                binds[f'p{p}'] = b; p += 1
                if ctype == 'date':
                    rules.append(f"{qcol} BETWEEN {_date_cast(f'p{p-2}')} AND {_date_cast(f'p{p-1}')} ")
                else:
                    rules.append(f"{qcol} BETWEEN :p{p-2} AND :p{p-1}")
                continue
            val = f.get('value')
            if op in ('>','>=','<','<=','=','!='):
                binds[f'p{p}'] = val; cmpop = '<>' if op == '!=' else op
                if ctype == 'date':
                    rules.append(f"{qcol} {cmpop} {_date_cast(f'p{p}')} "); p += 1
                else:
                    rules.append(f"{qcol} {cmpop} :p{p}"); p += 1
            else:
                if op == 'contains':
                    binds[f'p{p}'] = f"%{val}%"; rules.append(f"LOWER({qcol}) LIKE LOWER(:p{p})"); p += 1
                elif op == 'equals':
                    binds[f'p{p}'] = val; rules.append(f"{qcol} = :p{p}"); p += 1
                elif op == 'startsWith':
                    binds[f'p{p}'] = f"{val}%"; rules.append(f"LOWER({qcol}) LIKE LOWER(:p{p})"); p += 1
                elif op == 'endsWith':
                    binds[f'p{p}'] = f"%{val}"; rules.append(f"LOWER({qcol}) LIKE LOWER(:p{p})"); p += 1
        if rules:
            combine = (advanced_filters.get('combine') or 'AND').upper()
            joiner = ' OR ' if combine == 'OR' else ' AND '
            where.append('(' + joiner.join(rules) + ')')

    # Value filters
    if value_filters:
        for col, arr in value_filters.items():
            if not isinstance(arr, list) or not arr:
                continue
            names = []
            for v in arr:
                binds[f'p{p}'] = v; names.append(f":p{p}"); p += 1
            where.append(f"t.{qi(col)} IN (" + ','.join(names) + ")")

    # Global search (optional, requires explicit columns list)
    if search and isinstance(search_columns, list) and search.get('query'):
        q = str(search['query'])
        names = []
        for col in search_columns:
            binds[f'p{p}'] = f"%{q}%"; names.append(f"LOWER(t.{qi(col)}) LIKE LOWER(:p{p})"); p += 1
        if names:
            where.append('(' + ' OR '.join(names) + ')')

    clause = (' WHERE ' + ' AND '.join(where)) if where else ''
    return clause, binds


def oracle_pushdown_query(base_sql, page, page_size, sort, search, column_filters, value_filters, advanced_filters, search_columns=None):
    # Normalize base SQL (inline view cannot end with semicolon)
    base_sql = str(base_sql).strip().rstrip(';')
    where_clause, binds = _build_where_and_binds(column_filters, value_filters, advanced_filters, search, search_columns)
    order_by = ''
    if sort:
        parts = []
        for s in sort:
            key = s.get('key'); direction = (s.get('direction') or 'asc').upper()
            if key:
                parts.append(f"t.{qi(key)} {('DESC' if direction=='DESC' else 'ASC')}" )
        if parts:
            order_by = ' ORDER BY ' + ', '.join(parts)
    count_sql = f"SELECT COUNT(*) AS CNT FROM ({base_sql}) t{where_clause}"
    # Note: ROW_NUMBER() requires an ORDER BY; use ORDER BY 1 as a deterministic fallback
    data_sql = f"SELECT * FROM (SELECT t.*, ROW_NUMBER() OVER ({order_by or 'ORDER BY 1'}) rn FROM ({base_sql}) t{where_clause}) WHERE rn > :off AND rn <= :off + :lim"

    off = (page - 1) * page_size
    binds_q = dict(binds)
    binds_q['off'] = off
    binds_q['lim'] = page_size

    with _oracle_connect() as conn:
        with conn.cursor() as cur:
            app.logger.info(f"[oracle-pushdown] COUNT SQL: {count_sql} binds={binds}")
            cur.execute(count_sql, binds)
            total = int(cur.fetchone()[0])
            app.logger.info(f"[oracle-pushdown] DATA SQL: {data_sql} binds={binds_q}")
            cur.execute(data_sql, binds_q)
            rows = cur.fetchall()
            data = _rows_to_dicts(cur, rows)
    return data, total


def oracle_pushdown_distinct(base_sql, column, limit, search, column_filters, value_filters, advanced_filters, search_columns=None):
    base_sql = str(base_sql).strip().rstrip(';')
    where_clause, binds = _build_where_and_binds(column_filters, value_filters, advanced_filters, search, search_columns)
    qcol = f"t.{qi(column)}"
    sql = f"SELECT DISTINCT {qcol} AS VAL FROM ({base_sql}) t{where_clause} ORDER BY {qcol} FETCH FIRST :lim ROWS ONLY"
    binds_q = dict(binds)
    binds_q['lim'] = int(limit)
    with _oracle_connect() as conn:
        with conn.cursor() as cur:
            app.logger.info(f"[oracle-pushdown] DISTINCT SQL: {sql} binds={binds_q}")
            cur.execute(sql, binds_q)
            vals = [ (row[0] if row and len(row)>0 else None) for row in cur.fetchall() ]
    return [ '' if v is None else str(v) for v in vals ]


if __name__ == '__main__':
    # For quick local run: python api/table_ops_service/app.py
    app.run(host='0.0.0.0', port=5015)
