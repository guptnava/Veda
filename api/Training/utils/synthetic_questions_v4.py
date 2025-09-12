# utils/synthetic_questions.py

import random

# A comprehensive set of question templates and their corresponding SQL patterns.
# Placeholders like {table}, {column}, {value}, etc., will be replaced with actual
# schema information during generation. The templates are grouped by function.
COMPREHENSIVE_TEMPLATES = {
    # Basic SELECT statements
    "select": [
        {
            "nl_patterns": [
                "Show all records from {table_name}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name}"
        },
        {
            "nl_patterns": [
                "Show me the {columns} from {table_name}",
            ],
            "sql_template": "SELECT {columns} FROM {schema_name}.{table_name}"
        },
    ],

    # COUNT and Aggregation
    "count_and_aggregate": [
        {
            "nl_patterns": [
                "How many records are in {table_name}?",
            ],
            "sql_template": "SELECT COUNT(*) FROM {schema_name}.{table_name}"
        },
        {
            "nl_patterns": [
                "How many unique {column} values are there in {table_name}?",
            ],
            "sql_template": "SELECT COUNT(DISTINCT {column}) FROM {schema_name}.{table_name}",
            "requires_unique": True
        },
        {
            "nl_patterns": [
                "What is the total of {aggregate_column} in {table_name}?",
            ],
            "sql_template": "SELECT SUM({aggregate_column}) FROM {schema_name}.{table_name}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
        {
            "nl_patterns": [
                "What is the average {aggregate_column} in {table_name}?",
            ],
            "sql_template": "SELECT AVG({aggregate_column}) FROM {schema_name}.{table_name}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
        {
            "nl_patterns": [
                "What is the maximum {aggregate_column} in {table_name}?",
            ],
            "sql_template": "SELECT MAX({aggregate_column}) FROM {schema_name}.{table_name}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
    ],

    # Distinct values
    "distinct": [
        {
            "nl_patterns": [
                "Show the unique values of {column} in {table_name}",
            ],
            "sql_template": "SELECT DISTINCT {column} FROM {schema_name}.{table_name}"
        }
    ],

    # Filtering with WHERE clauses
    "filter": [
        {
            "nl_patterns": [
                "Show all {table_name} where {column} is {value}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} WHERE {column} = {value}",
        },
        {
            "nl_patterns": [
                "Find {table_name} where {column} is greater than {value}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} WHERE {column} > {value}",
            "requires_numeric": True
        },
        {
            "nl_patterns": [
                "Find records in {table_name} where {column} starts with {value}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} WHERE {column} LIKE '{value}%'",
            "requires_string": True
        },
        {
            "nl_patterns": [
                "Find records in {table_name} where {column} contains {value}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} WHERE {column} LIKE '%{value}%'",
            "requires_string": True
        },
    ],

    # GROUP BY and aggregation
    "group_by": [
        {
            "nl_patterns": [
                "Count {table_name} grouped by {group_column}",
            ],
            "sql_template": "SELECT {group_column}, COUNT(*) FROM {schema_name}.{table_name} GROUP BY {group_column}",
            "can_group_by_id": False
        },
        {
            "nl_patterns": [
                "What is the total of {aggregate_column} for each {group_column} in {table_name}?",
            ],
            "sql_template": "SELECT {group_column}, SUM({aggregate_column}) FROM {schema_name}.{table_name} GROUP BY {group_column}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
        {
            "nl_patterns": [
                "What is the total of {aggregate_column} for each {group_column} in {table_name} with the total above {value}?",
            ],
            "sql_template": "SELECT {group_column}, SUM({aggregate_column}) FROM {schema_name}.{table_name} GROUP BY {group_column} HAVING SUM({aggregate_column}) > {value}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
    ],

    # ORDER BY and LIMIT
    "order_by": [
        {
            "nl_patterns": [
                "Show the top {limit} records from {table_name} by {column}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} ORDER BY {column} DESC FETCH FIRST {limit} ROWS ONLY"
        },
         {
            "nl_patterns": [
                "List all {table_name} and order by {column}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} ORDER BY {column}"
        },
    ],

    # Simple JOINs
    "simple_join": [
        {
            "nl_patterns": [
                "Show {t1_column} and {t2_column} by joining {t1_name} and {t2_name}",
            ],
            "sql_template": "SELECT T1.{t1_column}, T2.{t2_column} FROM {t1_schema}.{t1_name} T1 JOIN {t2_schema}.{t2_name} T2 ON T1.{join_col} = T2.{join_col}",
            "requires_joinable": True
        }
    ]
}


def generate_questions(tables: list, sample_values: dict = None) -> list[dict]:
    """
    Generate comprehensive NL->SQL questions for given tables and their schema.

    Args:
        tables: List of table dicts, each with keys:
                schema_name, table_name, columns (list of dicts with 'name', 'type', and 'sql_type').
        sample_values: A dictionary mapping column names to sample values.

    Returns:
        List of dicts with keys: schema_name, table_name, question, sql_template
    """
    all_questions = []
    sample_values = sample_values or {}

    # Helper function to find joinable tables and columns
    def find_joinable(t1):
        joinable = []
        for t2 in tables:
            if t1["table_name"] != t2["table_name"]:
                for col1 in t1["columns"]:
                    for col2 in t2["columns"]:
                        # Check for a foreign key relationship
                        if col1["sql_type"] == "PK" and col2["sql_type"] == "FK" and col1["name"] == col2["name"]:
                            joinable.append({
                                "t2_schema": t2["schema_name"],
                                "t2_name": t2["table_name"],
                                "join_col": col1["name"]
                            })
                            break
                        # Check for same-named columns (simple heuristic)
                        elif col1["name"].lower() == col2["name"].lower():
                             joinable.append({
                                "t2_schema": t2["schema_name"],
                                "t2_name": t2["table_name"],
                                "join_col": col1["name"]
                            })
            if joinable:
                break
        return joinable

    for table in tables:
        schema = table["schema_name"]
        tname = table["table_name"]

        # Categorize columns for easier template matching
        all_cols = [c for c in table["columns"]] # Keep as dictionaries
        pk_cols = [c for c in table["columns"] if c["sql_type"] == "PK"] # Keep as dictionaries
        string_cols = [c for c in table["columns"] if c["type"] in ["VARCHAR2", "CHAR"]] # Keep as dictionaries
        numeric_cols = [c for c in table["columns"] if c["type"] in ["NUMBER", "INTEGER", "DECIMAL"]] # Keep as dictionaries
        non_pk_fk_cols = [c for c in table["columns"] if c["sql_type"] not in ["PK", "FK"]] # Columns that are not PK or FK


        if not all_cols:
            continue

        # Generate questions for each template type
        for template_group, templates in COMPREHENSIVE_TEMPLATES.items():
            for template_data in templates:
                nl_patterns = template_data["nl_patterns"]
                sql_template = template_data["sql_template"]

                # Check for required column types or relationships
                if "requires_numeric" in template_data and not numeric_cols:
                    continue
                if "requires_string" in template_data and not string_cols:
                    continue
                if "requires_joinable" in template_data:
                    joinables = find_joinable(table)
                    if not joinables:
                        continue
                if "requires_unique" in template_data and not pk_cols:
                    continue

                # Remove the loop that generates multiple variations
                try:
                    params = {}

                    # Common parameters
                    params["schema_name"] = schema
                    params["table_name"] = tname

                    # Select a random column based on template requirements
                    if template_group in ["select", "order_by"]:
                        # Ensure all columns are covered where applicable
                        if "columns" in sql_template:
                             for i in range(1, min(len(all_cols) + 1, 4)):  # Generate queries for 1, 2, or 3 columns
                                 params["columns"] = ", ".join([c["name"] for c in random.sample(all_cols, i)])
                                 nl_question = random.choice(nl_patterns).format(**params)
                                 sql_query = sql_template.format(**params)
                                 all_questions.append({
                                     "schema_name": schema,
                                     "table_name": tname,
                                     "question": nl_question,
                                     "sql_template": sql_query
                                 })
                             continue # Skip the rest of the template processing for this case
                        else:
                            col_info = random.choice(all_cols)
                            params["column"] = col_info["name"]


                    elif template_group == "distinct":
                         # Select a random non-PK/FK column for distinct
                         if not non_pk_fk_cols: continue
                         # Iterate through all non-PK/FK columns
                         for col_info in non_pk_fk_cols:
                            params["column"] = col_info["name"]
                            nl_question = random.choice(nl_patterns).format(**params)
                            sql_query = sql_template.format(**params)
                            all_questions.append({
                                "schema_name": schema,
                                "table_name": tname,
                                "question": nl_question,
                                "sql_template": sql_query
                            })
                         continue


                    if template_group == "count_and_aggregate":
                        if "requires_numeric" in template_data:
                            # Avoid aggregating on ID columns (PK or FK)
                            valid_cols = [c for c in numeric_cols if c["sql_type"] not in ["PK", "FK"]]
                            if not valid_cols: continue
                            # Iterate through all valid numeric columns
                            for col_info in valid_cols:
                                params["aggregate_column"] = col_info["name"] # Get the name
                                nl_question = random.choice(nl_patterns).format(**params)
                                sql_query = sql_template.format(**params)
                                all_questions.append({
                                    "schema_name": schema,
                                    "table_name": tname,
                                    "question": nl_question,
                                    "sql_template": sql_query
                                })
                            continue
                        elif "requires_unique" in template_data:
                            # Use a PK column for a distinct count
                            params["column"] = random.choice(pk_cols)["name"] if pk_cols else random.choice(all_cols)["name"] # Get the name


                    if template_group == "filter":
                        # Iterate through all applicable columns for filtering
                        applicable_cols = []
                        if "requires_numeric" in template_data:
                            applicable_cols = [c for c in table["columns"] if c["type"] in ["NUMBER", "INTEGER", "DECIMAL"]]
                        elif "requires_string" in template_data:
                            applicable_cols = [c for c in table["columns"] if c["type"] in ["VARCHAR2", "CHAR"]]
                        else:
                             applicable_cols = table["columns"]

                        if not applicable_cols: continue

                        for col_for_value in applicable_cols:
                            params["column"] = col_for_value["name"]

                            # Always use a placeholder for the value
                            params["value"] = "{" + col_for_value["name"] + "}"

                            nl_question = random.choice(nl_patterns).format(**params)
                            sql_query = sql_template.format(**params)
                            all_questions.append({
                                "schema_name": schema,
                                "table_name": tname,
                                "question": nl_question,
                                "sql_template": sql_query
                            })
                        continue


                    if template_group == "group_by":
                        # Iterate through all valid grouping columns
                        valid_group_cols = [c for c in all_cols if not ("can_group_by_id" in template_data and c["sql_type"] == "PK")]
                        if not valid_group_cols: continue

                        for group_col_info in valid_group_cols:
                            params["group_column"] = group_col_info["name"]
                            if "requires_numeric" in template_data:
                                # Avoid aggregating on ID columns (PK or FK)
                                valid_agg_cols = [c for c in numeric_cols if c["sql_type"] not in ["PK", "FK"]]
                                if not valid_agg_cols: continue
                                # Iterate through all valid aggregation columns for this group_by
                                for agg_col_info in valid_agg_cols:
                                     params["aggregate_column"] = agg_col_info["name"] # Get the name
                                     if "value" in sql_template:
                                         # Always use a placeholder for the value
                                         params["value"] = "{AGGREGATE_VALUE}"
                                     nl_question = random.choice(nl_patterns).format(**params)
                                     sql_query = sql_template.format(**params)
                                     all_questions.append({
                                         "schema_name": schema,
                                         "table_name": tname,
                                         "question": nl_question,
                                         "sql_template": sql_query
                                     })
                            else:
                                if "value" in sql_template:
                                     # Always use a placeholder for the value
                                     params["value"] = "{AGGREGATE_VALUE}"
                                nl_question = random.choice(nl_patterns).format(**params)
                                sql_query = sql_template.format(**params)
                                all_questions.append({
                                    "schema_name": schema,
                                    "table_name": tname,
                                    "question": nl_question,
                                    "sql_template": sql_query
                                })
                        continue

                    # ORDER BY and LIMIT parameters
                    if template_group == "order_by":
                         # Iterate through all columns for ordering
                         for col_info in all_cols:
                            params["column"] = col_info["name"]
                            if "limit" in sql_template:
                                params["limit"] = "{LIMIT}"
                            nl_question = random.choice(nl_patterns).format(**params)
                            sql_query = sql_template.format(**params)
                            all_questions.append({
                                "schema_name": schema,
                                "table_name": tname,
                                "question": nl_question,
                                "sql_template": sql_query
                            })
                         continue


                    # JOIN parameters
                    if "requires_joinable" in template_data:
                         joinables = find_joinable(table)
                         if not joinables: continue
                         for join_info in joinables:
                             params["t1_schema"] = schema
                             params["t1_name"] = tname
                             params["t2_schema"] = join_info["t2_schema"]
                             params["t2_name"] = join_info["t2_name"]
                             params["join_col"] = join_info["join_col"]

                             # Iterate through all column combinations for the join
                             t2_cols_info = [c for t in tables if t["table_name"] == join_info["t2_name"] for c in t["columns"]]
                             for t1_col_info in all_cols:
                                 for t2_col_info in t2_cols_info:
                                     params["t1_column"] = t1_col_info["name"]
                                     params["t2_column"] = t2_col_info["name"]
                                     nl_question = random.choice(nl_patterns).format(**params)
                                     sql_query = sql_template.format(**params)
                                     all_questions.append({
                                         "schema_name": schema,
                                         "table_name": tname,
                                         "question": nl_question,
                                         "sql_template": sql_query
                                     })
                         continue


                    # For templates that don't require specific columns or joins,
                    # generate a question once per table.
                    if template_group in ["select", "count_and_aggregate"] and "column" not in sql_template and "columns" not in sql_template and "aggregate_column" not in sql_template:
                         nl_question = random.choice(nl_patterns).format(**params)
                         sql_query = sql_template.format(**params)
                         all_questions.append({
                             "schema_name": schema,
                             "table_name": tname,
                             "question": nl_question,
                             "sql_template": sql_query
                         })
                         continue


                except (KeyError, ValueError, IndexError) as e:
                    # Print a helpful error message but continue with generation
                    print(f"Skipping question generation for template group '{template_group}' due to missing data: {e}")
                    continue

    return all_questions


if __name__ == '__main__':
    # Mock schema data to demonstrate the script's functionality
    # 'sql_type' is added to explicitly identify PK and FK columns
    mock_schema = [
        {
            "schema_name": "HR",
            "table_name": "EMPLOYEES",
            "columns": [
                {"name": "EMPLOYEE_ID", "type": "NUMBER", "sql_type": "PK"},
                {"name": "FIRST_NAME", "type": "VARCHAR2", "sql_type": "COL"},
                {"name": "LAST_NAME", "type": "VARCHAR2", "sql_type": "COL"},
                {"name": "EMAIL", "type": "VARCHAR2", "sql_type": "COL"},
                {"name": "SALARY", "type": "NUMBER", "sql_type": "COL"},
                {"name": "DEPARTMENT_ID", "type": "NUMBER", "sql_type": "FK"},
                {"name": "HIRE_DATE", "type": "DATE", "sql_type": "COL"},
            ]
        },
        {
            "schema_name": "HR",
            "table_name": "DEPARTMENTS",
            "columns": [
                {"name": "DEPARTMENT_ID", "type": "NUMBER", "sql_type": "PK"},
                {"name": "DEPARTMENT_NAME", "type": "VARCHAR2", "sql_type": "COL"},
            ]
        },
    ]

    # Mock sample values for certain columns
    mock_sample_values = {
        "LAST_NAME": ["King", "Kochhar", "De Haan"],
        "SALARY": [10000, 15000, 20000],
        "DEPARTMENT_NAME": ["IT", "Sales", "Marketing"],
    }

    generated_data = generate_questions(mock_schema, mock_sample_values)

    for item in generated_data:
        print(f"Question: {item['question']}")
        print(f"SQL: {item['sql_template']}\n")