# 🎭 Party Mode Session: Architecture Context Validation

**Topic:** Architecture Constraints (Node.js/RLS/Async State)
**Participants:**
- 📋 **John (PM):** Host.
- 🏗️ **Winston (Architect):** Robustness.
- 🔒 **Sarah (Security):** Data Isolation.
- 🔧 **Dave (DevOps):** Scale & Reliability.

---

**John (PM):** "Team, we've decided on **Node.js** for the engine, **Postgres RLS** for security, and a strict **Async/Queue** model. Winston, Sarah, Dave—attack this plan."

**Sarah (Security):** "I'm looking at the **RLS Middleware**.
*Risk:* If you use a standard ORM like TypeORM or Prisma without care, it often pools connections. If Request A sets `SET app.current_tenant = 1`, and the connection goes back to the pool, and Request B picks it up... Request B is now effectively logged in as Tenant 1. **Leak!**
*Solution:* We MUST use a 'Transaction-Per-Request' model or a library that guarantees `SET LOCAL` is used (which resets at transaction end). Standard pooling is dangerous here.
*Action:* Mandate `SET LOCAL app.current_tenant` inside a transaction block for every single operation."

**Winston (Architect):** "Agreed. Now, regarding **Node.js for Agents**.
*Risk:* The Event Loop. If an Agent does a heavy JSON parsing operation (CPU bound) on a 10MB file, it blocks the main thread. No other requests get served.
*Solution:* We cannot run heavy agents in the Main API process.
*Action:* We need a **Worker Service** distinct from the **API Service**. The API just pushes to Redis. The Worker pops and processes. If the Worker blocks, it doesn't kill the Storefront UI."

**Dave (DevOps):** "On **State Persistence (Postgres Checkpointing)**.
*Concern:* If we save state after *every* node, and we have 1,000 concurrent agents each running 50 steps... that's 50,000 writes/second.
*Solution:* Is Postgres ready for that write load? For Prototype: Yes. For MVP Scale: We might need to optimize.
*Optimization:* Maybe we only checkpoint 'Critical State' (User Input / LLM Output) and skip diverse intermediate thinking steps.
*Winston:* No, for debugging, let's persist everything for now. We can optimize later. Premature optimization."

---

**Consensus Actions:**
1.  **Security:** Mandate `SET LOCAL` within Transactions to prevent Connection Pool leaking.
2.  **Architecture:** Strict separation of **API Service** (Fast) vs **Worker Service** (Heavy). They never run in the same process.
3.  **Scale:** Accept the Write-Heavy pattern for Prototype to gain Debuggability.
