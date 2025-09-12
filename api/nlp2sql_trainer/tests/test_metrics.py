from nlp2sql_trainer.evals.metrics import accuracy_at_k, mrr, ndcg_at_k

def test_basic_metrics():
    gold = [0,1,2]
    preds = [[0,2,1],[2,1,0],[2,0,1]]
    assert abs(accuracy_at_k(gold, preds, k=1) - (2/3)) < 1e-6
    assert mrr(gold, preds) > 0
    assert ndcg_at_k(gold, preds, k=3) > 0
