# 🎭 Party Mode Session: Final FR Review (Round 2)

**Topic:** Final Scrub of Functional Requirements (inc. Round 3 additions)
**Participants:**
- 📋 **John (PM):** Host.
- 🏗️ **Winston (Architect):** Feasibility check.
- 🎨 **Sally (UX):** User flow check.
- 🧪 **Murat (QA):** Edge case check.

---

**John (PM):** "Okay folks, we're in the endgame. We added some critical safety valves: **Max Steps (FR47)**, **Asset Indexing (FR48)**, **Seeding (FR51)**, and **GDPR (FR50)**. Let's validate."

**Winston (Architect):** "On **FR48 (Ingest & Index)**.
*Check:* We specified text extraction *and* embedding.
*Implication:* This confirms we need a Vector component in Postgres (`pgvector`) from Day 1.
*Verdict:* Approved. It's unavoidable if we want the assets to be useful."

**Murat (QA):** "Looking at **FR47 (Max Steps)**.
*Scenario:* What if a valid workflow *needs* 51 steps?
*Mitigation:* The FR says 'e.g., 50 steps'. Ideally this is a configurable constant in the backend. I don't see a need for a UI setting yet.
*Verdict:* Safe default is fine for Prototype."

**Sally (UX):** "I love **FR51 (Onboarding Seeds)**.
*Process:* When a new tenant is created (FR26), we just copy a 'Golden Pattern' set of workflows?
*John (PM):* Exactly.
*Sally:* Good. Empty states are credibility killers. This is a huge UX win."

**Winston (Architect):** "Finally, **FR49 (Service Status)**. We generalized it to 'LLM Provider'.
*Technique:* We'll likely need a simple 'Health Check' poller that pings Gemini/Anthropic/Whoever we use.
*Constraint:* Deferred to `[MVP]`. Smart move. For Prototype, if it's down, it's down."

---

**Consensus:**
The team is Unanimous. The requirements are:
1.  **Technically Feasible** (Hexagonal Arch supports the Graph/Vector needs).
2.  **User Centric** (Seeding, Friendly Errors).
3.  **Safe** (Limits, Quotas).

**No further changes recommended.**
