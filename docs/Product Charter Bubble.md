# **Product Charter \-  Bubble** 

### **1\. Executive Summary**

This Product Charter outlines the strategic foundation for "Bubble," a product designed to empower product marketers (PMMs) by transforming their customer and market research process.

The core problem we are addressing is that PMMs are expected to derive strategic insights from messy, unstructured customer data, but their current tools are inadequate. Manual processes are time-consuming, and generic LLMs lack the built-in traceability and structured workflows required for more complex, high-stakes strategic work.

Bubble solves this by being an **agentic workflow builder** built on a **per-company knowledge graph**. Instead of a single hardcoded application, we provide pre-defined, specialized agents and workflows (e.g., for thematic analysis, persona generation) that our users can execute. This combines the power of LLMs with structured frameworks, turning scattered conversations into a dynamic, actionable, and trusted source of customer truth.

Our primary target audience is In-house and Freelance Product Marketing Managers at B2B SaaS companies.

The founders' core business objective is to achieve €25K MRR within three months of launch. This will be driven by a Product-Led Growth (PLG) motion, assisted by a partner-led strategy that leverages freelance PMMs.

The initial scope (MVP) is focused on providing the *first set* of pre-built agentic workflows to handle the core analysis of turning raw data from internal interviews, customer interviews, and sales calls into insights: centralizing inputs, thematic/framework mapping, consolidation, insight discovery, and reporting. We are explicitly *excluding* any user-facing workflow *builder*, data collection features, integrations, and advanced admin features for the initial launch.

### **2\. Product Vision & Mission**

* **2.1. Vision Statement**  
  Empower product marketers to lead with insights grounded in customer truths (versus opinions) that shape both product and go-to-market strategy.  
* **2.2. Mission Statement**  
  We do this by helping product marketers transform fragmented qualitative customer data into a dynamic, trusted and actionable source of insights.

### **3\. The Opportunity**

* **3.1. Problem Statement**  
  The core problem is that product marketers struggle to turn unstructured customer data into a dynamic, trusted, and actionable source of insights. This leads to organizational discussions being too opinion-driven.  
  PMMs are expected to turn messy data (interviews, call transcripts, etc.) into actionable insights. Their current toolkit is not designed for this:  
  1. **Manual and time-consuming processes:** Analyzing qualitative data is largely manual.  
  2. **Inconsistent and unscalable workflows:** Every marketer has their own process, leading to inconsistent results.  
  3. **Limited support from LLMs:** Tools like ChatGPT fall short. They have context limits, prompts are hard to standardize, and they offer no transparency or traceability ("black box" problem).

The result is that PMMs spend more time wrestling with data than driving strategy and cannot confidently defend their insights.

* **3.2. Why Now?**  
  PMMs are under pressure to leverage AI, but generic tools "break at scale" for their specific, systematic research needs. They don’t need another summarization tool; they need an efficient, scalable, and trustworthy workflow that turns scattered conversations into strategic insights.

### **4\. Target Audience & Personas**

* **4.1. Primary User Persona(s)**  
  We are building this solution specifically for Product Marketing Managers.  
  1. **In-house Product Marketing Manager (PMM)**  
  2. **Freelance PMM (Persona TBD)**

  **Persona Profile: PMM Amy (Tier 1\)**

  * **User Persona:** (Sr.) Product Marketing Manager.  
  * **She works at:** A Mid Sized B2B SaaS Company with 10 to 100 ARR.  
  * **Company Details:** B2B SaaS, HQ in EMEA or North America, focused on Increase Efficiency.  
  * **PMM Impact:** Often unclear. Perceived as a supporting role.

* **4.2. Secondary Audiences**  
  The consumers of the PMM's work:  
  * **Leadership**  
  * **GTM (Go-to-Market) Teams**  
  * **Product and Sales Functions**

### **5\. Goals & Objectives**

* **5.1. Business Goals**  
  (As defined by the founding team)  
  * **GTM Motion:** "PLG, partner assisted (through freelance PMMs)".  
  * **Long-Term (3-5 years):** Achieve MRR of EUR ≥1M; Avg. gross margin ≥80%; NRR ≥120%.  
  * **Headcount Efficiency:** EUR ≥1M ARR per FTE.  
* **5.2. Product Goals**  
  * **Primary Outcome:** "From Reactive Executors to Strategic Partners".  
  * Enable PMMs to "guide growth with trusted customer insight".  
  * Drive a "shift from opinion-driven to truth-driven decision-making".  
  * **Value Props:** Clarity & Focus, Confidence, Credibility, Speed & Scale.  
* **5.3. Key Objectives & Success Metrics (Business KPIs)**  
  * **Within 3 months after product launch:** Achieve MRR of EUR 25K; Avg. gross margin ≥70%; NRR ≥100%.  
* **5.4. Proposed Product KPIs (for discussion)**  
  * **Activation Rate:** % of new users who execute a full workflow (e.g., create and share their first report) within 7 days.  
  * **Core Task Completion:** Time to "First Insight" (e.g., time from first transcript upload to first insight generated).  
  * **Engagement/Adoption:** % of users who actively use the "Traceable Truth" feature to validate an insight.  
  * **Retention (Weekly):** % of users who return to add new data to an existing research project.  
  * **Pricing Model KPI measurements for billing:** to be defined.

### **6\. Strategic Imperatives & Guiding Principles**

