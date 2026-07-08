# Category 6: Behavioral / FDE-Specific

---

## Q23: Why FDE and not a research engineer or a regular SWE?

**Answer:**

Three reasons:

1. **I want to ship AI into production, not just build models.** — My work on EDAS and the RAG platform shows I enjoy the full lifecycle: scoping ambiguous requirements, designing architectures for real-world constraints ("No External API"), deploying on actual factory floors, and debugging issues that only appear under production load. Research engineering is too far from users; regular SWE is too far from AI.

2. **I thrive at the customer-technical intersection.** — My US-Japan bridge role is the closest analogue to what FDEs do. I enjoy translating between what a customer needs and what the engineering team can deliver. I don't want to just write code — I want to own the outcome for a real enterprise partner.

3. **I want to feed real-world friction back into the product.** — The zero-data bug fix, the OCR failure solution, the HITL evaluation dashboard — these all came from observing how systems behave in the field and feeding that back. That closed feedback loop is what makes FDE different: you're not just deploying, you're improving the core product through field insights.

### What the interviewer is testing
Self-awareness — do you understand what FDE actually does day-to-day, or are you applying to any role with "AI" in the title?

---

## Q24: Tell me about a time you shipped something under a hard deadline with incomplete requirements

**Answer:**

**Situation:** The US-Japan power tester project had a fixed delivery date tied to a factory production line shutdown window. We couldn't slip — the line would be idle, and the cost was ~$10K/hour. But the acceptance criteria from the US team were vague: "should work in the factory environment."

**Action:**
1. I created a **living requirements document** on day one — not waiting for the US team to finalize specs. I listed every test case I could think of based on the factory environment (node count, RF interference, shift duration, operator mobility). Shared it with both teams.
2. I set up a **weekly validation cadence** — run tests, document results, flag gaps — rather than waiting for a single end-of-project acceptance test.
3. When the zero-data bug appeared (Q18), I didn't wait for a root-cause investigation to complete. I implemented a **temporary workaround** (reduced node count per gateway) while the permanent fix was developed. This kept the deployment timeline on track.
4. I communicated trade-offs transparently: "We can ship on date X with the workaround and 120-node limit, or date Y with the full fix and 200-node support." The factory chose to ship with the workaround and upgrade later.

**Result:** Shipped on time. The permanent fix was deployed 3 weeks later, and node support reached 200+ as originally scoped.

### What the interviewer is testing
Execution under ambiguity — can you make progress without perfect information, or do you freeze?

---

## Q25: How do you handle a customer who doesn't trust your AI system's outputs?

**Answer:**

**Principle:** Trust is earned through transparency and verification, not persuasion.

**What I'd do:**

1. **Show citations, not just answers.** — In my RAG system, every response includes exact source pages and document references. If a user questions a value, I can show them the exact PDF page, line number, and context it came from. This is non-negotiable for building trust.

2. **Give them a verification tool.** — The HITL Evaluation Dashboard is exactly this: domain experts can run their own golden Q&A pairs, see what the system returns, and override judgments. When a user sees they can audit and correct the system, trust shifts from blind faith to informed confidence.

3. **Start with low-stakes queries.** — I'd encourage the customer to ask questions they already know the answer to. When the system consistently returns correct results with accurate citations, trust builds from demonstrated competence, not promises.

4. **Be honest about limitations.** — "This system can answer questions about past performance data within these tables. It cannot predict future failures. It cannot answer questions about data we haven't ingested." Underpromise and overdeliver builds lasting trust.

**Real experience:** When I deployed the RAG system at Somic, the Planning team initially treated it as a curiosity. I ran a demo where they asked 20 questions they'd manually researched the previous week. The system correctly answered 18 with exact page citations. The two edge cases we logged as improvement items. That demo converted skeptics into daily users.

### What the interviewer is testing
Customer empathy — do you understand that technical accuracy alone doesn't build trust?

---

## Q26: You've built impressive projects in Japan. Why are you looking to leave?

**Answer:**

I'm not necessarily looking to leave Japan — I'm looking for the **right role**. The FDE position at OpenAI is a career-defining opportunity that doesn't exist in many companies: building at the frontier of agentic AI while directly solving real enterprise problems.

My current work at Somic Ishikawa has been excellent for building deep technical skills in agentic systems, RAG, and industrial IoT. But the scope of impact at OpenAI is global — deploying frontier AI across strategic enterprise partners worldwide. I'd be joining a team where my experience deploying agentic systems in production under real constraints is directly applicable, and where I can learn from engineers solving problems at a scale I haven't encountered before.

Location-wise, I'm flexible. I've worked cross-border between US and Japan teams and thrived in that environment. Remote, Tokyo, or US-based — I can adapt.

### What the interviewer is testing
Motivation fit — are you running away from something (bad team, bad manager) or running toward something (OpenAI's mission, FDE role)?

### Follow-up prep
- "What if the role requires relocation to San Francisco?" — I'm open to it. I relocated to Japan independently for my master's degree and adapted successfully. I'd approach SF the same way.

---

## Q27: What's your familiarity with TypeScript/React?

**Answer:**

I built the **Parallel Multi-Agent Interviewer** using **React 19 + TypeScript + Vite** as the frontend. The application has a split-screen architecture:
- **Employee Interface:** distraction-free chat UI where employees interact with the Interviewer Agent
- **Management Dashboard:** real-time visualization of completion percentages across parallel sessions

I also implemented prompt-driven customization — agent behavior is defined in standalone `.txt` files with `{placeholder}` injection. Anyone can change interview style by editing a text file, not Python code.

I'm not a frontend specialist — my strength is backend and agent systems — but I'm proficient enough to build production-grade React+TypeScript applications when needed. For an FDE role, I'm comfortable building full-stack prototypes and customer-facing dashboards.

### What the interviewer is testing
Honest self-assessment — do you overclaim or can you accurately describe your skill level?
