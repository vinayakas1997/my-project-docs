# Category 1: Agentic AI Production Systems (EDAS)

---

## Q1: Walk me through the EDAS architecture — from user question to SQL result

**Answer:**
- User types a natural language question like "Why did Power Tester 3 spike in energy last Tuesday night shift?"
- **Manager Agent** receives it — validates machine/line names against the IoT catalog, parses relative time phrases ("last Tuesday") against a reference timestamp, and fills three slots (line, time, aim). Behind the reply, a **27-node LangGraph** flow runs — only **6 LLM calls**, the rest is deterministic routing and validation. On "go" confirmation, it writes a structured task to the `task_registry` PostgreSQL table.
- **Planner Agent** polls the registry. For each aim, it builds a detailed query plan: which tables to join, what filters and time bounds apply. Uses the **Dynamic Schema Fetcher** — a lightweight semantic routing step that injects only relevant tables/columns into the prompt (not the full 200-table schema), preventing context bloat and hallucinated joins.
- **Executor Agent** picks the plan, generates SQL, passes it through a **two-layer security framework** (Regex AST Parser blocks mutation keywords + transactional rollbacks for read-only enforcement), then runs it using `SELECT...FOR UPDATE SKIP LOCKED` for safe concurrent execution. Results are dropped back to the registry.
- Manager retrieves the result and presents it conversationally to the user.

### What the interviewer is testing
End-to-end systems thinking — do you understand how each piece connects, or did you just copy a tutorial?

### Follow-up prep
- "What's the latency breakdown?" (Manager ~2-3s, Planner ~3-5s, Executor depends on SQL complexity)
- "What happens if the Planner's LLM call fails?" (3 retries with tenacity, then task marked as failed with error detail)

---

## Q2: Why did you choose LangGraph over a simple chain or CrewAI?

**Answer:**
- LangGraph's **StateGraph** with **MemorySaver** checkpointing gives me a state machine, not just a DAG — agents can pause, resume, and conditionally route based on state, rather than running a fixed chain
- **Explicit state management** — the Task Registry is a first-class concept stored in PostgreSQL, not in-memory. If the process restarts, state survives
- **Conditional edges** — the Executor can route data/table errors back to the Planner, but format errors back to itself for retry. In CrewAI, every agent just broadcasts to every other agent
- **27-node graph with only 6 LLM calls** — most nodes are deterministic (validation, routing, slot filling). LangGraph's design makes this easy to expose; in a simple chain, every step would feel like it needs an LLM call

### What the interviewer is testing
Framework selection reasoning — did you choose it for the right technical reasons, or because it was popular?

---

## Q3: How do the three agents communicate? Why a shared Task Registry instead of direct calls?

**Answer:**
- They communicate **exclusively through the `task_registry` PostgreSQL table** — Manager writes a task, Planner picks it and writes a plan, Executor picks the plan and writes results. No agent calls another agent directly.
- **Decoupled by design** — if the Planner crashes mid-plan, the task stays in "planned" status. A new Planner instance picks it up on restart. No in-flight data loss.
- **Parallelism** — multiple Executor instances can safely poll the registry using `SELECT...FOR UPDATE SKIP LOCKED`. If you used direct API calls, you'd need a message queue and handle timeouts manually.
- **Resume-from-failure** — if any agent fails, the task remains in its current state in PostgreSQL. A replacement agent picks up exactly where it left off.

### What the interviewer is testing
Architecture trade-off thinking — why PostgreSQL as a message bus instead of Redis/RabbitMQ/SQS?

### Follow-up prep
- "Why not RabbitMQ or Kafka?" — For this scale (not high-throughput), PostgreSQL gives us atomicity, durability, and queryability with zero infrastructure overhead. Transactions guarantee exactly-once task processing.

---

## Q4: What happens if the Planner agent crashes mid-plan?

**Answer:**
- The task in `task_registry` remains in `planning` status with whatever partial data was written.
- A health-check process (or the next poll cycle) detects tasks stuck in `planning` beyond a timeout.
- A new Planner instance picks up the task and re-starts planning from scratch — there's no partial-plan data to recover because plans are written atomically at the end.
- The old Planner's LangGraph MemorySaver checkpoint is discarded; the new one starts fresh.

### What the interviewer is testing
Fault tolerance thinking — did you design for failure, or assume everything works perfectly?

---

## Q5: How did you handle the race condition when two executors poll the registry at the same millisecond?

**Answer:**
- Used PostgreSQL's **`SELECT ... FOR UPDATE SKIP LOCKED`** — an atomic, pessimistic lock.
- When Executor A reads a task and immediately sets its status to `running`, that database row is **instantly locked** to any other thread.
- Executor B trying to grab the same task gets `SKIP LOCKED` — it seamlessly skips to the next available task. No duplicates, no wasted LLM calls, no contention.
- Before this, I simulated concurrent access in staging and saw duplicate task execution 15% of the time. After the fix, zero.

### What the interviewer is testing
Concurrency problem-solving — did you know about `SKIP LOCKED` (PostgreSQL 9.5+) or would you have tried application-level locking?

### Follow-up prep
- "Why not `NOWAIT`?" — `NOWAIT` throws an error when it can't acquire the lock. `SKIP LOCKED` gracefully skips to the next row. At scale, `NOWAIT` would cause cascading failures under high contention.
- "What about serializable isolation level?" — Overkill for this use case and would cause too many serialization failures under load.

---

## Q6: The Manager has 27 nodes but only 6 LLM calls. What are the other 21 nodes doing?

**Answer:**
- **Catalog validation** (3 nodes) — checking if the user's mentioned machine/line names exist in the IoT catalog
- **Time parsing** (2 nodes) — converting relative phrases like "last Tuesday" or "yesterday" into absolute timestamps against a reference
- **Slot filling state machine** (6 nodes) — checking which of the 3 slots (line, time, aim) are filled, prompting for missing ones
- **Confirmation gate** (2 nodes) — waiting for user to say "go" or "yes" before writing to the registry
- **Error handling & retry logic** (4 nodes) — routing different error types to appropriate handlers
- **State routing** (4 nodes) — reading the current conversation state and deciding the next conditional edge

The goal: minimize expensive LLM calls by handling as much as possible with deterministic logic.

### What the interviewer is testing
Cost-awareness and optimization thinking — LLM calls cost money and add latency. Deterministic code is cheap and fast.

### Follow-up prep
- "Could you reduce it further?" — Yes, but the current design prioritizes correctness. Each deterministic node handles a specific edge case. In production, I'd measure which nodes are never triggered and remove them.
