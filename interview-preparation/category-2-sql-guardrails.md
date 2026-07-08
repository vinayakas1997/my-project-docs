# Category 2: SQL Security Guardrails

---

## Q7: Explain the 3 layers of your SQL guardrail. Why 3 layers instead of 1?

**Answer:**

```
Layer 1: Regex Pre-screen    (~0.1ms) — Fast rejection of obvious threats
Layer 2: AST Structural      (~5ms)   — Deep structural verification via sqlglot
Layer 3: AST LIMIT Guard     (injxn)  — Injects hard row cap at AST level
```

**Layer 1 — Regex Pre-screen:**
- Scans for `;` followed by SQL keywords (multi-statement attack: `SELECT 1; DROP TABLE users`)
- Scans for `MUTATION_PATTERN` — `(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|GRANT|REVOKE|CREATE)`
- Purpose: **cheap and fast**. Blocks 80% of common attacks in <0.1ms. No reason to pay the cost of AST parsing for trivial threats.

**Layer 2 — AST Structural (sqlglot):**
- Parses the SQL into an Abstract Syntax Tree using `sqlglot`
- Verifies the root node is `exp.Select` (or `exp.Union`/`exp.With` wrapping a Select)
- Walks the entire tree with `find_all(exp.Expression)` — recursively checks every single node, no matter how deep, for forbidden nodes like `exp.Insert`, `exp.Update`, `exp.Delete`, `exp.Drop`, `exp.Create`, `exp.Alter`
- Returns the parsed AST for downstream reuse — avoids re-parsing

**Layer 3 — AST LIMIT Guard:**
- Not a security check per se — a **safety bound**. Injects a hard row cap (default 500) at the AST tree level, not via string concatenation
- Handles edge cases: existing LIMIT (respected unless >500), CTEs (`WITH...SELECT` — Common Table Expression, a temporary named query result), UNION queries
- String-level `+ "LIMIT 500"` breaks on CTEs and subqueries — AST-level injection handles all SQL structures correctly

**Why 3 layers instead of 1?**
- **Defense-in-depth.** Each layer catches what the previous one misses
- Regex misses nested/CTE mutations (Q8 explains this)
- AST catches structure but doesn't bound output — Layer 3 prevents accidental Cartesian products from consuming all DB resources
- Performance: Layer 1 filters 80% instantly, so only 20% of queries pay the AST parsing tax

### What the interviewer is testing
Security mindset — do you build layered defenses or rely on a single check?

---

## Q8: Give me a query that passes regex but fails AST

**Answer:**

```sql
WITH nuke AS (
  DELETE FROM expired_logs WHERE timestamp < '2023-01-01'
)
SELECT count(*) FROM nuke;
```

**Regex sees:** The string starts with `WITH...SELECT` — looks safe. Checks for mutation keywords at the top level — doesn't find any. **PASSES.**

**AST sees:** Walks the full tree with `find_all(exp.Expression)`:
- `exp.With` at root — looks ok
- Inside the CTE body, finds `exp.Delete` — **BLOCKED.**

**Another example — subquery injection:**
```sql
SELECT * FROM (
  INSERT INTO malicious_table VALUES (1) RETURNING *
) AS sub
```

**Regex:** Sees `SELECT * FROM (...)` — safe on surface. **PASSES.**
**AST:** Finds `exp.Insert` nested inside the subquery. **BLOCKED.**

### What the interviewer is testing
Understanding the fundamental limitation of regex — it operates on strings, not structure. SQL is a nested language; only a parser can understand nesting.

---

## Q9: Give me a query that passes both regex and AST but is still dangerous

**Answer:**

```sql
SELECT a.*, b.* FROM sensor_logs a CROSS JOIN maintenance_tickets b
```

or even worse — a hidden Cartesian product:

```sql
SELECT * FROM sensor_logs, maintenance_tickets, user_accounts, purchase_orders
```

**Regex:** Pure SELECT. No mutation keywords. **PASSES.**
**AST:** Pure SELECT at root, no forbidden nodes in the tree. **PASSES.**

**Why it's dangerous:** This query joins 4 large tables without any WHERE condition — it could return **billions of rows**, consuming all database memory, locking tables, and potentially crashing the production database.

**Layer 3 (LIMIT Guard) catches this:** `apply_limit_guardrail()` injects `LIMIT 500` at the AST level. The query is bounded to at most 500 rows, regardless of the implicit Cartesian product.

### What the interviewer is testing
Threat modeling breadth — you understand that not all dangers are about data modification. Resource exhaustion is just as dangerous in production.

### Follow-up prep
- "How about `pg_sleep(100)` or `COPY TO '/tmp/exploit.csv'`?" — These are command/denial-of-service attacks embedded in SELECT queries. My current guardrails don't catch them. I'd extend Layer 2 with additional node-type checks for `exp.Copy`, `exp.Func` with dangerous function names, and add a query timeout at the database connection level.

---

## Q10: Why `sqlglot` instead of just regex?

**Answer:**

| Aspect | Regex | sqlglot AST |
|---|---|---|
| Understands nesting | No | Yes |
| Handles CTEs | No | Yes |
| Detects mutations in subqueries | No | Yes |
| Handles different SQL dialects | No | Yes (MySQL, Postgres, BigQuery, etc.) |
| Produces reusable structure | No (just string match) | Yes (returns AST for downstream use) |
| Speed | ~0.1ms | ~5ms |
| Maintenance | Pattern grows brittle | Add node types to forbidden set |

**Real example:** A developer writes a CTE with a DELETE inside. Regex looking for `DELETE` would need to handle `q2: (WITH.*DELETE|DELETE.*SELECT)` — the pattern quickly becomes unmaintainable. With sqlglot, I just add `exp.Delete` to the `forbidden_nodes` set — done.

**sqlglot also gives me:** SQL generation (I modify the AST and regenerate SQL for the LIMIT guard), cross-dialect support (the same code works for Postgres and MySQL), and no dependencies on a specific database server.

### What the interviewer is testing
Tool selection judgment — did you choose the right tool for the problem, or the most familiar one?

---

## Q11: Your LIMIT guard injects at the AST level. Why not just append `LIMIT 500` to the string?

**Answer:**

Simple string append breaks on:

**1. CTEs:**
```sql
WITH cte AS (SELECT * FROM logs)
SELECT * FROM cte ORDER BY timestamp
```
- String append: `WITH cte AS (SELECT * FROM logs) SELECT * FROM cte ORDER BY timestamp LIMIT 500` — this works by luck, but feels fragile.

**2. UNION queries:**
```sql
SELECT name FROM employees UNION SELECT name FROM contractors
```
- String append: `SELECT name FROM employees UNION SELECT name FROM contractors LIMIT 500` — which branch gets the LIMIT? PostgreSQL applies LIMIT to the entire UNION, so this works. But it's unclear.

**3. Existing LIMIT:**
```sql
SELECT * FROM sensor_logs LIMIT 50000
```
- String append: `SELECT * FROM sensor_logs LIMIT 50000 LIMIT 500` — **SYNTAX ERROR.** Two LIMIT clauses.
- AST approach: Checks `existing_limit`, sees it's 50000 > 500, overrides it to 500. Correct.

**4. Subqueries with LIMIT:**
```sql
SELECT * FROM (SELECT * FROM logs LIMIT 100) AS recent
```
- String append appends to the end — affects outer query, not inner. Different semantics.
- AST approach: Applies to the outermost SELECT, which is what you want.

### What the interviewer is testing
Edge case thinking — did you handle the common cases or did you handle ALL cases?
