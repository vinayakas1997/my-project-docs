# Category 3: RAG & On-Premise Deployment

---

## Q12: You mention 360× speedup. How did you measure that baseline to finish?

**Answer:**
- **Baseline:** Before the RAG system, the Planning team manually searched through a shared network drive of 2,500+ documents (PDF, PPTX, CSV, TXT) to find historical quotes, specifications, and project data. A single complex quote request took **hours** — they estimated 1-3 hours per query depending on document age and format.
- **After deployment:** Same query through the RAG system returned grounded, cited results in **under 10 seconds**.
- **Calculation:** Lower bound: 1 hour (3600s) ÷ 10s = 360×. Upper bound: 3 hours ÷ 10s = 1080×. We reported conservatively at 360×.

**Important context:** The baseline was manual document search, not a previous software tool. The speedup is human-to-system, not system-to-system. We made this clear in presentations — the metric is about **operational throughput**, not algorithm optimization.

### What the interviewer is testing
Intellectual honesty — can you explain how you measured something without overclaiming?

### Follow-up prep
- "Did you measure accuracy too?" — Yes. Each upload batch defined golden questions and expected answers. We tracked retrieval accuracy per batch. Phase 2 added a full HITL evaluation dashboard for continuous monitoring.
- "What was user adoption?" — The 10-member Planning team used it daily. PLC team adopted it independently in Phase 2.

---

## Q13: "No External API" constraint — how did that change your architecture decisions?

**Answer:**

This was a **hard constraint** due to data governance policies — no data could leave the local network. This forced:

| Decision | Why |
|---|---|
| **On-premise LLM serving** | Couldn't use OpenAI API. Ran Qwen3.6 via Atlas Inference Engine on DGX Spark. |
| **Local OCR** | MinerU layout-aware OCR running locally, not cloud OCR services. |
| **Local vector DB** | Hindsight self-hosted, not Pinecone/Weaviate cloud. BGE-M3 embeddings generated locally. |
| **No external APIs** | No SerpAPI, no Wikipedia search, no cloud translation — everything self-contained. |

**Result:** The entire pipeline — ingestion, OCR, embedding, indexing, retrieval, generation — runs on a single DGX Spark appliance. Zero external network calls.

**Trade-off:** Inference quality is capped by the local model (Qwen3.6) vs GPT-4. But we optimized heavily — Atlas engine gave us 80 tok/s vs vLLM's 35 tok/s, and latency dropped from 90s to 6-10s.

### What the interviewer is testing
Constraint-driven engineering — can you still deliver results when your favorite tools are unavailable?

### Follow-up prep
- "What would you have done differently without the constraint?" — Used GPT-4 for OCR quality checks and hybrid retrieval, and possibly added a cloud fallback for complex queries while keeping simple ones on-premise.
- "How did you secure the DGX Spark?" — Network isolation, no open ports, local authentication, audit logging.

---

## Q14: Explain the ingestion-stage OCR quality guardrail (Unique-Word + VLM fallback)

**Answer:**

**Problem:** MinerU OCR has known failure modes — it can produce garbage output like infinite character repetition (`AAAAAAAA...`), trailing noise, or scrambled text from rotated tables. If this corrupted text goes into the vector DB, every downstream query against that chunk is poisoned.

**Where in the pipeline does the guardrail run?**

The guardrail runs **at ingestion time, per page**, right after OCR extracts the text and before it enters the vector DB:

```
Page image
    ↓
MinerU OCR ──► OCR text
                  ↓
         Tier 1: Unique-word moving avg ──► Pass ✓ ──► DB
                  ↓
              Fail ✗
                  ↓
         check_table (holds suspect pages)
                  ↓
         Tier 2: VLM (page image + OCR text, 3 retries)
                  ├─ "OCR is correct" → DB ✓
                  └─ "OCR is wrong"   → Human review 👤
```

**Solution — 2-tier guardrail:**

**Tier 1 — Unique-Word Moving Average (Statistical):**
- After OCR extracts text for a page, count the **unique words** (distinct tokens, not total word count).
- Maintain a **moving average** of unique-word counts across pages of the same document.
- If a page's unique-word count drops significantly below the moving average → flag as potential OCR failure.

