# Real RAG Developer Techniques & Algorithms

A study reference of industry-standard RAG techniques beyond what was implemented in your project. Use this to speak knowledgeably about patterns you understand even if you didn't deploy them.

---

## 1. Retrieval Strategies

### Hybrid Search (Dense + Sparse)
- **Dense retrieval** (e.g., BGE-M3, OpenAI ada): semantic similarity in embedding space — captures meaning
- **Sparse retrieval** (e.g., BM25, SPLADE): keyword/lexical matching — captures exact terms
- **Combination:** Merge results via **RRF (Reciprocal Rank Fusion)**:

  ```
  score(doc) = Σ_i 1 / (k + rank_i(doc))
  ```

  where `rank_i` is the rank from the i-th retriever and `k` is a constant (typically 60).
- Why it works: Semantic + lexical complement each other. A query like `"%MW100 reset error"` benefits from exact register match (sparse) + semantic understanding of "reset" (dense).

### BM25 (Okapi BM25)
- Bag-of-words retrieval function. Scores documents by term frequency (saturated) and inverse document frequency.
- Still the strongest **sparse** baseline. Many production RAG systems use BM25 alongside embeddings.
- `tf-idf` on steroids — accounts for document length normalization, term frequency saturation.

### Query Expansion
- LLM generates 3-5 rephrased versions of the user query → retrieve for each → merge/fuse results.
- **Example:**
  - User query: *"How to reset the PLC after error code E-401?"*
  - Expanded: *"PLC E-401 reset procedure"*, *"Clearing error E-401 on programmable controller"*, *"E-401 fault recovery steps"*
- Increases recall at the cost of slightly higher latency and potential noise.

### HyDE (Hypothetical Document Embeddings)
- Instead of embedding the query directly, ask the LLM: *"Write a paragraph that would be the perfect answer to this query."*
- Embed that hypothetical document, then retrieve using it.
- Works because the hypothetical answer is in the same *distribution* as your indexed documents — bridges the query-document gap.

### ColBERT / Late Interaction
- Instead of collapsing a document into one vector, keep **token-level embeddings**.
- At retrieval time, calculate **MaxSim**: for each query token, find the most similar document token, sum across query tokens.
- More expressive than bi-encoders. Used in RAG systems that need fine-grained relevance (legal, medical).

---

## 2. Chunking Strategies

### Semantic Chunking
- Not fixed token count — split at **topic/narrative boundaries**.
- Method: embed sentences sequentially, detect drops in cosine similarity between consecutive sentence embeddings → boundary.
- Keeps related content together. Reduces context fragmentation compared to sliding window.

### Small-to-Big / Child-Parent
- **Retrieve:** small chunks (128-256 tokens) for high precision.
- **Return:** parent chunk (512-1024 tokens) that contains the small chunk for full context.
- Best of both worlds: precise retrieval + complete context for the LLM.

### Sliding Window + Overlap
- Standard fallback: 500-token windows, 10-20% overlap (50-100 tokens).
- Overlap ensures no hard cut between concepts.
- Works well for prose, breaks on entity-heavy technical manuals (see Q16).

---

## 3. Embedding Models & Techniques

| Model | Strengths | Trade-offs |
|---|---|---|
| **BGE-M3** (used in your project) | Multi-lingual, multi-granularity. Dense + sparse + multi-vec in one model. | Larger than pure dense models |
| **Matryoshka embeddings** | Train once, truncate dimension at inference (e.g., 768→256). Speed-vs-quality slider with one model. | Slight accuracy loss at aggressive truncation |
| **E5 / Instructor** | Instruction-tuned — prefix text steers embedding behavior (e.g., *"Represent a document for retrieval:"* vs *"Represent a question:"*) | Requires careful prompt crafting |
| **SPLADE** | Learned sparse embeddings — outputs a sparse vector over vocabulary tokens. Interpretable (you can see which terms matched). | Higher latency at query time |

### Matryoshka Detail
- Standard: embed → 768-dim vector. Matryoshka: first 128 dims have coarse information, 128-384 add detail, 384-768 add nuance.
- At query time, you can use only the first 128 dims → 6× faster but slightly less accurate.

---

## 4. Reranking

### Cross-Encoder Reranking
- **Step 1:** Bi-encoder (fast) retrieves top-K (e.g., K=100).
- **Step 2:** Cross-encoder (slow but accurate) scores each of the 100 pairs (query, chunk).
- **Result:** Top-5 from the cross-encoder. Much higher precision than bi-encoder alone.
- Models: `cohere-rerank-v3`, `BGE-reranker`, `cross-encoder/ms-marco-MiniLM-L-6-v2`.

### Why cross-encoder > bi-encoder
- Bi-encoder encodes query and document **independently** → loses interaction information.
- Cross-encoder sees them **together** — can attend to fine-grained relevance cues.

---

## 5. Advanced RAG Patterns (Paper-Origin)

### Self-RAG (2023, Asai et al.)
- LLM is trained with special **reflection tokens**: `[Retrieve]`, `[Relevant]`, `[Irrelevant]`, `[Supporting]`, `[No Support]`.
- The model decides dynamically: *Do I need retrieval for this question?* If yes, retrieve and critique the result.
- Used for: reducing unnecessary retrievals, improving answer quality without over-retrieving.

