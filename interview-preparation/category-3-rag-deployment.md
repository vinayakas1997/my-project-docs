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

## Q14: Explain the algorithmic hallucination guardrails (Mean Anagrams + Hash Mapping, 3-tier retry)

**Answer:**

**Problem:** LLMs hallucinate — they generate text that looks correct but contains invented numbers, part numbers, or specifications. In a quotation context, a hallucinated price or specification could cost real money.

**Solution — 3-tier guardrail:**

**Tier 1 — Mean Anagrams (Word-level):**
- After the LLM generates an answer for a given passage, we algorithmically verify: for each significant token in the output, does a similar token exist in the source document?
- Uses normalized edit distance (character-level anagram scoring) — not semantic similarity, but actual character overlap.
- If score < threshold → flag as potential hallucination.

**Tier 2 — Hash Mapping (Document-level):**
- Pre-compute hash fingerprints of each source document paragraph.
- After generation, hash-map every claimed citation back to the source fingerprint.
- If the claimed facts don't map to any source fingerprint → hallucination detected.

**Tier 3 — VLM Fallback:**
- If Tiers 1 and 2 both flag the output, route the page images to GLM-4.6V Flash (vision-language model) for visual re-verification.
- The VLM looks at the actual rendered page and answers: "Does this page contain the claimed value?"
- 3 retries with escalating model size before final rejection.

**Result:** Near-zero hallucinated outputs reaching the user. The 45% OCR failure rate on rotated tables was solved by MinerU's layout-aware parsing at the ingestion stage, which fed cleaner text into the guardrail pipeline.

### What the interviewer is testing
Depth of engineering thinking — simple RAG just retrieves and generates. Yours has a multi-stage verification pipeline.

---

## Q15: How did you solve the 45% OCR failure rate on rotated table layouts?

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

## Q16: Phase 2 — Why did naive chunking fail on PLC manuals, and how did entity-anchored metadata fix it?

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
