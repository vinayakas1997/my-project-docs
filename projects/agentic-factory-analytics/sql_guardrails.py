"""
sql_guardrails.py

Defense-in-depth pipeline for validating and safely bounding LLM-generated SQL
before execution against a production database.

Layers:
  1. Regex pre-screen      - fast rejection of multi-statement / mutation keywords
  2. AST structural check  - sqlglot-based verification that the query is a pure SELECT
  3. AST-based LIMIT guard - injects a hard row cap at the tree level (not string level)
     to prevent Cartesian-product / unbounded-JOIN memory blowups
"""

import re
import sqlglot
from sqlglot import exp


# ---------------------------------------------------------------------------
# Layer 1: Regex Guardrail
# ---------------------------------------------------------------------------
def regex_security_check(sql_query: str) -> bool:
    """Pre-screens SQL string for statement chaining or destructive keywords."""

    if re.search(r";\s*\w+", sql_query):
        print("SECURITY ALERT: Multi-statement query detected!")
        return False

    MUTATION_PATTERN = r"\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)\b"
    if re.search(MUTATION_PATTERN, sql_query, re.IGNORECASE):
        print("SECURITY ALERT: Destructive command detected in string!")
        return False

    return True


# ---------------------------------------------------------------------------
# Layer 2: AST Structural Guardrail
# ---------------------------------------------------------------------------
def ast_security_check(sql_query: str):
    """
    Parses SQL into an AST and verifies read-only intent.

    Returns the parsed AST on success (so downstream steps don't have to
    re-parse), or None if the query fails validation.
    """
    try:
        parsed_ast = sqlglot.parse_one(sql_query)

        # CTEs and UNIONs can wrap a Select without the root node itself
        # being exp.Select, so check the "true" query type via find().
        root_select = parsed_ast if isinstance(parsed_ast, exp.Select) else None
        if root_select is None and isinstance(parsed_ast, (exp.Union, exp.With)):
            # Still fine as long as every underlying statement is a SELECT —
            # fall through to the node scan below to confirm no mutations.
            root_select = parsed_ast
        if root_select is None:
            print(f"SECURITY ALERT: AST Root node is {type(parsed_ast).__name__}, not read-only.")
            return None

        forbidden_nodes = (exp.Insert, exp.Update, exp.Delete, exp.Drop, exp.Create, exp.Alter)
        for node in parsed_ast.find_all(exp.Expression):
            if isinstance(node, forbidden_nodes):
                print(f"SECURITY ALERT: Found forbidden node in AST: {type(node).__name__}")
                return None

        return parsed_ast

    except sqlglot.errors.ParseError as e:
        print(f"SECURITY ALERT: Invalid SQL Syntax! {e}")
        return None


# ---------------------------------------------------------------------------
# Layer 3: AST-based Execution Limit Guardrail
# ---------------------------------------------------------------------------
def apply_limit_guardrail(parsed_ast: exp.Expression, max_rows: int = 500) -> str:
    """
    Injects a hard row cap at the AST level rather than via string concatenation.

    Handles the cases naive string appending breaks on:
      - existing LIMIT (respected, not overridden, unless it exceeds max_rows)
      - CTEs (`WITH ... SELECT`) - limit applied to the outer/final select
      - UNION queries - limit applied to the overall result, not one branch
    """
    # Find the outermost select-like expression to attach/inspect the limit on.
    target = parsed_ast

    existing_limit = target.args.get("limit")
    if existing_limit is not None:
        try:
            current_val = int(existing_limit.expression.this)
            if current_val > max_rows:
                target.set("limit", exp.Limit(expression=exp.Literal.number(max_rows)))
        except (AttributeError, ValueError):
            # Non-literal limit expression (rare) - overwrite defensively.
            target.set("limit", exp.Limit(expression=exp.Literal.number(max_rows)))
    else:
        target.set("limit", exp.Limit(expression=exp.Literal.number(max_rows)))

    return target.sql()


# ---------------------------------------------------------------------------
# Combined Executor
# ---------------------------------------------------------------------------
def safe_sql_executor(generated_sql: str, max_rows: int = 500) -> str:
    if not regex_security_check(generated_sql):
        return "ERROR: Query rejected by Regex Security Guardrail."

    parsed_ast = ast_security_check(generated_sql)
    if parsed_ast is None:
        return "ERROR: Query rejected by AST Security Guardrail."

    bounded_sql = apply_limit_guardrail(parsed_ast, max_rows=max_rows)

    print(f"✅ Query PASSED all security layers. Executing safely...\n   -> {bounded_sql}")
    # execute_query(bounded_sql) ...
    return "Query executed successfully."


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(safe_sql_executor(
        "SELECT name, status FROM factory_logs WHERE temperature > 80"
    ))

    print(safe_sql_executor(
        "SELECT * FROM factory_logs; DROP TABLE factory_logs;"
    ))

    print(safe_sql_executor(
        "SELECT a.line_id, b.ticket_id FROM sensor_logs a CROSS JOIN maintenance_tickets b"
    ))

    print(safe_sql_executor(
        "SELECT * FROM sensor_logs LIMIT 50000"
    ))