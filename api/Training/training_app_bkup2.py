import base64
import logging
import streamlit as st
import pandas as pd
import numpy as np
import oracledb
import json
import time
from sentence_transformers import SentenceTransformer
from utils.oracle_utils import (
    connect_oracle, insert_schema, insert_questions,
    insert_synonyms, insert_embeddings, search_embeddings_kdtree, search_embeddings,
    fetch_schema_from_db, fetch_training_data, fetch_training_synonym_data,
    fetch_embeddings_from_db,
    fetch_evaluation_prompts, insert_evaluation_metric, fetch_evaluation_metrics,
    refresh_embedding_index
)
from utils.synthetic_questions import generate_questions
from utils.synonyms import (generate_synonyms, generate_synonyms_bulk)

st.set_page_config(layout="wide", page_title="Veda Training Centre", initial_sidebar_state="expanded")

# ---------- NEW: small helpers to embed local images as data URIs ----------
def get_base64_of_bin_file(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()

def guess_mime(path: str) -> str:
    p = path.lower()
    if p.endswith(".png"): return "image/png"
    if p.endswith(".jpg") or p.endswith(".jpeg"): return "image/jpeg"
    if p.endswith(".gif"): return "image/gif"
    if p.endswith(".svg"): return "image/svg+xml"
    return "application/octet-stream"

def to_data_uri(path: str) -> str:
    return f"data:{guess_mime(path)};base64,{get_base64_of_bin_file(path)}"

# ---------- Paths you can change to your own relative assets ----------
icon_path = "../../client/src/icons/earth.jpg"          # left round logo
right_icon_path = "../../client/src/icons/robot.png"    # <-- RIGHT-SIDE ICON (replace me)

# Convert to embeddable data URIs
icon_uri = to_data_uri(icon_path)
right_icon_uri = to_data_uri(right_icon_path)

# ---------- Header styles ----------
st.markdown("""
    <style>
        .block-container { padding-top: 1.8rem; }

        .header-bar {
            display: flex;
            align-items: center;
            justify-content: space-between; /* make room for right-side icon */
            padding: 1rem 1.5rem;
            background: rgba(0,0,0,0.0);
            border-radius: 12px;
            margin-bottom: 1.5rem;
        }

        .header-left {
            display: flex;
            align-items: center;
        }

        .circle-label {
            position: relative;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            padding: 2px;
            background: conic-gradient(from 180deg, #3fa9f5, #00e5ff, #7c4dff, #3fa9f5);
            box-shadow: 0 0 14px rgba(0, 229, 255, 0.45);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 14px;
        }
        .circle-label img {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            object-fit: cover;
        }

        .header-title {
            font-size: 2.6rem;
            font-weight: 900;
            letter-spacing: 1.5px;
            line-height: 1;
            color: transparent;
            background: linear-gradient(180deg, #fff7cc 0%, #ffd700 40%, #caa31a 70%, #8a6b0f 100%);
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-stroke: 1px rgba(60,40,0,0.8);
            text-shadow: 0 2px 0 rgba(0,0,0,0.35), 0 6px 12px rgba(0,0,0,0.45), 0 0 14px rgba(255,215,0,0.35);
            background-size: 200% 100%;
            animation: vedaShine 4s linear infinite;
            padding-bottom: 2px;
        }
        @keyframes vedaShine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

        /* ---------- NEW: right-edge icon styles ---------- */
        .header-right {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .header-right img {
            width: 96px;
            height: 96px;
            display: block;
            filter: drop-shadow(0 1px 1px rgba(0,0,0,0.35));
            transition: transform 0.15s ease;
            cursor: default;
        }
        .header-right img.clickable {
            cursor: pointer;
        }
        .header-right img:hover {
            transform: scale(1.08);
        }
    </style>
""", unsafe_allow_html=True)

# ---------- Header HTML (left: logo+title, right: new icon) ----------
st.markdown(
    f"""
    <div class="header-bar">
        <div class="header-left">
            <div class="circle-label">
                <img src="{icon_uri}" alt="logo">
            </div>
            <div class="header-title">Veda</div>
        </div>
        <div class="header-right">
            <!-- Tip: wrap this <img> in <a href="...">...</a> if you want it to open a link -->
            <img class="clickable" src="{right_icon_uri}" alt="right icon" title="Right action"/>
        </div>
    </div>
    """,
    unsafe_allow_html=True
)

# (Your other style blocks and UI elements continue here—unchanged)


st.markdown("""
    <style>
        /* 🔘 Buttons */
        .stButton > button {
            background: linear-gradient(90deg, #3fa9f5, #0066cc);
            color: white;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            padding: 0.6rem 1.2rem;
            transition: all 0.3s ease;
            width: 250px;       /* 🔥 fixed width */
            height: 10px;       /* consistent height */
        }
        .stButton > button:hover {
            background: linear-gradient(90deg, #0066cc, #3fa9f5);
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            transform: translateY(-2px);
        }

        /* 📝 Input fields */
        .stTextInput > div > div > input,
        .stNumberInput > div > div > input,
        .stTextArea textarea,
        .stSelectbox div[data-baseweb="select"] > div {
            border-radius: 6px !important;
            border: 1px solid #ccc !important;
            padding: 0.5rem !important;
            background-color: #fff !important;
            color: #000 !important;
        }
        .stTextInput > div > div > input:focus,
        .stNumberInput > div > div > input:focus,
        .stTextArea textarea:focus,
        .stSelectbox div[data-baseweb="select"] > div:focus {
            border: 1px solid #3fa9f5 !important;
            box-shadow: 0 0 0 2px rgba(63,169,245,0.3) !important;
        }

        /* 📊 Tables */
        .stDataFrame table {
            border-collapse: collapse;
            width: 100%;
        }
        .stDataFrame th {
            background: #3fa9f5 !important;
            color: white !important;
            font-weight: 600 !important;
            text-align: left !important;
            padding: 0.5rem !important;
        }
        .stDataFrame td {
            padding: 0.5rem !important;
        }
        .stDataFrame tr:nth-child(even) {
            background-color: #f9f9f9 !important;
        }
        .stDataFrame tr:hover {
            background-color: #e6f2fb !important;
        }
    </style>
""", unsafe_allow_html=True)


# Load model once
@st.cache_resource
def load_model():
    # Use a local path or a valid model name
    return SentenceTransformer("../local_all-MiniLM-L6-v2")

model = load_model()

# Setup logging
log_file = "synonym_generation.log"
logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
    filemode="w"  # overwrite each run; use "a" to append
)



