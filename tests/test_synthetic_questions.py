import importlib
import random as _random


def test_generate_questions_core(monkeypatch):
    sq = importlib.import_module('api.Training.utils.synthetic_questions')

    # Deterministic random
    monkeypatch.setattr(sq.random, 'choice', lambda seq: seq[0])
    monkeypatch.setattr(sq.random, 'sample', lambda seq, k: list(seq)[:k])

    tables = [{
        'schema_name': 'HR',
        'table_name': 'EMPLOYEES',
        'qualified_name': 'HR.EMPLOYEES',
        'columns': [
            {'name': 'EMPLOYEE_ID', 'type': 'NUMBER', 'sql_type': 'PK', 'col_qualified_name': 'HR.EMPLOYEES.EMPLOYEE_ID'},
            {'name': 'LAST_NAME', 'type': 'VARCHAR2', 'sql_type': 'COL', 'col_qualified_name': 'HR.EMPLOYEES.LAST_NAME'},
            {'name': 'SALARY', 'type': 'NUMBER', 'sql_type': 'COL', 'col_qualified_name': 'HR.EMPLOYEES.SALARY'},
            {'name': 'HIRE_DATE', 'type': 'DATE', 'sql_type': 'COL', 'col_qualified_name': 'HR.EMPLOYEES.HIRE_DATE'},
        ]
    }]

    out = sq.generate_questions(tables)
    assert isinstance(out, list) and len(out) > 0
    # Should include at least a SELECT * and a COUNT
    texts = [' '.join([o['question'], o['sql_template']]) for o in out]
    assert any('SELECT * FROM HR.EMPLOYEES' in t for t in texts)
    assert any('SELECT COUNT(*) FROM HR.EMPLOYEES' in t for t in texts)
    # Should include a select specific columns and distinct queries
    assert any('SELECT DISTINCT' in t for t in texts)

