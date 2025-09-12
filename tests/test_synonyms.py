import builtins
import types

import importlib


def test_tokenize_and_content_word(monkeypatch):
    syn = importlib.import_module('api.Training.utils.synonyms')

    toks = syn._tokenize("Don't panic, 3.14!")
    assert toks[:3] == ["Don't", 'panic', ',']

    assert syn._is_content_word('Employees') is True
    assert syn._is_content_word('me') is False  # stopword
    assert syn._is_content_word('3.14') is False
    assert syn._is_content_word('!') is False


def test_bounded_expand(monkeypatch):
    syn = importlib.import_module('api.Training.utils.synonyms')

    # Make expansion deterministic and small
    monkeypatch.setattr(syn, 'MAX_WORDS_TO_EXPAND', 2, raising=False)
    monkeypatch.setattr(syn, 'MAX_SENTENCE_VARIANTS', 8, raising=False)

    def fake_word_syns(token):
        if token.lower().startswith('show'):
            return ['display', 'list']
        if token.lower().startswith('employees'):
            return ['staff']
        return []

    monkeypatch.setattr(syn, '_word_syns', fake_word_syns)

    out = syn._bounded_expand(['show', 'me', 'employees'])
    # Bound and includes originals
    assert 'show me employees' in out
    assert any('display' in s for s in out)
    assert any('staff' in s for s in out)
    assert len(out) <= 8


def test_apply_phrase_synonyms(monkeypatch):
    syn = importlib.import_module('api.Training.utils.synonyms')
    sentences = ['show me employees']
    out = syn._apply_phrase_synonyms(sentences)
    # At least one phrase replacement should happen
    assert any(s != 'show me employees' for s in out)


def test_generate_synonyms_semantic_off(monkeypatch):
    syn = importlib.import_module('api.Training.utils.synonyms')

    # Keep generation small and deterministic
    monkeypatch.setattr(syn, 'MAX_WORDS_TO_EXPAND', 1, raising=False)
    monkeypatch.setattr(syn, 'MAX_SENTENCE_VARIANTS', 16, raising=False)

    # Stub paraphrases to avoid model usage entirely
    monkeypatch.setattr(syn, '_paraphrases_cached', lambda s, top_k=5: (s + ' please',), raising=False)

    out = syn.generate_synonyms('Show me employees', max_variants=10, use_semantic_filter=False)
    assert isinstance(out, list) and len(out) > 0
    assert any('employees' in s.lower() for s in out)


def test_generate_synonyms_semantic_on(monkeypatch):
    syn = importlib.import_module('api.Training.utils.synonyms')

    # Stub models to deterministic vectors
    class FakeModel:
        def encode(self, texts, convert_to_numpy=True, batch_size=None, show_progress_bar=False):
            if isinstance(texts, str):
                texts = [texts]
            # produce simple length-based embeddings
            return [[float(len(t))] for t in texts]

    monkeypatch.setattr(syn, '_load_models_once', lambda: (FakeModel(), FakeModel()), raising=False)
    monkeypatch.setattr(syn, '_paraphrases_cached', lambda s, top_k=5: (s + ' please',), raising=False)

    out = syn.generate_synonyms('Show me employees', max_variants=10, use_semantic_filter=True)
    # Should still produce items, filtered via trivial similarity
    assert isinstance(out, list)
    assert len(out) >= 1

