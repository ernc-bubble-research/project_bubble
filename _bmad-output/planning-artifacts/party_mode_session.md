# 🎭 Party Mode Session: FR Review

**Topic:** Functional Requirements Draft Review for Project Bubble (Prototype/MVP)
**Participants:**
- 📋 **John (PM):** Host, focusing on user value.
- 🏗️ **Winston (Architect):** Focusing on feasibility and system integrity.
- 🎨 **Sally (UX):** Focusing on flow and user experience.
- 🧪 **Murat (QA):** Focusing on testability and edge cases.
- 💻 **Amelia (Dev):** Focusing on implementation reality.

---

**John (PM):** "Alright team, we have a solid draft of the Functional Requirements. We've done some deep elicitation already, but I want a final sanity check before we lock this in. Prototype is our first target. Winston, you first?"

**Winston (Architect):** "I'm looking at **FR24 (Snapshots)** and **FR25 (Revert)**. For a Prototype, implementing full 'Time Travel' for the Knowledge Graph is... ambitious.
*Technically*, we can do it, but are we sure we need *User-Initiated Revert* on Day 1? It implies a UI for browsing history.
*Suggestion:* Can we downgrade FR25 to [MVP] or make it Admin-API only? The UI complexity is high."

**Sally (UX):** "Agreed. Designing a 'History Browser' is a whole feature set. We have **FR25** marked as `[Prototype]`. If users can't see what they are reverting to, it's dangerous.
*Question:* Do users *need* to revert in the Prototype, or just Admins fixing broken graphs?"

**John (PM):** "Valid point. The user story was 'If data corrupts the brain'. It sounds like an Admin function initially. Let's change FR25 to allow **Bubble Admin** execution only for Prototype, not Customer Admin."

**Murat (QA):** "I'm looking at **FR41 (Granular Feedback)** which is `[MVP]`. Good call moving it out of Prototype.
But for **FR16 (Verify Assumptions)** - how do we test 'System-flagged assumptions'?
*Risk:* If the LLM *doesn't* flag anything, does the UI look broken? We need a 'Force Flag' mode for testing the UI."
*Suggestion:* Add an FR for **Testability**: 'System accepts flagged inputs to force UI states for testing'."

**Amelia (Dev):** "Checking **FR3 (Strict input allow-lists)**. We added 'max file size limits'.
*Detail:* We need to clarify *where* this happens. Is it the Frontend blocking the upload, or the Backend rejecting it?
*Constraint:* Backend rejection is safer, Frontend is nicer.
*Update:* Let's ensure FR3 implies API-level enforcement. 'System rejects...' covers it, so it's fine."

**John (PM):** "What about the new **FR37 (Usage Limits)**? We agreed on hard limits.
*Question:* What happens to the user? Do they just get an error?
*Sally (UX):* "An error is ugly. They should see a 'Quota Exceeded' state in the Storefront so they don't even try to click 'Run'.
*Refinement:* Let's verify **FR36 (Cost Estimator)** is [MVP]. Since we don't have a meter, the 'Hard Limit' (FR37) error needs to be friendly."

**Winston (Architect):** "One more thing. **FR30 (RLS)**. This is a big architectural decision.
*Confirmation:* We are committing to Postgres RLS. This means our 'Bubble Admin' needs 'Bypass RLS' privileges to manage tenants (FR26).
*Check:* Is **FR26** sufficient? 'Bubble Admin can provision new tenants'. It implies super-user access. I'm comfortable with it."

**Sally (UX):** "I see **FR8 (Initiate Workflow)** and **FR11 (Form Inputs)**.
*Gap:* Do we have an FR for 'Validating Input' *before* submission? Like, if a field is required?
*John (PM):* That's standard web behavior, but for 'Agentic' workflows, inputs might be complex.
*Suggestion:* Let's explicitly add **FR46**: 'System validates all mandatory inputs (Files, Forms) are present before allowing Workflow submission'."

**Murat (QA):** "Final check on **FR20 (Magic Links)**. We added Expiration.
*Testability:* Can we configure this to 1 minute for testing?
*Update:* 'Configurable duration' covers it. Good."

---

**Consensus Actions:**
1.  **Refine FR25:** Restrict 'Revert' to Bubble Admin for Prototype.
2.  **Add FR46:** Client-side validation before submission (Prevent frustration).
3.  **Note on FR16:** Testing mode consideration (maybe NFR, but good to note).
4.  **Confirm FR37 UI:** Needs a specific error state/message, even if simple.

**John (PM):** "Great session. I'll add FR46 and tweak FR25. Break!"