- **Example (document with 3 pages):**

  | Page | Total chars | Unique words | Moving avg | Verdict |
  |---|---|---|---|---|
  | Page 1 | 5,000 | 100 | — (baseline) | ✓ |
  | Page 2 | 6,200 | 125 | (100+0)/1 = 100 | ✓ (125 > 100×0.5) |
  | Page 3 | 5,000 | 20 | (100+125)/2 = 112.5 | ✗ (20 << 112.5×0.5) → flagged |

  Page 3's unique words (20) is far below 50% of the moving average — likely OCR repetition error.

- **False alarm handling:** Pages with genuinely few words (diagrams, label-heavy layouts) would fail here → caught by Tier 2.

**Tier 2 — VLM Verification:**
- When Tier 1 flags a page, the OCR text and the **page image** are sent to a **check_table** for review.
- A **VLM** (GLM-4.6V Flash) receives both the page image and the OCR output and answers: *"Is the OCR text an accurate extraction of this page?"*
- Up to **3 retries** with escalating model size. If the VLM confirms the OCR is correct → page moves to DB. If VLM determines OCR is wrong → sent to **human review**.
- The VLM catches cases the statistical check can't (e.g., OCR generates *different* garbage words instead of repeating the same one).

**Result:** Near-zero corrupted text entering the vector DB. Cleaner source data means queries against that data return more reliable results.

### What the interviewer is testing
Data quality awareness — you don't blindly trust OCR output. You verify at the source before it contaminates downstream systems.

---

## Q15: Why Hindsight AI as the vector DB? Explain the retrieval math internally.

**Answer:**

**Why Hindsight:**
- **Self-hosted on DGX Spark** — satisfied the no-external-API constraint (Q13). No data leaves the local network.
- **Open-source** — could inspect and tune every layer (embedding, retrieval, reranking).
- **Built for AI agent memory** — not just document search. Supports structured metadata, entity graph, temporal queries, and token-budget-aware recall (important for LLM context windows).
- **TEMPR architecture** — four complementary retrieval strategies running in parallel, fused into a single ranked list.

**TEMPR Architecture Overview:**

Hindsight runs 4 strategies in parallel at recall time:

| Strategy | What it does | Best for |
|---|---|---|
| **Semantic** | Dense embedding similarity (BGE-M3 vector search) | Conceptual matches, paraphrases |
| **Keyword** | BM25 full-text search (configurable backend: pgroonga, pg_search, etc.) | Exact terms, register addresses (`%MW100`), proper nouns |
| **Graph** | Entity graph traversal — follows connections between entities | Indirect relationships, multi-hop reasoning |
| **Temporal** | Time-window filtering + relevance scoring | Historical queries ("last spring", "in 2023") |

All four run simultaneously. Results are **not mixed at this stage** — they go into the fusion pipeline sequentially:

```
4 strategies (parallel)
    ↓
Stage 1: RRF Fusion ──► Stage 2: Cross-encoder Rerank ──► Stage 3: Multiplicative Boosts ──► Stage 4: Token Truncation
```

Each stage finishes before the next kicks in — no interleaving.

---

**Stage 1 — Reciprocal Rank Fusion (RRF):**

Strategy results are combined using RRF, which rewards documents appearing **highly ranked across multiple strategies**. It ignores raw scores (incomparable across strategies) and uses only rank positions.

**Formula:**

```
score(d) = Σ_i 1 / (k + rank_i(d))
```

Where `k = 60` (smoothing constant) and `rank_i(d)` is the position of document `d` in strategy `i` (1-indexed).

**Example:**
- **Document A:** ranked #1 in semantic, #5 in keyword → `1/(60+1) + 1/(60+5) = 0.0164 + 0.0154 = 0.0318`
- **Document B:** ranked #1 in semantic only → `1/(60+1) = 0.0164`

**Document A wins** because it has **consensus** — both strategies ranked it highly.

---

**Stage 2 — Cross-Encoder Reranking:**

RRF is position-based — it never reads the query and document together. The cross-encoder does: it takes each (query, candidate) pair and produces a relevance score.

**Pre-filter:** Only top **300** candidates (by RRF score) enter the cross-encoder — limits computational cost.

**Where the raw logit comes from:** The query and candidate chunk are concatenated as `[CLS] query [SEP] chunk [SEP]` and fed through a transformer (e.g., BGE-reranker). The `[CLS]` token's final hidden state passes through a single linear layer (no softmax) — the output is a single unbounded number called the **raw logit**. Positive logit = relevant, negative = irrelevant.

