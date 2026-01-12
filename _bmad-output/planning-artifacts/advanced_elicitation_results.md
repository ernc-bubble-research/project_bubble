# Advanced Elicitation Results

I have applied 5 advanced elicitation methods to the draft Functional Requirements. Here are the findings and recommended additions.

## 1. Failure Mode Analysis (Risk)
*Method: Systematically exploring how components could fail.*

**Gap Detected:** The draft mentions "System queues workflow" and "Re-runs", but lacks clarity on **Partial Failures**.
- *Scenario:* A 3-node workflow fails at Node 2. Does the whole thing abort? Can it be resumed?
- **Recommendation:** Add FRs for partial failure handling and resumption.
    - [NEW] FR34: System can persist intermediate state at each node completion to allow resumption after failure.
    - [NEW] FR35: Bubble Admin can configure retry policies (count, backoff) for specific node types.

## 2. User Persona Focus Group (Collaboration)
*Method: "Amy" (PMM) and "The Architect" review the list.*

**Gap Detected:** "Amy" (PMM) worries about cost/credits.
- *Insight:* "I'm running 20 interviews. What if I run out of credits halfway? Do I lose my work?"
- **Recommendation:** Add FRs for quota/credit visibility.
    - [NEW] FR36: Creator can view estimated cost/credit usage before executing a workflow.
    - [NEW] FR37: System pauses execution if tenant credit limits are reached, preserving state.

**Gap Detected:** "Architect" needs to debug logic.
- *Insight:* "If a workflow produces weird results, how do I see what the raw LLM prompt was?"
- **Recommendation:** specific FR for debug visibility (beyond just "audit log").
    - [NEW] FR38: Customer Admin can view full execution traces (Input -> Prompt -> Raw Output) for debugging purposes.

## 3. Cross-Functional War Room (PM + Dev + Design)
*Method: Assessing trade-offs.*

**Gap Detected:** "Multimodal Inputs" in MVP.
- *Insight:* Dev argues that parsing "Charts/Slides" is hard for Phase 1 (Prototype). PM agrees to limit this but needs *strict rejection*.
- **Recommendation:** Refine FR3 (Input Schemas) to explicit "allow-list" behavior.
    - [UPDATE] FR3: Bubble Admin can define strict input allow-lists (e.g., "only .txt, .docx"); System rejects non-compliant files at upload.

## 4. Challenge from Critical Perspective (Risk)
*Method: Devil's Advocate / Security.*

**Gap Detected:** "Guest" access via Magic Link.
- *Challenge:* "If I send a link to a client, can they see *other* reports or my whole dashboard?"
- **Recommendation:** Explicitly constrain Guest capabilities.
    - [NEW] FR39: Guest access is strictly scoped to the specific Report UUID linked in the magic link.
    - [NEW] FR40: Creator can revoke active magic links to terminate Guest access.

## 5. Reverse Engineering (Creative)
*Method: Working backwards from the "Ideal Verification Loop".*

**Gap Detected:** The "Human Feedback Loop" (FR18) implies the system "knows" what to fix.
- *Insight:* How does the user tell the system *which* part of the 50-page report is wrong?
- **Recommendation:** Granular feedback targeting.
    - [NEW] FR41: Creator can target feedback to specific report sections or specific data nodes (e.g., "Fix only the 'Pricing' section").

---

## Summary of Proposed Changes

I recommend adding **8 New FRs** and updating **1 FR** based on this analysis.

1.  **Resumption & Retries** (FR34, FR35)
2.  **Cost/Credit Protection** (FR36, FR37)
3.  **Deep Debugging** (FR38)
4.  **Strict Guest Scoping** (FR39, FR40)
5.  **Granular Feedback** (FR41)
