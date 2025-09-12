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
                "List everything in {table_name}",
                "Retrieve all rows in {table_name}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name}"
        },
        {
            "nl_patterns": [
                "Show me the {columns} from {table_name}",
                "List all {columns} in {table_name}",
                "Retrieve {columns} from {table_name}",
            ],
            "sql_template": "SELECT {columns} FROM {schema_name}.{table_name}"
        },
    ],
    
    # COUNT and Aggregation
    "count_and_aggregate": [
        {
            "nl_patterns": [
                "How many records are in {table_name}?",
                "Give me the total number of rows in {table_name}",
                "Count the number of entries in {table_name}",
            ],
            "sql_template": "SELECT COUNT(*) FROM {schema_name}.{table_name}"
        },
        {
            "nl_patterns": [
                "How many unique {column} values are there in {table_name}?",
                "Count the distinct {column} entries in {table_name}",
            ],
            "sql_template": "SELECT COUNT(DISTINCT {column}) FROM {schema_name}.{table_name}",
            "requires_unique": True
        },
        {
            "nl_patterns": [
                "What is the total of {aggregate_column} in {table_name}?",
                "Sum {aggregate_column} from all records in {table_name}",
            ],
            "sql_template": "SELECT SUM({aggregate_column}) FROM {schema_name}.{table_name}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
        {
            "nl_patterns": [
                "What is the average {aggregate_column} in {table_name}?",
                "Show the mean {aggregate_column} from {table_name}",
            ],
            "sql_template": "SELECT AVG({aggregate_column}) FROM {schema_name}.{table_name}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
        {
            "nl_patterns": [
                "What is the maximum {aggregate_column} in {table_name}?",
                "Find the highest {aggregate_column} in {table_name}",
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
                "List the distinct {column} entries from {table_name}",
                "What are the different {column} values in {table_name}?"
            ],
            "sql_template": "SELECT DISTINCT {column} FROM {schema_name}.{table_name}"
        }
    ],

    # Filtering with WHERE clauses
    "filter": [
        {
            "nl_patterns": [
                "Show all {table_name} where {column} is {value}",
                "List {table_name} entries with {column} equal to {value}",
                "Find records in {table_name} where {column} is {value}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} WHERE {column} = {value}",
        },
        {
            "nl_patterns": [
                "Find {table_name} where {column} is greater than {value}",
                "Show entries in {table_name} with {column} above {value}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} WHERE {column} > {value}",
            "requires_numeric": True
        },
        {
            "nl_patterns": [
                "Find records in {table_name} where {column} starts with {value}",
                "Show all {table_name} where {column} is like {value}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} WHERE {column} LIKE '{value}%'",
            "requires_string": True
        },
        {
            "nl_patterns": [
                "Find records in {table_name} where {column} contains {value}",
                "Show all {table_name} where {column} has the word {value}",
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
                "How many entries are there for each {group_column} in {table_name}?",
            ],
            "sql_template": "SELECT {group_column}, COUNT(*) FROM {schema_name}.{table_name} GROUP BY {group_column}",
            "can_group_by_id": False
        },
        {
            "nl_patterns": [
                "What is the total of {aggregate_column} for each {group_column} in {table_name}?",
                "Sum {aggregate_column} for each {group_column} from {table_name}",
            ],
            "sql_template": "SELECT {group_column}, SUM({aggregate_column}) FROM {schema_name}.{table_name} GROUP BY {group_column}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
        {
            "nl_patterns": [
                "What is the total of {aggregate_column} for each {group_column} in {table_name} with the total above {value}?",
                "Sum {aggregate_column} for each {group_column} from {table_name} where the sum is greater than {value}",
            ],
            "sql_template": "SELECT {group_column}, SUM({aggregate_column}) FROM {schema_name}.{table_name} GROUP BY {group_column} HAVING SUM({aggregate_column}) > {value}",
            "requires_numeric": True,
            "can_aggregate_id": False
        },
        {
            "nl_patterns": [
                "List all {table_name} and order by {column}",
                "Show all records from {table_name} sorting by {column}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} ORDER BY {column}"
        },
    ],
    
    # ORDER BY and LIMIT
    "order_by": [
        {
            "nl_patterns": [
                "Show the top {limit} records from {table_name} by {column}",
                "List the {limit} highest {column} values from {table_name}",
            ],
            "sql_template": "SELECT * FROM {schema_name}.{table_name} ORDER BY {column} DESC FETCH FIRST {limit} ROWS ONLY"
        },
    ],
    
    # Simple JOINs
    "simple_join": [
        {
            "nl_patterns": [
                "Show {t1_column} and {t2_column} by joining {t1_name} and {t2_name}",
                "List all records from {t1_name} and {t2_name} where {t1_name}.{join_col} = {t2_name}.{join_col}",
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
        all_cols = [c["name"] for c in table["columns"]]
        pk_cols = [c["name"] for c in table["columns"] if c["sql_type"] == "PK"]
        string_cols = [c["name"] for c in table["columns"] if c["type"] in ["VARCHAR2", "CHAR"]]
        numeric_cols = [c["name"] for c in table["columns"] if c["type"] in ["NUMBER", "INTEGER", "DECIMAL"]]
        
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
                
                # Generate a few variations for each template
                for _ in range(3): 
                    try:
                        params = {}
                        
                        # Common parameters
                        params["schema_name"] = schema
                        params["table_name"] = tname

                        # Select a random column based on template requirements
                        if template_group in ["select", "order_by", "distinct"]:
                            params["column"] = random.choice(all_cols)
                            # For select with columns, pick two random ones
                            if "columns" in sql_template:
                                params["columns"] = ", ".join(random.sample(all_cols, min(2, len(all_cols))))
                        
                        if template_group == "count_and_aggregate":
                            if "requires_numeric" in template_data:
                                # Avoid aggregating on ID columns
                                valid_cols = [c for c in numeric_cols if c not in pk_cols]
                                if not valid_cols: continue
                                params["aggregate_column"] = random.choice(valid_cols)
                            elif "requires_unique" in template_data:
                                # Use a PK column for a distinct count
                                params["column"] = random.choice(pk_cols) if pk_cols else random.choice(all_cols)
                            
                        if template_group == "filter":
                            if "requires_numeric" in template_data:
                                col_for_value = random.choice(numeric_cols)
                                params["column"] = col_for_value
                            elif "requires_string" in template_data:
                                col_for_value = random.choice(string_cols)
                                params["column"] = col_for_value
                            else: # For equals, any column is fine
                                col_for_value = random.choice(table["columns"])
                                params["column"] = col_for_value["name"]

                            # Populate value parameter
                            if col_for_value["name"] in sample_values:
                                params["value"] = random.choice(sample_values[col_for_value["name"]])
                                # For string values in SQL, add quotes
                                if col_for_value["type"] in ["VARCHAR2", "CHAR"]:
                                    params["value"] = f"'{params['value']}'"
                            else:
                                params["value"] = "{" + col_for_value["name"] + "}"

                        if template_group == "group_by":
                            params["group_column"] = random.choice(all_cols)
                            if "can_group_by_id" in template_data and params["group_column"] in pk_cols:
                                continue # Skip grouping on IDs
                            if "requires_numeric" in template_data:
                                valid_agg_cols = [c for c in numeric_cols if c not in pk_cols]
                                if not valid_agg_cols: continue
                                params["aggregate_column"] = random.choice(valid_agg_cols)
                            if "value" in sql_template:
                                params["value"] = random.randint(1000, 25000)
                        
                        # LIMIT parameter
                        if "limit" in sql_template:
                            params["limit"] = random.randint(5, 20)
                            
                        # JOIN parameters
                        if "requires_joinable" in template_data:
                            join_info = random.choice(joinables)
                            params["t1_schema"] = schema
                            params["t1_name"] = tname
                            params["t2_schema"] = join_info["t2_schema"]
                            params["t2_name"] = join_info["t2_name"]
                            params["join_col"] = join_info["join_col"]
                            
                            params["t1_column"] = random.choice(all_cols)
                            t2_cols = [c["name"] for c in [t for t in tables if t["table_name"] == join_info["t2_name"]][0]["columns"]]
                            params["t2_column"] = random.choice(t2_cols)
                            
                        
                        # Populate the templates
                        nl_question = random.choice(nl_patterns).format(**params)
                        sql_query = sql_template.format(**params)
                        
                        all_questions.append({
                            "schema_name": schema,
                            "table_name": tname,
                            "question": nl_question,
                            "sql_template": sql_query
                        })
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