### Corrective RAG (CRAG, 2024)
- Retrieve → evaluate retrieved chunks for relevance.
- If **relevant** → generate answer normally.
- If **partially relevant** → re-retrieve with a refined query.
- If **irrelevant** → fall back to web search or knowledge from LLM weights.
- Keeps the system robust against retrieval failures.

### Adaptive RAG (2024)
- Route the query to different retrieval strategies based on **query complexity**:
  - Simple factual → direct retrieval + answer.
  - Multi-hop reasoning → iterative retrieval.
  - Complex analysis → retrieve + generate multiple sub-answers → synthesize.
- Classifier (lightweight model) determines the route.

### RAG-Fusion
- Retrieve multiple sources for the same query → merge via **RRF** (same formula as hybrid search).
- Variation: also query *different chunks* using different retrieval strategies, then fuse.
- Improves coverage and diversity of retrieved content.

---

## 6. Evaluation Metrics

### Hit Rate @ K
- **Does the relevant document appear in the top-K results?**
- Simple boolean per query. Binary: 1 if relevant doc is in top-K, 0 otherwise.
- Good for: quick sanity check, acceptable performance threshold.

### MRR (Mean Reciprocal Rank)
- `1 / rank_of_first_relevant_doc` averaged across queries.
- If first relevant doc is at rank 3 → score = 1/3 ≈ 0.33.
- Rewards systems that rank relevant docs highly (more granular than Hit Rate).

### NDCG (Normalized Discounted Cumulative Gain)
- Supports **graded relevance** (not just binary): e.g., highly relevant = 3, somewhat relevant = 1, irrelevant = 0.
- Position discount: log penalty on rank (deeper results matter less).
- Gold standard for IR evaluation but requires graded relevance judgments.

### Faithfulness / Hallucination Metrics
- **NLI-based:** Train or use a cross-encoder to classify: *Does the answer contradict the source?* (Entailment / Neutral / Contradiction).
- **TrueTeacher:** Self-supervised approach — generate synthetic contradictions, train a detector.
- **AlignScore:** Measures alignment between claim and source across multiple dimensions.
- **Token-level recall:** What fraction of the answer's claims are directly supported by the source? (e.g., Q14's approach but using NLI instead of edit distance).

---

## 7. Real Guardrail / Quality Techniques (Industry)

### Citation Grounding
- The LLM is prompted to output citations in a structured format: `[1]`, `[2]`, etc.
- Each citation maps to a retrieved chunk index.
- **Verification:** Check that each cited chunk actually contains the claimed information (via NLI or exact match).
- If a citation is unsupported → reject or re-generate.

### NLI-based Contradiction Detection
- Cross-encoder trained on NLI data (e.g., `TrueTeaCher`, `AlignScore`).
- Input: (source sentence, generated sentence). Output: entailment / neutral / contradiction.
- **Contradiction → reject.** Neutral → flag for review. Entailment → pass.
- More robust than Levenshtein edit distance — understands paraphrases.

### Decontextualization
- Force the LLM to produce self-contained sentences — no unresolved pronouns ("it", "this", "they") or vague references.
- **Why:** Makes every sentence independently verifiable against the source.
- Achieved via prompt instruction + few-shot examples.

### Round-trip Consistency
- Step 1: LLM generates answer.
- Step 2: Another LLM (or same) is asked: *"What was the original question?"* given only the answer.
- Step 3: Compare reconstructed question to original via embedding similarity.
- If they diverge → the answer likely drifted = hallucination risk.

---

## 8. Production Considerations

### Caching
- **KV cache:** Avoid recomputing attention for repeated prefixes.
- **Embedding cache:** same query → same embedding → skip re-encoding.
- **Result cache:** identical query → return cached answer (with TTL for staleness).

### Streaming & Chunked Generation
- **First-token latency** is the critical user-facing metric.
- Techniques: speculative decoding, pre-filling, chunked prefill (vLLM).

### Feedback Loop
- User ratings (thumbs up/down) logged per (query, answer) pair.
- Downstream uses:
  - Rejection sampling for fine-tuning.
  - Training data for reranker.
  - Flagging for human review dashboard.

### Evaluation Pipeline
- **Offline:** Golden Q&A dataset (hand-curated). Run nightly to catch regressions.
- **Online:** A/B test two retrieval configs. Metrics: user engagement, time-to-answer, manual audit pass rate.

---

## Quick Reference: Which Technique for Which Problem

| Problem | Technique |
|---|---|
| Low recall on exact terms | BM25 / SPLADE (hybrid with dense) |
| Low precision on top-K | Cross-encoder reranker |
| Fragmented technical documents | Entity-anchored metadata (Q16) |
| Hallucinated citations | Citation grounding + NLI check |
| OCR garbage in DB | Ingestion-time guardrail (Q14) |
| One question type doesn't fit all | Adaptive RAG (route by complexity) |
| Need to explain retrieval decisions | SPLADE (interpretable sparse vectors) |

---

*Note: This file is a study reference — not everything here was in your project. Use it to understand techniques you can discuss confidently in an interview without claiming you implemented them.*
