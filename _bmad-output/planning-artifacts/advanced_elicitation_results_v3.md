# Advanced Elicitation Results (Round 3)

Applying 5 specialized/niche methods to find final edge cases.

## 1. Tree of Thoughts (Logic/Algorithmic)
*Method: Exploring multiple reasoning paths for Workflow Execution.*

**Path A: Infinite Loops.**
- *Scenario:* User creates a workflow A -> B -> A.
- *Check:* FR37 limits "runs/month" (tenant level). But a single run could spin forever if counting "steps".
- *Gap:* We need a "Max Steps per Run" or "Cycle Detection".
- *Recommendation:* Add Safety Cap.
    - [NEW] FR47: [Prototype] System enforces a "Max Steps per Model Run" limit (e.g., 50 steps) to prevent infinite loops.

## 2. Mentor & Apprentice (Clarity/Definitions)
*Method: Senior Dev explaining "Company Assets" to Junior.*

**Question:** "Is a Codebook just a file? Or is it processed?"
- *Answer:* FR23 says "Manage Assets". FR10 says "Bind Assets".
- *Gap:* The system needs to *process* these assets (chunk/embed) for the LLM to use them. Just "uploading" isn't enough.
- *Recommendation:* Explicit processing requirement.
    - [NEW] FR48: [Prototype] System ingests and indexes Company Assets (text extraction + embedding) upon upload for retrieval.

## 3. Chaos Monkey (Resilience)
*Method: Breaking components randomly.*

**Scenario:** "The LLM Provider (OpenAI) goes down for 1 hour."
- *Check:* FR34 covers resumption. FR35 covers retry policies.
- *Gap:* Does the user know? Or do they just see "Spinning Wheel"?
- *Recommendation:* Status visibility.
    - [NEW] FR49: [MVP] System displays "Service Status" banners for downstream dependencies (e.g., "OpenAI API Degraded"). (Deferred to MVP).

## 4. Security Audit Personas (Compliance)
*Method: GDPR Expert review.*

**Scenario:** "User asks to be forgotten (GDPR)."
- *Check:* We have "Soft Delete" (FR42). But do we scrub PII from the "Knowledge Graph"?
- *Gap:* If the Graph stores "Interaction Data" (FR21), that might include PII.
- *Recommendation:* PII Purge.
    - [NEW] FR50: [Future] Bubble Admin can execute "Right to be Forgotten" commands to scrub specific user PII from Logs and Knowledge Graph.

## 5. Hindsight Reflection (Long-term Value)
*Method: "It's 2027. Why did users churn?"*

**Reason:** "They never learned how to use it. The 'Storefront' was empty."
- *Check:* FR7 says "Browse admin-defined workflows".
- *Gap:* We need a "Onboarding / Sample" content.
- *Recommendation:* Seeding.
    - [NEW] FR51: [Prototype] System initializes new Tenants with a set of "Template Workflows" and "Sample Assets" to aid onboarding.

---

## Summary of Round 3 Recommendations

1.  **Safety:** [Prototype] Max Steps Limit (FR47).
2.  **Functionality:** [Prototype] Asset Indexing/Processing (FR48).
3.  **Resilience:** [MVP] Service Status UI (FR49).
4.  **Compliance:** [Future] GDPR/PII Scrubbing (FR50).
5.  **Onboarding:** [Prototype] Seed Content (FR51).

**Total New FRs:** 5
