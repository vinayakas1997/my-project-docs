# Category 4: Cross-Border / Customer-Facing

---

## Q17: You were the bridge between US engineers and Japan factory teams. How did you handle a disagreement on test criteria?

**Answer:**

**Scenario:** The US startup defined acceptance criteria based on their lab testing environment — 50 concurrent Wi-Fi nodes, ideal network conditions, short test runs. The Japan factory needed it to work with 200+ nodes, on a factory floor with heavy RF interference, running continuously for 8-hour shifts.

**What I did:**
1. **Translated the gap technically** — I ran a quick test on the Japan side showing packet loss at 150+ nodes that didn't occur at 50 nodes. This gave me data, not opinions.
2. **Facilitated a structured hand-off** — I didn't relay messages. I set up a joint call where the US team could see the Japan factory floor (Wi-Fi environment, node placement, RF sources) and the Japan team could see the US test setup. Both sides understood the environmental difference immediately.
3. **Proposed a phased acceptance plan** — Phase 1: US criteria at 50 nodes (pass). Phase 2: Japan-modified criteria at 150+ nodes with known mitigation (software fix, described in Q18). This gave both sides a win.

**Result:** US team agreed their lab was optimistic. Japan team agreed to accept Phase 1 conditions while the fix was validated. Product was accepted 2 weeks later.

### What the interviewer is testing
Stakeholder management — can you resolve conflicts with data and process, not politics?

---

## Q18: Walk me through the zero-data transmission bug — how did you diagnose it and what was the fix?

**Answer:**

**Symptom:** Under production load, the power tester would intermittently transmit zero values for voltage and power readings — no data correlation with specific node IDs or time patterns.

**Diagnosis process:**
1. **Data analysis** — I aggregated transmission logs and found zero-data events always occurred after a specific node count threshold (~120+ concurrent nodes).
2. **Stress test design** — I designed a progressive stress test: start at 50 nodes, ramp by 10 each cycle, measure packet success rate at each level.
3. **Root cause identification** — At 130+ nodes, the shortest-path routing algorithm used by the mesh network hit its computational limit. The algorithm was designed for static topologies but the factory environment had mobile nodes (operators moving around). When the routing table exceeded a certain size, route computation time exceeded the packet TTL.
4. **Cross-validation** — I shared the pattern with the US team, who confirmed the algorithm had a known O(n²) complexity characteristic that they'd never hit in their smaller lab setup.

**Fix:** Drove a **software logic update** to dynamically reset shortest-path parameters when node count crossed thresholds. Instead of a static routing table, the system periodically recomputed paths based on current active nodes, preventing the O(n²) blowup.

### What the interviewer is testing
Debugging skill — methodical root-cause analysis, not random trial-and-error.

### Follow-up prep
- "Why didn't the US team catch this?" — Their lab had 50 nodes. They never hit the threshold. The fix was a static→dynamic routing parameter that made the system production-ready.
- "Was this a firmware or software fix?" — Software update to the edge controller's routing logic. No hardware changes.

---

## Q19: How did you prioritize between US engineering's roadmap and Japan factory's urgent needs?

**Answer:**

**Framework I used:** Three questions for every request:
1. **Impact:** What breaks if we don't do this?
2. **Urgency:** When does this need to ship?
3. **Ownership:** Whose expertise is needed to solve it?

**Example:** The zero-data bug (Q18) — the Japan factory couldn't use the power tester reliably. This blocked production analytics and ML efficiency calculations. Impact was high. Urgency was high. US team owned the routing algorithm code. So I:
- Escalated immediately with data (stress test results showing the threshold)
- Proposed the fix concept (dynamic parameter resets)
- Let US team implement (they knew the codebase)
- Validated the fix on Japan's floor (I knew the environment)

**Other requests** (like minor UI localization, report format changes) — I batched those into a weekly list and handled them myself or pushed to the next release.

### What the interviewer is testing
Real-world prioritization — FDEs are constantly torn between customer needs and engineering roadmaps.

### Follow-up prep
- "Did you ever say no to something?" — Yes. Japan team wanted real-time OSLC integration for traceability. I explained it was a 6-month project with diminishing returns for the current use case. We logged it as a roadmap candidate for the next product version.