st.markdown("""
    <style>
        /* Remove top padding/margin from sidebar header */
        section[data-testid="stSidebar"] h2 {
            margin-top: 0px !important;
            padding-top: 0px !important;
        }
    </style>
""", unsafe_allow_html=True)



# Sidebar for DB config
st.sidebar.header(" 🔌  Connection Details:")
host = st.sidebar.text_input("Host", "localhost")
port = st.sidebar.text_input("Port", "1521")
service = st.sidebar.text_input("Service", "riskintegov2")
user = st.sidebar.text_input("User", "riskintegov2")
password = st.sidebar.text_input("Password", "riskintegov2", type="password")


if st.sidebar.button("Connect"):
    try:
        conn = connect_oracle(user, password, host, port, service)
        st.session_state["conn"] = conn
        st.sidebar.success("✅ Connected to Oracle")
    except Exception as e:
        st.sidebar.error(f"❌ Connection failed: {e}")



st.markdown("<h1 style='text-align: left; font-size: 1.8rem;'>🧠 NLP Training & Evaluation Centre</h1>", unsafe_allow_html=True)




tab1, tab2, tab3, tab4 = st.tabs(["1. Scan Schema", "2. Generate Questions", "3. Build Embeddings", "4. Evaluation"])

# -------------------------
# TAB 1: Extract Schema
# -------------------------
with tab1:
    st.markdown("<h1 style='text-align: left; font-size: 1.5rem;'>Analyze and Inject Schema</h1>", unsafe_allow_html=True)

    schema_owner = st.text_input("Enter schema owner (Oracle user):")

  

    if st.button("Extract & Store Schema"):
        with st.spinner(f"Extracting schema for {schema_owner} from Oracle..."):
            conn = st.session_state.get("conn")
            if not conn:
                st.error("Not connected to Oracle")
            elif not schema_owner.strip():
                st.warning("Please enter a schema owner before extracting.")
            else:
                try:
                    # Call helper with schema owner
                    insert_schema(conn, schema_owner)

                    st.success(f"✅ Schema for `{schema_owner}` stored in Oracle table NL2SQL_SCHEMA")

                    # Display stored schema
                    df = fetch_schema_from_db(conn)
                    st.dataframe(df)

                except Exception as e:
                    st.error(f"❌ Failed to extract schema: {e}")

    # Add a button to view the stored schema without re-extracting
    if st.button("View Stored Schema"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            try:
                st.markdown("<h1 style='text-align: left; font-size: 1.2rem;'>Current Schema Data</h1>", unsafe_allow_html=True)
                #st.subheader("Current Schema Data")
                df = fetch_schema_from_db(conn)
                if not df.empty:
                    st.dataframe(df)
                else:
                    st.info("No schema data found. Please extract the schema first.")
            except Exception as e:
                st.error(f"❌ Failed to fetch schema data: {e}")


# -------------------------
# TAB 2: Generate Questions
# -------------------------
with tab2:
    st.markdown("<h1 style='text-align: left; font-size: 1.5rem;'>Generate Synthetic Questions + Synonyms</h1>", unsafe_allow_html=True)


    if st.button("Generate & Store Questions"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            try:
                # Fetch schema from Oracle
                schema_df = fetch_schema_from_db(conn)
                st.success(f"Schema records fetched: {len(schema_df)}")

                # Group columns by table
                tables = []
                for (schema_name, table_name, qualified_name), group in schema_df.groupby(["SCHEMA_NAME", "TABLE_NAME" , "QUALIFIED_TABLE_NAME"]):
                    table_info = {
                        "schema_name": schema_name,
                        "table_name": table_name,
                        "qualified_name": qualified_name,
                        "columns": [
                            {"name": row["COLUMN_NAME"], "type": row["DATA_TYPE"], "sql_type": row["SQL_TYPE"], "col_qualified_name": row["QUALIFIED_COLUMN_NAME"] }
                            for _, row in group.iterrows()
                            if row["DATA_TYPE"].upper() not in ("CLOB", "BLOB")  # ignore LOBs
                        ]
                    }
                    if table_info["columns"]:  # only include tables with columns
                        tables.append(table_info)
                        logging.info(f"{tables}")

                if not tables:
                    st.warning("⚠️ No valid tables found in schema.")
                else:
                    # Generate synthetic questions
                    with st.spinner("Generating questions..."):
                        q_list = generate_questions(tables)
                    
                    if not q_list:
                        st.warning("⚠️ No questions were generated. Skipping synonyms.")
                    else:
                        # Convert to DataFrame for Oracle insert
                        q_df = pd.DataFrame(q_list)
                        insert_questions(conn, q_df)
                        st.success(f"✅ {len(q_df)} questions stored in Oracle")
                        st.dataframe(q_df.head(20))

                        # Fetch back question IDs to maintain relationship
                        cur = conn.cursor()
                        cur.execute("SELECT id, question FROM NL2SQL_TRAINING")
                        questions_in_db = cur.fetchall()  # list of tuples (training_id, question)
                        #logging.info(f"Fetched {questions_in_db} questions from Oracle.")
                        cur.close()


                                                # Generate synonyms (with Streamlit controls, parallel & batched)
                        import os  # for cpu_count
                        
                        if "_syn_settings" not in st.session_state:
                            st.session_state._syn_settings = {
                                "workers": max(2, (os.cpu_count() or 4) // 2),
                                "use_processes": True,
                                "max_variants": 20,
                                "semantic_filter": False,
                                "batch_questions": 64,
                                "insert_batch": 2000,
                            }
                        
                        with st.expander("Synonym Generation Settings", expanded=True):
                            c1, c2, c3 = st.columns(3)
                            with c1:
                                workers = st.number_input(
                                    "Workers (CPU cores)", min_value=1, max_value=256,
                                    value=int(st.session_state._syn_settings["workers"]), step=1,
                                    help="Parallel workers. For processes, ~cores or cores/2 is typical."
                                )
                            with c2:
                                use_processes = st.toggle(
                                    "Use processes (safer on CPU)", value=st.session_state._syn_settings["use_processes"],
                                    help="Processes avoid the GIL; better on big CPU-only servers."
                                )
                            with c3:
                                max_variants = st.slider(
                                    "Max variants per question", 5, 100,
                                    value=int(st.session_state._syn_settings["max_variants"]), step=1,
                                )
                            c4, c5, c6 = st.columns(3)
                            with c4:
                                semantic_filter = st.toggle(
                                    "Semantic filter (SBERT)", value=st.session_state._syn_settings["semantic_filter"],
                                    help="Keeps only paraphrases highly similar to the original (extra encode cost)."
                                )
                            with c5:
                                batch_questions = st.slider(
                                    "Questions per wave", 8, 512,
                                    value=int(st.session_state._syn_settings["batch_questions"]), step=8,
                                    help="How many questions to send to the pool per wave."
                                )
                            with c6:
                                insert_batch = st.slider(
                                    "DB insert batch size", 100, 10000,
                                    value=int(st.session_state._syn_settings["insert_batch"]), step=100,
                                    help="Rows per executemany() call inside insert_synonyms."
                                )
                        
                        st.session_state._syn_settings.update({
                            "workers": int(workers),
                            "use_processes": bool(use_processes),
                            "max_variants": int(max_variants),
                            "semantic_filter": bool(semantic_filter),
                            "batch_questions": int(batch_questions),
                            "insert_batch": int(insert_batch),
                        })
                        
                        workers = st.session_state._syn_settings["workers"]
                        use_processes = st.session_state._syn_settings["use_processes"]
                        max_variants = st.session_state._syn_settings["max_variants"]
                        semantic_filter = st.session_state._syn_settings["semantic_filter"]
                        batch_questions = st.session_state._syn_settings["batch_questions"]
                        insert_batch = st.session_state._syn_settings["insert_batch"]
                        
                        with st.spinner("Generating synonyms..."):
                            ids, qs = [], []
                            for training_id, question in questions_in_db:
                                if hasattr(question, "read"):
                                    try:
                                        question = question.read()
                                    except Exception:
                                        pass
                                ids.append(training_id)
                                qs.append(str(question or "").strip())
                        
                            total_q = len(qs)
                            if total_q == 0:
                                st.warning("No questions found to expand.")
                            else:
                                progress = st.progress(0, text=f"Queued 0/{total_q} questions…")
                                inserted_total = 0
                                processed_q = 0
                        
                                def _chunked(seq, size):
                                    for i in range(0, len(seq), size):
                                        yield seq[i : i + size]
                        
                                for chunk in _chunked(list(zip(ids, qs)), batch_questions):
                                    batch_ids = [x for x, _ in chunk]
                                    batch_qs  = [q for _, q in chunk]
                        
                                    results = generate_synonyms_bulk(
                                        batch_qs,
                                        max_variants=max_variants,
                                        workers=workers,
                                        use_processes=use_processes,
                                        use_semantic_filter=semantic_filter,
                                    )
                        
                                    records = []
                                    for tid, syns in zip(batch_ids, results):
                                        for s in syns:
                                            s = (s or "").strip()
                                            if s:
                                                records.append((tid, s))
                        
                                    for rec_chunk in _chunked(records, insert_batch):
                                        if not rec_chunk:
                                            continue
                                        df_chunk = pd.DataFrame(rec_chunk, columns=["training_id","question_syn"])
                                        insert_synonyms(conn, df_chunk)
                                        inserted_total += len(rec_chunk)
                        
                                    processed_q += len(batch_qs)
                                    progress.progress(
                                        min(1.0, processed_q / total_q),
                                        text=f"Processed {processed_q}/{total_q} questions • Inserted {inserted_total} synonyms"
                                    )
                        
                                st.success(f"✅ Inserted {inserted_total} synonyms for {processed_q} questions")
            except Exception as e:
                            st.error(f"❌ Failed to generate/store questions: {str(e)}")

    
    
    # Add a button to view the stored questions and synonyms
    if st.button("View Questions and Synonyms"):
        
        
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            try:
                st.markdown("<h1 style='text-align: left; font-size: 1.2rem;'>Current Training Questions</h1>", unsafe_allow_html=True)
                #st.subheader("Current Training Questions")
                q_df = fetch_training_data(conn)
                if not q_df.empty:
                    st.dataframe(q_df)
                else:
                    st.info("No training questions found. Please generate them first.")
                st.markdown("<h1 style='text-align: left; font-size: 1.2rem;'>Current Training Questions</h1>", unsafe_allow_html=True)
                #st.subheader("Current Training Synonyms")
                syn_df = fetch_training_synonym_data(conn)
                if not syn_df.empty:
                    st.dataframe(syn_df)
                else:
                    st.info("No synonyms found. Please generate them first.")

            except Exception as e:
                st.error(f"❌ Failed to fetch questions and synonyms: {e}")



# -------------------------
# TAB 3: Build Embeddings
# -------------------------
with tab3:
    st.markdown("<h1 style='text-align: left; font-size: 1.5rem;'>Generate & Store Embeddings</h1>", unsafe_allow_html=True)

    if st.button("Build Embeddings"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            q_df = fetch_training_data(conn)
            
            # Convert CLOBs to strings
            q_df['question'] = q_df['QUESTION'].apply(lambda x: x.read() if hasattr(x, 'read') else str(x))
            
            texts = q_df["question"].tolist()
            embeddings = model.encode(texts, convert_to_numpy=True)
            insert_embeddings(conn, q_df, embeddings, 'Quest')
            
            st.success(f"✅ Stored {len(texts)} embeddings into NL2SQL_EMBEDDINGS")

            q_df_syn = fetch_training_synonym_data(conn)
            
            # Convert CLOBs to strings
            q_df_syn['question_syn'] = q_df_syn['QUESTION_SYN'].apply(lambda x: x.read() if hasattr(x, 'read') else str(x))
            
            texts = q_df_syn["question_syn"].tolist()
            embeddings = model.encode(texts, convert_to_numpy=True)
            insert_embeddings(conn, q_df_syn, embeddings , 'Syn')
            
            st.success(f"✅ Stored {len(texts)} synonym embeddings into NL2SQL_EMBEDDINGS")

    # Add a button to view stored embeddings (excluding the large binary vector)
    if st.button("View Stored Embeddings"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            try:
                st.markdown("<h1 style='text-align: left; font-size: 1.2rem;'>Current Embeddings Data</h1>", unsafe_allow_html=True)
                #st.subheader("Current Embeddings Data")
                df = fetch_embeddings_from_db(conn)
                if not df.empty:
                    st.dataframe(df)
                else:
                    st.info("No embeddings found. Please build them first.")
            except Exception as e:
                st.error(f"❌ Failed to fetch embeddings data: {e}")

    if st.button("Rebuild Index"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            with st.spinner("Rebuilding in-memory index..."):
                refresh_embedding_index(conn)
            st.success("✅ Index rebuilt successfully!")


# -------------------------
# TAB 4: Evaluation
# -------------------------
with tab4:
    st.markdown("<h1 style='text-align: left; font-size: 1.5rem;'>Evaluate User Prompt → API Call Retrieval</h1>", unsafe_allow_html=True)

    user_prompt = st.text_area("Enter natural language query")
    k = st.slider("Top-K", 1, 10, 3)

    if st.button("Evaluate Prompt"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            q_emb = model.encode([user_prompt], convert_to_numpy=True)[0]
            results = search_embeddings_kdtree(conn, q_emb, top_k=k)
            st.subheader("Retrieved SQL Candidates")
            for r in results:
                st.markdown(f"**Q:** {r['question']} (Similarity: **{r['similarity']:.2f}**)")
                st.code(r["sql_template"], language="sql")

    st.markdown("---")
    st.header("Bulk Evaluation")

    if st.button("Run Bulk Evaluation"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            try:
                with st.spinner("Running bulk evaluation..."):
                    # Fetch evaluation prompts from a new Oracle table
                    eval_df = fetch_evaluation_prompts(conn)
                    total_runs = len(eval_df)
                    if total_runs == 0:
                        st.warning("No evaluation prompts found. Please populate the `NL2SQL_EVALUATION` table.")
                    else:
                        hits = 0
                        run_id = int(time.time()) # Use timestamp as a unique run ID
                        
                        # Loop through each evaluation prompt
                        for index, row in eval_df.iterrows():
                            prompt_id = row['ID']
                            prompt_text = row['PROMPT']
                            expected_sql = row['EXPECTED_SQL']

                            # Get top-k SQL candidates from the vector search
                            q_emb = model.encode([prompt_text], convert_to_numpy=True)[0]
                            results = search_embeddings_kdtree(conn, q_emb, top_k=5) # Using top_k=5 for evaluation

                            # Check if the expected SQL is in the top-k results
                            is_hit = any(res['sql_template'].strip().replace("'", '"').lower() == expected_sql.strip().replace("'", '"').lower() for res in results)
                            if is_hit:
                                hits += 1

                            # Log the result to the metrics table
                            insert_evaluation_metric(conn, run_id, prompt_id, is_hit)

                        hit_rate = (hits / total_runs) * 100
                        st.success(f"✅ Bulk evaluation complete. Total runs: {total_runs}, Hits: {hits}, Hit Rate: {hit_rate:.2f}%")
            except Exception as e:
                st.error(f"❌ Failed to run bulk evaluation: {e}")

    if st.button("View Evaluation Metrics"):
        conn = st.session_state.get("conn")
        if not conn:
            st.error("Not connected to Oracle")
        else:
            try:
                st.subheader("Evaluation Metrics Dashboard")
                metrics_df = fetch_evaluation_metrics(conn)
                if not metrics_df.empty:
                    # Calculate summary stats
                    total_runs = len(metrics_df)
                    total_hits = metrics_df['IS_HIT'].sum()
                    hit_rate_pct = (total_hits / total_runs) * 100 if total_runs > 0 else 0

                    col1, col2 = st.columns(2)
                    with col1:
                        st.metric(label="Total Evaluation Runs", value=total_runs)
                    with col2:
                        st.metric(label="Overall Hit Rate", value=f"{hit_rate_pct:.2f}%")

                    st.dataframe(metrics_df.sort_values(by='RUN_ID', ascending=False))
                else:
                    st.info("No evaluation metrics found. Please run a bulk evaluation first.")
            except Exception as e:
                st.error(f"❌ Failed to fetch evaluation metrics: {e}")
