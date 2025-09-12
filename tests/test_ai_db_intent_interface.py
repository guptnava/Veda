import importlib
import datetime
import decimal


def test_is_safe_sql_and_intent():
    mod = importlib.import_module('api.database_NoLLM_agent.ai_db_intent_interface')
    assert mod.is_safe_sql('SELECT 1 FROM DUAL') is True
    assert mod.is_safe_sql('  select * from t') is True
    assert mod.is_safe_sql('DELETE FROM t') is False

    assert mod.detect_intent('please list all employees for me') == 'list all employees'
    assert mod.detect_intent('unknown') is None


def test_serialize_row_types():
    mod = importlib.import_module('api.database_NoLLM_agent.ai_db_intent_interface')

    cols = ['d', 'n', 'c', 'b']
    dt = datetime.datetime(2024, 1, 2, 3, 4, 5)
    dec = decimal.Decimal('12.34')
    clob = 'x' * 5
    blob = b'\x00\x01\x02'
    row = [dt, dec, clob, blob]

    out = mod.serialize_row(row, cols)
    assert out['d'] == dt.isoformat()
    assert out['n'] == float(dec)
    assert out['c'] == clob
    assert out['b']['_type'] == 'BLOB'
    assert out['b']['length'] == len(blob)

