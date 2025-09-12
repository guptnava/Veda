import importlib
import types
import struct


class FakeBlob:
    def __init__(self, b: bytes):
        self._b = b
    def read(self):
        return self._b


class FakeCursor:
    def __init__(self, embeddings_rows=None, training_sql_map=None):
        self._emb_rows = embeddings_rows or []
        self._training_sql = training_sql_map or {}
        self.description = [("ID",), ("TRAINING_ID",), ("QUESTION",), ("EMBEDDING",)]
        self._last_query = None
        self._last_args = None

    def execute(self, sql, params=None):
        self._last_query = sql
        self._last_args = params
        return self

    def executemany(self, sql, rows):  # pragma: no cover - used by insert_* paths
        self._last_query = sql
        self._last_args = rows

    def fetchall(self):
        if 'FROM NL2SQL_EMBEDDINGS' in (self._last_query or ''):
            return self._emb_rows
        if 'FROM NL2SQL_TRAINING' in (self._last_query or '') and 'WHERE id IN' in self._last_query:
            # params is a list of training_id values
            return [(tid, self._training_sql.get(tid, '')) for tid in (self._last_args or [])]
        return []

    def fetchmany(self, n):  # pragma: no cover
        return []

    def close(self):  # pragma: no cover
        pass


class FakeConn:
    def __init__(self, cur):
        self._cur = cur
    def cursor(self):
        return self._cur
    def commit(self):  # pragma: no cover
        pass
    def rollback(self):  # pragma: no cover
        pass


def _f32_bytes(vals):
    return struct.pack('<' + 'f'*len(vals), *vals)


def test_build_and_search_kdtree(monkeypatch):
    ou = importlib.import_module('api.Training.utils.oracle_utils')

    # Prepare two 1-d embeddings to make distances trivial
    rows = [
        (1, 101, 'Q1', FakeBlob(_f32_bytes([0.0]))),
        (2, 102, 'Q2', FakeBlob(_f32_bytes([10.0]))),
    ]
    training_sql = {101: 'SELECT 1', 102: 'SELECT 2'}

    cur = FakeCursor(embeddings_rows=rows, training_sql_map=training_sql)
    conn = FakeConn(cur)

    # Patch KDTree with a fake that records data and returns nearest index 0 for small values
    class FakeKDTree:
        def __init__(self, arr):
            # arr is a list of vectors
            self.arr = arr
        def query(self, q, k=3):
            # q is a 1-d vector; compute simple abs distance to first dim
            dists = []
            idxs = []
            for i, vec in enumerate(self.arr[:k]):
                dist = abs((q[0] if isinstance(q, (list, tuple)) else q) - vec[0])
                dists.append(dist)
                idxs.append(i)
            return dists, idxs

    monkeypatch.setattr(ou, 'KDTree', FakeKDTree, raising=True)

    # Build index
    ou.refresh_embedding_index(conn)
    assert ou.KD_TREE_INDEX is not None

    # Query near the first vector
    res = ou.search_embeddings_kdtree(conn, [0.1], top_k=1)
    assert isinstance(res, list) and len(res) == 1
    assert res[0]['sql_template'] == 'SELECT 1'
    assert 'similarity' in res[0]


def test_ensure_tables_executes(monkeypatch):
    ou = importlib.import_module('api.Training.utils.oracle_utils')
    executed = []

    class Cur:
        def execute(self, sql):
            executed.append(sql)
        def close(self):
            pass
    class Conn:
        def __init__(self):
            self._c = Cur()
        def cursor(self):
            return self._c
        def commit(self):
            executed.append('COMMIT')

    conn = Conn()
    ou.ensure_tables(conn)
    # Expect multiple CREATE TABLE blocks and a commit
    assert any('CREATE TABLE NL2SQL_SCHEMA' in s for s in executed)
    assert any('CREATE TABLE NL2SQL_TRAINING' in s for s in executed)
    assert any('CREATE TABLE NL2SQL_SYNONYMS' in s for s in executed)
    assert any('CREATE TABLE NL2SQL_EMBEDDINGS' in s for s in executed)
    assert any('CREATE TABLE NL2SQL_EVALUATION' in s for s in executed)
    assert any('CREATE TABLE NL2SQL_METRICS' in s for s in executed)
    assert any('CREATE TABLE NL2SQL_FALLBACK' in s for s in executed)
    assert executed[-1] == 'COMMIT'

