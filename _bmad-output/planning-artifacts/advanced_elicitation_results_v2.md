# Advanced Elicitation Results (Round 2)

I have applied 5 **NEW** advanced elicitation methods to the Functional Requirements Draft.

## 1. Customer Support Theater (Collaboration)
*Method: Roleplaying an angry customer issue.*

**Scenario:** "I accidentally deleted the 'Q1 Research' workflow definition and now my team can't run it! Restore it!"
- *Gap:* We have no "Soft Delete" or "Trash Can" for Admin objects.
- *Recommendation:* Add safety for deletion.
    - [NEW] FR42: [MVP] System soft-deletes Admin objects (Workflows, Assets) allowing restoration within a grace period (e.g., 30 days).

**Scenario:** "My employee left the company. I removed them from Bubble, but they still have the PDF reports downloaded."
- *Gap:* We can't control downloaded files (obviously), but we *can* watermark them.
- *Recommendation:* Data Leakage Protection.
    - [NEW] FR43: [MVP] System applies a watermark (User Email + Timestamp) to all PDF exports.

## 2. Pre-mortem Analysis (Risk)
*Method: "The project failed in 6 months. Why?"*

**Cause:** "We have 10,000 runs, and the database is choked."
- *Gap:* No data retention policy.
- *Recommendation:* Automated cleanup.
    - [NEW] FR44: [Future] Bubble Admin can configure data retention policies (e.g., "Auto-archive runs older than 1 year").

**Cause:** "A user uploaded a 500MB video file disguised as a .txt and crashed the parser."
- *Gap:* File size limits are missing (we only have *type* limits in FR3).
- *Recommendation:* Explicit size limits.
    - [UPDATE] FR3: [Prototype] Bubble Admin can define strict input allow-lists (extensions) **and max file size limits**.

## 3. Red Team vs Blue Team (Security)
*Method: Adversarial Attack.*

**Attack:** "I found a 'Magic Link' to a report from 6 months ago. I can still access it."
- *Gap:* Magic Links should probably expire.
- *Recommendation:* Expiry controls.
    - [UPDATE] FR20: [Prototype] Guest can access specific reports via a secure magic link **that expires after a configurable duration (default 7 days)**.

**Attack:** "I injected a malicious prompt into the 'Feedback' field to trick the Reviewer Node."
- *Gap:* Input sanitization on the feedback loop.
- *Recommendation:* Explicit sanitization FR.
    - [NEW] FR45: [Prototype] System sanitizes and validates all user text inputs (Feedback, Forms) to prevent prompt injection attacks.

## 4. SCAMPER (Creative - "Substitute/Combine")
*Method: Simplifying features.*

**Idea:** Can we **Combine** "Form Inputs" (FR4) and "Company Assets" (FR10)?
- *Insight:* A "Codebook" is just a text input. Why treat it special?
- *Analysis:* Codebooks are reusable *Libraries*. Text inputs are *one-offs*. Keep them separate.
- *Result:* **No Change**. Validation that separate concepts are robust.

**Idea:** Can we **Eliminate** "Concurrent Execution" (FR13) for Prototype?
- *Insight:* Sequential processing is much easier to debug.
- *Recommendation:* Downgrade/Refine FR13.
- *Decision:* Keep FR13 but clarify limits (linked to our new FR37 "Safety Switch").

## 5. Comparative Analysis (Market)
*Method: "What does Dovetail/ChatGPT Enterprise do?"*

**Feature:** ChatGPT Enterprise allows "Shared Workspaces".
- *Gap:* FRs talk about "Tenant" and "User", but not "Teams" or "Groups".
- *Observation:* For B2B Enterprise, "Teams" are critical later, but for MVP, "Tenant = One Big Team" is fine.
- *Recommendation:* Explicitly defer "Teams".
- *Action:* Mark "Team Management" as a known [Future] requirement (no new FR needed now, but good to know).

---

## Summary of Round 2 Recommendations

1.  **Safety/Recovery:** [MVP] Soft Deletes (FR42), [Prototype] Watermarking (FR43).
2.  **Performance/Stability:** [Prototype] File Size Limits (Update FR3), [Future] Retention Policies (FR44).
3.  **Security:** [Prototype] Magic Link Expiry (Update FR20), [Prototype] Input Sanitization (FR45).

**Total New FRs:** 3
**Total Updated FRs:** 2 (FR3, FR20)
