import importlib


def test_parse_args_minimal():
    rt = importlib.import_module('api.Training.run_training')
    args = rt.parse_args([
        '--host','localhost',
        '--service','orclpdb1',
        '--user','scott',
        '--password','tiger',
        '--schema-owner','SCOTT',
        '--skip-schema','--skip-questions','--skip-synonyms','--skip-embeddings','--skip-eval',
        '--workers','2','--max-variants','10','--model-path','../m']
    )
    assert args.host == 'localhost'
    assert args.port == '1521'  # default
    assert args.schema_owner == 'SCOTT'
    assert args.skip_schema and args.skip_questions and args.skip_synonyms and args.skip_embeddings and args.skip_eval
    assert args.workers == 2 and args.max_variants == 10 and args.model_path == '../m'