**The `[CLS]` token origin (BERT, 2018):** The `[CLS]` token is an **artificial learned token** prepended to every input — it has no lexical meaning. Its embedding is randomly initialized and learned during pre-training. During self-attention, `[CLS]` attends to **all other tokens** in the sequence, so its final hidden state becomes an aggregate representation of the entire input.

BERT was pre-trained on two tasks:
- **Masked LM** — predict masked words (uses word token outputs)
- **Next Sentence Prediction (NSP)** — predict if sentence B follows sentence A (uses `[CLS]` output)

The NSP task trained `[CLS]` to represent **sentence-pair relationships**. When fine-tuned as a cross-encoder reranker, the NSP head is replaced with a relevance scoring head:

```
BERT pre-train:  [CLS] sentence A [SEP] sentence B → NSP head → is B next?
Reranker:        [CLS] query      [SEP] chunk      → linear    → relevance logit
```

**Same architecture as Vision Transformer (ViT, 2020):** ViT borrowed the same `[CLS]` design — divides an image into 16×16 patches, prepends `[CLS]`, runs through standard transformer blocks, and uses `[CLS]` output for classification. Text cross-encoders and ViTs share the same core mechanism.

**Score normalization:** Cross-encoders output raw logits (can be negative). Scores outside [0, 1] are normalized via sigmoid:

```
CE_normalized = 1 / (1 + e^(-raw_logit))
```

**Example:**

| Raw logit | CE_normalized | Meaning |
|---|---|---|
| 2.5 | 0.924 | Highly relevant |
| 0.5 | 0.622 | Moderately relevant |
| -1.0 | 0.269 | Weakly relevant |
| -3.0 | 0.047 | Likely irrelevant |

A raw logit of 2.5 → `1 / (1 + e^(-2.5)) = 1 / (1 + 0.082) = 0.924` — the cross-encoder is very confident this chunk answers the query.

---

**Stage 3 — Multiplicative Boosts:**

The cross-encoder score is adjusted by three **multiplicative** boosts that capture signals the cross-encoder can't see (recency, time, evidence strength).

**Why multiplicative:** Additive boosts would give the same bonus to all candidates regardless of relevance. Multiplicative keeps adjustments proportional — a +10% nudge on a highly-relevant document is a bigger absolute change than +10% on a barely-relevant one.

**Formula:**

```
final_score = CE_normalized × recency_boost × temporal_boost × proof_count_boost
```

Each boost uses the same formula:

```
boost = 1 + α × (signal - 0.5)
```

Centered at 1.0 (neutral). α caps the swing.

| Boost | α | Max adjustment | Signal formula |
|---|---|---|---|
| **Recency** | 0.2 | ±10% | `clamp(1.0 - days_ago / 365, 0.1, 1.0)` |
| **Temporal proximity** | 0.2 | ±10% | `1.0 - min(days_from_center / (window/2), 1.0)` |
| **Proof count** | 0.1 | ±5% | `clamp(0.5 + ln(count) / 10, 0.0, 1.0)` |

**Recency example:**
- Memory from today (0 days ago): recency = 1.0 → boost = `1 + 0.2 × (1.0 - 0.5)` = 1.10 (+10%)
- Memory from 6 months ago (~182 days): recency = `1 - 182/365` = 0.501 → boost ≈ `1 + 0.2 × (0.501 - 0.5)` ≈ 1.000 (neutral)
- Memory from 2 years ago (730 days): recency = 0.1 (clamped) → boost = `1 + 0.2 × (0.1 - 0.5)` = 0.92 (-8%)

**Temporal proximity example:**
- Query: "What happened in Q3 2023?" (window: July-Sept 2023, center ≈ Aug 15)
- Memory dated Aug 20 (5 days from center, window = ~92 days): proximity = `1 - 5/46` = 0.891 → boost = `1 + 0.2 × (0.891 - 0.5)` = 1.078 (+7.8%)
- Memory from Jan 2023 (far outside): proximity = 0.0 → boost = `1 + 0.2 × (0.0 - 0.5)` = 0.90 (-10%)

