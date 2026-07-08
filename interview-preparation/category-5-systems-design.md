# Category 5: Systems Design & Full-Stack

---

## Q20: Design a system that lets non-technical users query a 200-table PostgreSQL database in plain English — you've essentially built this as EDAS

**Answer:**

I already built this — it's EDAS. But here's how I'd present the design from scratch:

**Core insight:** The challenge isn't building an LLM agent. It's making the LLM understand the schema well enough to generate correct SQL without hallucinating.

**Architecture:**

1. **Schema Understanding Layer:**
   - Store the full database schema in a lookup table (not in the LLM prompt)
   - Build a **Dynamic Schema Fetcher** — when a user asks a question, semantically match their query to the relevant tables/columns
   - Inject only the relevant schema subset (5-10 tables) into the Planner's context window — not all 200 tables

2. **Multi-Agent Pipeline:**
   - **Manager:** Conversation agent. Fills slots (entity, time range, metric). Validates entity names against a catalog. Confirms before executing.
   - **Planner:** Given the schema subset and the user's aim, produces a query plan: table joins, filters, aggregations, time bounds.
   - **Executor:** Generates SQL from the plan, runs through guardrail pipeline, executes against database with bounded result set.

3. **Security (non-negotiable for production):**
   - Layer 1: Regex pre-screen (cheap, blocks obvious attacks)
   - Layer 2: AST structural check (sqlglot — catches hidden mutations)
   - Layer 3: AST LIMIT guard (prevents resource exhaustion)
   - Read-only database user + transactional rollback

4. **State Management:**
   - Shared Task Registry in PostgreSQL with `SELECT...FOR UPDATE SKIP LOCKED`
   - Agent decoupling — each agent is independently deployable and failure-recoverable

**Why this design works at scale:**
- Each agent can be scaled independently (e.g., 5 Executors, 1 Manager)
- PostgreSQL as state backend — no new infrastructure
- Dynamic Schema Fetcher keeps LLM costs low regardless of schema size

### What the interviewer is testing
Can you design a real system under constraints, not just repeat what you built?

---

## Q21: How would you make your Multi-Agent Interviewer handle 500 concurrent sessions?

**Answer:**

**Current architecture:** Single FastAPI process, in-memory session state, SQLite for demo data.

**To scale to 500 concurrent sessions, I'd change:**

| Component | Current | Scaled |
|---|---|---|
| **Session store** | MemorySaver (in-process) | **PostgresSaver** (persistent, shardable) |
| **Backend processes** | 1 FastAPI worker | **Horizontal scaling** — multiple FastAPI workers behind Nginx |
| **Task execution** | Direct LLM calls | **Celery worker pool** with Redis broker |
| **Session isolation** | Single process | Worker per session group — crash one, others survive |
| **LLM rate limits** | None | **Token bucket rate limiter** per API key with queueing |
| **Guardrail processing** | Serial per session | **Async guardrail pipeline** — I/O-bound operations (regex, AST) run concurrently |

**Key design decisions:**
- **State backend matters most** — PostgresSaver stores session checkpoints in PostgreSQL. If a worker crashes, another picks up the session from the last checkpoint. Users don't notice.
- **Celery for parallel sessions** — Each interview session becomes a Celery task. Workers pull tasks, run the LangGraph flow, write results. Failed tasks are retried.
- **Rate limiting at the LLM layer** — 500 concurrent sessions × average 3 LLM calls per turn = 1500 LLM calls per turn. If each takes 2 seconds, need at least 50 concurrent LLM connections. Token bucket ensures we stay within API limits.
- **No shared mutable state** — All state is in PostgresSaver. Workers are stateless. Scale up/down freely.

**Estimated throughput:** With 10 FastAPI workers and 50 Celery workers, 500 sessions comfortably fits. Bottleneck would be LLM API rate limits, not application code.

### What the interviewer is testing
Production scaling knowledge — can you identify the bottleneck (session state) and propose the right solution (persistent checkpoints)?

---

## Q22: Your IIoT platform replaced a licensed solution. What was the migration strategy?

**Answer:**

**Context:** The factory's existing IoT stack ran on licensed commercial software with a capped register count — they could only expose a limited number of data points from Omron PLCs. Adding more required expensive license upgrades.

**Migration strategy — incremental, not big-bang:**

**Phase 1 — Parallel Run (no downtime):**
- Deployed LINX TRITON edge controllers alongside existing infrastructure
- TRITON polled PLCs in read-only mode via OPC UA (no disruption to production)
- Both old and new pipelines ran simultaneously — data from both was compared for accuracy

**Phase 2 — Gradual Cutover (one production line at a time):**
- Selected one factory line as pilot. Connected TRITON → Python FINS bridge → PostgreSQL
- Ran for 2 weeks in shadow mode (data flowing to both old and new systems)
- Validated data completeness, latency, and accuracy against the legacy system
- Stakeholders signed off → moved next line

**Phase 3 — Decommission (after validation):**
- Once all lines were migrated, deprecated the licensed system
- Final state: Self-owned edge-to-PostgreSQL pipeline with Grafana dashboards and Prometheus monitoring

**Key risk mitigation:** The FINS bridge was custom Python code talking directly to Omron PLCs. If it failed, the old system was still running in parallel. We never had a point where production depended solely on new code without backup.

### What the interviewer is testing
Production migration experience — do you know how to replace infrastructure without causing downtime?

### Follow-up prep
- "Did you face resistance from the factory team?" — Initially yes. They'd used the licensed system for years. The parallel run and side-by-side data comparison built trust — when they saw Grafana dashboards with fresher data than the old system, they became the strongest advocates.
- "What was the hardest part?" — The FINS protocol handler. Omron's documentation for FINS over Ethernet was limited. I had to reverse-engineer packet captures to understand the read register command format.