* **Agentic Workflow Builder, Not a Hardcoded App:** This is our core technical principle. The product is not a single, monolithic tool. It is an agentic workflow builder. For the MVP, our internal team will create and provide specific, pre-built agents and workflows (e.g., "Persona Generator Agent," "SPICED Framework Agent") that our users can select and execute.  
* **Per-Company Knowledge Graph:** This is the foundation. Each customer has their own Knowledge Graph. The agentic workflows interact with this graph to store, connect, and retrieve insights.  
* **Partner-Led Ecosystem Strategy:** We will employ a partner-led strategy, bringing in Freelance PMMs to deliver "do it for me" services, using and promoting our tool.  
* **Optimized LLM, Not New LLM:** "LLMs perform better in Bubble... not because the models itself are different, but because of how Bubble is optimized around it for the product marketer".  
* **LLM Agnostic Setup:** Our architecture should be flexible and not dependent on a single LLM provider.  
* **Maximize Work Not Done:** We adhere to "the art of maximizing the amount of work not done" to maintain focus.

### **7\. Scope & Boundaries**

* **7.1. In Scope & Core Capabilities (The MVP/V1)**  
  The initial product version will focus on providing the core infrastructure and the first set of pre-built, admin-defined workflows.  
  **Core Product Attributes:**  
  * **Per-Company Knowledge Graph:** The foundational database.  
  * **Agentic Workflow Engine:** The backend system that can execute multi-step agentic workflows.  
  * **Internal Admin Panel:** For the *Bubble team* to define, create, and manage the agents and workflows that will be exposed to customers.  
  * **Chat as an interface:** For the Knowledge Graph (for report building and ICP persona chat). \[not final \- this depends on the agents and other factors\]

  **Core Workflow Capabilities (Enabled by our Pre-Built Agents):**

  1. **Centralized customer inputs:** Easily capture and organize customer inputs.  
  2. **Thematic Mapping:** (e.g., A "Thematic Agent" maps raw conversations into a codebook structure).  
3. **Framework Mapping:** (e.g., A "SPICED Agent" maps thematic data onto the SPICED framework).  
   **4\. Consolidation:** Consolidate framework-mapped data from many inputs into a single view.  
   **5\. Insights Discovery:** Quickly surface themes, patterns, and actionable insights.  
   **6\. Discovery Outcome:** The final report/output explaining customer truths.  
   **7\. Actionable Insights:** Provide actionable insights derived from the analysis.  
   **8\. Continuous Contextual Awareness:** Use existing data for new research and add new data to existing research.  
   **9\. Traceable Truth:** Ability to back all insights with direct quotes from customers.  
   **Initial Reporting (Pre-Built Workflow Outputs):**  
   * Must include templates for: VoC (Voice of Customer), ICP, Persona, and JTBD (Jobs to be Done).  
* **7.2. Out of Scope (Future Versions)**  
  To maintain focus, the following are explicitly out of scope for the MVP.  
  * **Customer-Facing Workflow Builder:** Users (like PMM Amy) *cannot* build, create, or modify agents or workflows. They can only *select and run* the ones we provide.  
  * **Data Privacy and Security (Advanced Features):** Automated PII redaction, intrusion detection, customer-managed keys, full audit trail, usage analytics.  
  * **Access Control (Advanced):** Fine-grained permissions, multi-team hierarchies.  
  * **Collecting Data:** Recording/transcribing interviews *with* Bubble.  
  * **Integrations:** *Any* API-based data imports (including HubSpot) or exports.  
  * **Reporting Insights (Advanced):** Reporting templates *other than* VoC, ICP, Persona, and JTBD.

### **8\. High-Level Data Concepts**  

**Note:** The following section outlines the co-founders' initial perspective on the data concepts (or "objects") required to power the product. This list is not a final technical specification or data model. The specific attributes (in parentheses) are examples to guide the conversation. This list will be the primary input for the technical team to evaluate, enrich, and formalize during the system design phase.

**Core (who & what):**

* User  
* Admin  
* Contact (Person\_id, Name, Email, Job\_title)  
* Persona (Persona\_id, Persona\_name)  
* Function (Team\_id, Team\_name)  
* Company (Company\_id, Company\_name, Company\_domain, etc.)  
* ICP (ICP\_id, ICP\_name, ICP\_segment)  
* Research project (Project\_id, Project\_name, Business\_objective, etc.)  
* Use case (Use\_case\_id, Use\_case\_name)

**Structuring Data Layer:**

* Data source (Source\_id, Type, Datetime, Channel, Language, Title)  
* Edge (Describes connections: Leads\_to, Mentioned\_in, Coded\_with, etc.)  
* Quotes (Quote\_id, Quote\_text, Quote\_speaker, Confidence\_score)  
* Code (Codebook) (Codebook\_id, Codebook\_name, Code\_id, Code\_name)  
* Framework (Framework\_id, Name, Description, e.g., SPICED, OST)  
* Theme (Conceptual "buckets" within a framework)

**Agentic Layer:**

* Agent (Agent\_id, Agent\_name, Prompt\_template, Model\_parameters)  
* Workflow (Workflow\_id, Workflow\_name, Agent\_sequence, Input\_type, Output\_type)

**Output Layer:**

* Template (VoC report template, ICP profile template, etc.)

**Audit Layer:**

* Owner (Who/what created/changed something: System, Agent, User)  
* LLM Ops (Tracks prompts, models, parameters, performance)  
* **8.1. Permissions & Auditing (MVP Logic)**  
  * **Data Inputs (e.g., Transcripts):** Cannot be deleted. Users *can* enhance or add context to them.  
  * **Codebooks:** Can be edited. A codebook *cannot* be deleted if it is currently in use by a research project.  
  * **Auditing:** All changes (enhancements, edits) must be auditable, trackable, and reversible.

### **Remaining To-Do Items:**

1. **Define Freelance PMM Persona.**  
2. **Review Proposed Product KPIs:** **Section 5.4**. If any feedback please let me know.  
   