**Proof count example:**
- Observation with 1 source: `clamp(0.5 + ln(1)/10, 0, 1)` = 0.5 → boost = `1 + 0.1 × (0.5 - 0.5)` = 1.000 (neutral)
- Observation with 10 sources: `clamp(0.5 + ln(10)/10, 0, 1)` = 0.730 → boost = `1 + 0.1 × (0.730 - 0.5)` = 1.023 (+2.3%)
- Observation with 150+ sources: saturates at 1.0 → boost = `1 + 0.1 × (1.0 - 0.5)` = 1.050 (+5% max)

**Combined range:**
- Best case: ×1.10 × 1.10 × 1.05 ≈ **+27%**
- Worst case: ×0.90 × 0.90 × 0.95 ≈ **-23%**
- Conservative by design — boosts nudge, don't override cross-encoder relevance.

---

**Graph Scoring Detail:**

Graph traversal doesn't feed into RRF — it's a separate strategy that produces its own ranked list. Each candidate is scored as:

```
graph_score = entity_score + semantic_link + causal_link
```

| Signal | Formula | Range |
|---|---|---|
| **Entity overlap** | `tanh(shared_entities × 0.5)` | [0, ~1.0] |
| **Semantic link** | Precomputed kNN link weight | [0.7, 1.0] |
| **Causal link** | Causal relationship weight | [0, 1.0] |

**Why additive:** A memory might be connected only through causal links (no shared entities). Multiplicative would zero it out. Additive lets each signal contribute independently.

**Why tanh for entity scores:** Raw shared-entity count is unbounded (a high-fanout entity like "user" could produce counts of 50+). `tanh(count × 0.5)` saturates naturally:

| Shared entities | tanh(count × 0.5) |
|---|---|
| 1 | 0.462 |
| 2 | 0.761 |
| 3 | 0.905 |
| 5 | 0.987 |
| 10+ | ~1.0 |

First few entities matter a lot, additional ones give diminishing returns. Keeps entity signal in [0, 1] alongside semantic and causal scores.

**Graph example:**
- Query entity: "Alice" → document shares 2 entities (Alice, Google) → entity_score = 0.761
- Precomputed semantic link weight: 0.85
- No causal link: 0.0
- **graph_score = 0.761 + 0.85 + 0.0 = 1.61**

---

**Budget Mapping:**

The `budget` parameter (low/mid/high) controls search depth across all stages:

| Budget | Candidates per strategy | Reranker pre-filter |
|---|---|---|
| **low** | 100 | 300 (fixed, independent) |
| **mid** (default) | 300 | 300 |
| **high** | 1000 | 300 |

The reranker pre-filter (300) is **independent** of budget — a separate configurable knob.

---

**Token Budget Management:**

Hindsight returns results until `max_tokens` is exhausted (not a fixed top-K). This is designed for LLM context windows:

- `max_tokens` = 4096 (default) → ~4 pages of memory
- Top-ranked memories selected first
- Only memory text counts toward budget — metadata is free

**Why this matters for your project:** PLC manual queries often return many small chunks (register definitions). Token budgeting ensures the LLM gets the most relevant content within its context window, rather than flooding it with hundreds of tiny chunks.

---

### What the interviewer is testing
Depth of retrieval understanding — you didn't just plug in a vector DB and call it done. You understand the full pipeline: multi-strategy search, position-based fusion, cross-encoder rescoring, and signal-aware ranking adjustments.

---

## Q16: How did you solve the 45% OCR failure rate on rotated table layouts?

**Answer:**

**Problem:** MinerU's OCR configuration struggled with rotated table layouts in scanned PDFs — tables tilted by even 2-3 degrees caused text extraction to miss columns or merge cells incorrectly. 45% of such documents had parsing errors.

**Solution — Layout-Aware Configuration:**
- Tuned MinerU's **layout detection parameters**: increased the rotation correction angle range, adjusted table boundary detection sensitivity
- Added a **post-processing step**: if the raw OCR output has anomalous row/column counts (detected by checking expected vs actual cell count), trigger reprocessing with a more aggressive layout model
- Implemented **router logic**: text-heavy pages go through standard MinerU pipeline; table-heavy pages and diagram pages route to GLM-4.6V Flash for vision-based extraction instead of pure OCR

**Result:** Near-zero parsing errors on previously-failing documents. The router logic also reduced processing time for text pages since they avoided heavy VLM processing.

### What the interviewer is testing
Debugging methodology — did you just increase retries or did you analyze the root cause (rotation sensitivity)?

