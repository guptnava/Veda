import json, os, pandas as pd, streamlit as st
st.set_page_config(page_title="NLP↔SQL Embeddings Evals", layout="wide")

st.title("NLP↔SQL Embeddings Evaluation Dashboard")

report_path = st.text_input("Path to metrics report (JSON)", "reports/metrics.json")
if st.button("Load Report"):
    if os.path.exists(report_path):
        data = json.load(open(report_path, "r", encoding="utf-8"))
        st.subheader("Aggregate Metrics")
        st.json(data.get("metrics", {}))
    else:
        st.error(f"Report not found: {report_path}")

st.divider()
st.subheader("Per-Query Breakdown (optional)")
st.info("You can extend evals/runner.py to write a per-query JSON file and load it here.")
