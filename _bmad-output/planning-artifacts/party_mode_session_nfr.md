# 🎭 Party Mode Session: NFR Validation

**Topic:** Non-Functional Requirements (Performance, Scale, Compliance)
**Participants:**
- 📋 **John (PM):** Host.
- 🏗️ **Winston (Architect):** System Design.
- 🔧 **Dave (DevOps/Infra):** Deployment & Scale.
- 🧪 **Murat (QA):** Testing limits.

---

**John (PM):** "Team, we have the NFRs. Scalability is now 'Configurable per Tenant' and Compliance mandates 'Tenant-Level DB Routing'. Let's stress test this."

**Winston (Architect):** "The **Compliance/DB Routing** requirement is the heavy hitter here.
*Implementation:* This implies a 'Dynamic Connection Provider' in NestJS. We can't just boot up with one DB_URL. We need a lookup optimization so we don't add 500ms latency to every request resolving the DB location.
*Verdict:* Doable, but it adds complexity to the bootstrap phase. We'll need a fast 'Tenant Registry' (likely Redis) to map `TenantID -> DB_Connection_String` instantly."

**Dave (DevOps):** "On **Scalability (Configurable Concurrency)**.
*Tooling:* We'll use BullMQ for the job queues. It natively supports `concurrency` settings.
*Constraint:* To make this 'Per Tenant', we'll need dynamic queues (e.g., `queue-{tenantId}`).
*Risk:* If we have 1,000 tenants, do we have 1,000 queues? Redis can handle it, but monitoring will be noisy.
*Mitigation:* For Prototype (FR Limit = 5), maybe we just have `Priority` queues (High/Med/Low) and map tenants to tiered queues.
*Winston:* No, the FR says 'Admin-configurable limit'. We should probably stick to `limiter` per job group in BullMQ Pro, or just code a check before enqueueing. 'Check DB: if ActiveRuns >= Limit, reject.' Simple."

**Murat (QA):** "I'm looking at **Performance: < 200ms UI Latency**.
*Concern:* If we are doing 'Tenant DB Routing' + 'RLS Checks' on every query, 200ms is tight for the Evidence Drawer.
*Scenario:* User clicks citation -> Backend resolves Tenant DB -> Backend Context sets RLS -> Query -> Result.
*Suggestion:* We MUST use connection pooling efficiently. If we tear down connections per request, we'll miss the 200ms target.
*Verdict:* Acceptable target, but 'Connection Pooling' is a hidden dependency."

**John (PM):** "What about **Reliability (Zero Data Loss)**? Persisting state after *every* node?"
**Dave (DevOps):** "Standard LangGraph behavior uses a Checkpointer. Using Postgres as the checkpointer is fine. It adds write-load, but for the Prototype (Analyst Workflows), raw IOPS won't be the bottleneck. The LLM latency (seconds) dwarfs the DB write (milliseconds). Safe."

---

**Consensus Actions:**
1.  **Architecture:** Plan for a "Tenant Registry" (Redis/Cache) to speed up DB Routing (Critical for performance).
2.  **Implementation:** Implement Concurrency Limits via a "Pre-flight Check" (Count active runs in DB) rather than complex dynamic queues for Prototype. Simple is better.
3.  **Validation:** QA to load test the "DB Routing" overhead to ensure we stay under 200ms.

**Final Verdict:** The NFRs are aggressive but realistic *if* we implement the caching layer correctly.