---

## Q17: Phase 2 — Why did naive chunking fail on PLC manuals, and how did entity-anchored metadata fix it?

**Answer:**

**Problem:** PLC manuals are 500-page documents dense with hardware registers (`%MW100`, `%IW3.2`), error codes, Kanban identifiers, and memory addresses. Standard 500-token sliding window chunking **shatters the structural relationship** between a register address and its functional description. Chunk A mentions `%MW100`, chunk B describes what it does, chunk C has the valid range. Vector similarity alone can't connect chunks A→B→C reliably. Naive chunking gave ~45% retrieval accuracy on register-level queries.

**Solution — Hindsight Tagging (Metadata Enrichment Pipeline):**
- **Before chunking**, a targeted LLM scans each document to extract hyper-specific technical primitives: register addresses, error codes, protocol identifiers, system names.
- These extracted entities are **hard-bound to each vector chunk's Metadata Payload** — not stored in the embedding, but as structured metadata alongside the vector.
- When a PLC engineer queries `%MW100`, the system uses **Hybrid Filtering**:
  - **Exact Metadata Match:** Find all chunks whose metadata payload contains `%MW100` (deterministic — no ambiguity)
  - **Vector Similarity:** Among those, rank by semantic relevance to the query
- **Result:** Retrieval accuracy jumped from ~45% to **85-90%** on technical register-level queries.

### What the interviewer is testing
Data-aware RAG design — you understand that not all documents benefit from the same chunking strategy.

### Follow-up prep
- "Why not just increase chunk size?" — Larger chunks don't help when the entity reference is 500 pages apart from its description. Plus, larger chunks degrade retrieval precision (more noise in each chunk).
- "Does this work for non-technical documents?" — It's overkill. For prose documents, standard chunking works fine. This is specifically for reference manuals with entity-heavy content.

---

## Q18: What makes your RAG system different from simple/naive RAG?

**Answer:**

**Simple RAG pipeline:**

```
Query → Dense embedding search → Top-K chunks → LLM generates answer
```

That's it — one retrieval strategy, fixed top-K results, no verification.

**My RAG pipeline:**

| Layer | Simple RAG | My system |
|---|---|---|
| **Retrieval** | Single dense vector search | 4 strategies in parallel — Semantic + Keyword (BM25) + Graph (entity traversal) + Temporal (time-window) |
| **Fusion** | None — single retriever output | RRF (Reciprocal Rank Fusion, k=60) — rewards consensus across strategies |
| **Reranking** | None — cosine similarity is final | Cross-encoder reranker on top-300 candidates — re-scores (query, chunk) pairs via BERT-style deep interaction |
| **Scoring** | Cosine similarity only | `CE_normalized × recency_boost × temporal_boost × proof_count_boost` — relevance + recency + time proximity + evidence strength |
| **Chunking** | Fixed 500-token sliding window | Entity-anchored metadata enrichment — technical primitives (`%MW100`, error codes) hard-bound to chunk metadata for exact match + semantic hybrid |
| **Context budget** | Fixed top-K (e.g., top-5) | Token-budget-aware (`max_tokens`) — returns results until LLM context window is filled, not a fixed count |
| **Guardrail** | None | Ingestion-time OCR quality check (unique-word moving avg + VLM fallback). Near-zero corrupted text enters the DB. |

**In short:** Simple RAG is a single-path pipeline with no verification. Mine is a **multi-strategy, multi-stage pipeline** with fusion, reranking, signal-aware scoring, metadata-enriched retrieval, and ingestion-time quality control.

**Taxonomy:**

```
        RAG
         │
    ┌────┴──────────────┐
    │                   │
 Simple               Advanced
 (naive)               │
                  ┌────┴────┬────────┬──────────┐
                  │         │        │          │
               TEMPR    Self-RAG  CRAG  Adaptive RAG
              (mine)    (paper)  (paper)  (paper)
```

My system uses Hindsight's **TEMPR** architecture — it's a production-grade retrieval system, not a simple RAG. The named papers (Self-RAG, CRAG, Adaptive RAG) are research prototypes that solve specific sub-problems; TEMPR solves the production problem of *combining multiple retrieval signals reliably*.

### What the interviewer is testing
Architecture awareness — can you articulate what makes your system non-trivial? Do you understand the difference between a single-vector lookup and a production retrieval pipeline?
