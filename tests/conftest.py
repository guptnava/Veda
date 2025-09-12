import sys
import types


def pytest_configure(config):
    """Provide light fakes or helpers before importing modules under test."""
    # Optionally provide a minimal 'oracledb' for code paths that check its presence
    if 'oracledb' not in sys.modules:
        fake = types.ModuleType('oracledb')
        # Provide a placeholder LOB type for isinstance checks
        class _LOB:  # pragma: no cover - structure only
            def read(self):
                return ''
        fake.LOB = _LOB
        sys.modules['oracledb'] = fake

    # Provide a minimal pandas to satisfy imports where pandas isn't installed
    if 'pandas' not in sys.modules:
        pd = types.ModuleType('pandas')
        class _DF:  # pragma: no cover - placeholder
            pass
        pd.DataFrame = _DF
        sys.modules['pandas'] = pd

    # Provide a minimal sentence_transformers to satisfy imports
    if 'sentence_transformers' not in sys.modules:
        st = types.ModuleType('sentence_transformers')
        class SentenceTransformer:  # pragma: no cover - trivial stub
            def __init__(self, *a, **k):
                pass
            def encode(self, texts, convert_to_numpy=True, **kwargs):
                if isinstance(texts, str):
                    texts = [texts]
                return [[float(len(t))] for t in texts]
        class _FakeTensor:
            def __init__(self, arr):
                self._arr = arr
            def __getitem__(self, k):
                return _FakeTensor(self._arr[k])
            def cpu(self):
                return self
            def numpy(self):
                return self._arr
        def cos_sim(a, b):  # pragma: no cover - for import only
            return _FakeTensor([[1.0 for _ in range(len(b))]])
        util = types.SimpleNamespace(cos_sim=cos_sim)
        st.SentenceTransformer = SentenceTransformer
        st.util = util
        sys.modules['sentence_transformers'] = st
