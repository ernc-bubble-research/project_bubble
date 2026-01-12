# **Bubble \- Initial Product Definition Brainstorm**

## 

## **Section A: 📋 Internal Admin Panel Specifications**

### **1\. 🏛️ Foundational Data Model Definitions**

Three distinct classes of data have been identified and formally defined that the entire "Bubble" platform must be architected to handle.

#### **1.1. Agent Knowledge**

* **Definition:** This is the agent's "brain" or instruction file (e.g., coder\_v3\_0\_4.md). It contains the agent's persona, instructions, logic, and internal frameworks (like SPICED).  
* **Scope:** It is fixed per workflow type.  
* **Managed By:** Admins only.

#### **1.2. Transactional Inputs**

* **Definition:** This is the dynamic, raw data provided by the end-user for a specific workflow run.  
* **Example:** A PMM's single interview transcript or a batch of 20 transcript files.  
* **Scope:** It changes with every single run.  
* **Managed By:** The end-user (PMM).

#### **1.3. Company Assets**

* **Definition:** A new, critical data class defined to solve the "Codebook" problem. It is a "living document" that is specific to a Company or Project.  
* **Key Insight:** This asset cannot "belong" to a single agent. It must be linked to the Company so that multiple agents (e.g., the QDA Agent and the Consolidation Agent) can read from and write to it.  
* **Architectural Mandate:** The backend must be built to support this "Company-linked" model from Day 1\. A "per-agent" asset model has been rejected as unworkable.  
* **Example:** A Codebook, a list of Company Competitors, etc.

### 

### 

### 

### 

### 

### **2\. ❌ Key Architectural Decisions (Out of Scope)**

To maintain focus, the following features are explicitly out of scope for this plan.

**"Framework Manager": REMOVED**

* **Reason:** Frameworks (like SPICED) are defined as an internal, non-manageable component of an Agent Knowledge file. They are not a separate asset for the Admin to manage.

**"Template Manager": REMOVED**

* **Reason:** The product will not "manage" separate template files. The "Agent Knowledge" file will define the output structure. The "Bubble" Web UI will be responsible for rendering that agent-generated output and providing a "download" option.

### **3\. ⚙️ The "Internal Admin Panel": Detailed Feature Suite & Phasing**

This is the complete and detailed specification for the "Internal Admin Panel," broken into its six core components and two development phases.

#### **Phasing Strategy**

A two-phase rollout is defined:

* **Phase 1 (Prototype):** Built to service initial "friendly customers" via a high-touch, admin-managed process.  
* **Phase 2 (MVP):** Built to support the "Product-Led Growth (PLG)" motion and "credit-based freemium model" with self-service features.

#### **Phase 1 (Prototype) Features**

##### **3.1. Customer Manager**

* **Purpose:** To create and manage the core customer entities.  
* **Features:** A UI for the Admin team to:  
  * Create a Company entity (e.g., "Acme Corp").  
  * Create User accounts (e.g., "PMM Amy") and link them to that Company.  
  * Set a user's role (e.g., Admin vs. User).

##### **3.2. Company Asset Manager (Phase 1\)**

* **Purpose:** To manage "Company Assets" on behalf of prototype customers.  
* **Features:** An Admin-facing UI for the team to upload a "Company Asset" (e.g., codebook.csv) and "assign" it to a specific Company..  
* **Flow:** The prototype customer emails their Codebook, and Admins upload it for them.

##### **3.3. Agent Manager (The Library)**

* **Purpose:** To build and manage the library of available agents (the "brains").  
* **Features:**  
  * **Upload:** A UI to upload new "Agent Knowledge" files.  
  * **Version Control:** A system to track agent versions (e.g., coder\_v3\_0\_4 vs. coder\_v3\_0\_5). This must show which workflows are using which version to prevent breaking changes.  
  * **I/O Definition:** A UI to define the agent's "data contract." This tells the system what the agent Expects (Inputs) (e.g., 1x Transactional Input, 1x Company Asset (Codebook)) and what it Produces (Outputs) (e.g., 1x Report File). This allows the "Workflow Manager" to connect it.

##### **3.4. Workflow Manager (The Factory)**

* **Purpose:** To build, manage, and publish the single-agent and multi-agent workflows that PMM customers will run.  
* **UI Metaphor:** A node-based, "Zapier-like" visual canvas for the Admin team.  
* **Detailed Requirements (Data Flow):**  
  * **Requirement 1: "Fan-Out" (Map):** To solve the "1-to-Many" problem (e.g., 20 transcripts to 20 QDA jobs).  
    * **Solution:** The connection (the "arrow") from \[Input\] to \[QDA Agent\] must be configurable. The Admin will select: "Data Iteration Strategy: Process each file as a separate, parallel job."  
  * **Requirement 2: "Parallelism" (Cost/Speed):** To solve the "how many run at once" risk.  
    * **Solution:** The Agent Node itself must have a configuration setting for "Max Parallel Runs: \[e.g., 5\]". This allows the Admin to precisely control the tradeoff between speed and system cost/load.  
  * **Requirement 3: "Fan-In" (Reduce):** To solve the "Many-to-1" context window risk (e.g., 20 QDA outputs \-\> 1 Consolidation).  
    * **Solution:** The connection from \[QDA Agent\] to \[Consolidation Agent\] must have a "Data Aggregation Strategy" setting. This is defined as "Iterative Reduction" (feed outputs one-by-one).  
  * **Explicit Decision:** A "Send summaries only" option was rejected, as it violates the "Traceable Truth" principle.

#### **Phase 2 (MVP) Features**

##### **3.5. Billing & Entitlement Manager**

* **Purpose:** To manage the commercial logic of the PLG freemium model.  
* **Features:** A UI for the Admin team to:  
  * Define subscription plans (e.g., "Free Plan", "Pro Plan").  
  * Define the "credit cost" for running specific agents or workflows (e.g., QDA \= 1 credit, Consolidation \= 10 credits).  
  * Assign a monthly credit allowance to each plan (e.g., "Free Plan \= 100 credits/month").  
  * Assign Companies to their respective plans.

##### 

##### **3.6. System Dashboard / Audit Log**

* **Purpose:** To monitor platform health and track usage.    
* **Features:** A dashboard for the Admin team to:  
  * Monitor a log of all workflow runs and see failed runs (with error details).  
  * Track and display credit consumption per Company against their monthly allowance.  
  * View a searchable "Audit Log" of all system changes.

##### 

##### **3.7. Company Asset Manager (Phase 2\)**

* **Purpose:** To enable self-service PLG.  
* **Features:** This is the planned evolution of the prototype feature. The Customer-facing UI will be built to allow PMMs to upload, manage, and assign their own "Company Assets" (like Codebooks) directly.

## 

## **Section B: 🏪 PMM-Facing Product ("The Storefront") Specifications**

### **1\. 🏛️ Architectural Definitions & Data Strategy**

These definitions have been refined to ensure scalability and reusability.

#### **1.1. The "Global Data Vault" (File Storage)**

* **Definition:** The raw storage layer (e.g., S3/Blob Storage) acting as a "dumb container" for files.  
* **Global Scope Strategy:** "Project-Specific Storage" is explicitly rejected. Files are stored Globally at the Company level.  
* **Rationale:** This ensures Data Reusability. A transcript uploaded for "Project A" must be selectable for "Project B" without requiring the user to re-upload or duplicate the file.  
* **Persistence Rule:** Files Cannot be Deleted by the user. They can only be Archived.  
* **Reason:** To preserve the "Traceable Truth" audit trail. If a file is deleted, the citations in previous reports would break.

#### **1.2. The "Company-Wide Knowledge Graph" (The Intelligence)**

* **Definition:** The graph database that stores the intelligence extracted from the files (Entities, Relationships, Insights), but not the files themselves.  
* **Scope:** Company-Wide. It acts as the cumulative memory of the organization.  
* **Role of "Project":** A "Project" is not a separate graph. It is a Contextual Filter applied to the Company-Wide Graph. It highlights only the nodes/edges relevant to that specific workflow run.

#### **1.3. Project Definition: "The Instance Model"**

* **Decision:** The architecture pivots from a "Folder" model to an "Instance" model.  
* **Definition:** A "Project" is the Instance of a Workflow Run.  
* **Creation Logic:** A Project is not created empty. It is created at the moment of execution.  
* **Old Flow:** Create Project Folder \-\> Add Files \-\> Select Workflow.  
* **New Flow:** Select Workflow \-\> Select Files \-\> Run \-\> Project Created.  
* **Implication:** This simplifies the data model (flat structure) but requires the "Run Wizard" to handle file selection from the Global Vault.

### 

### **2\. 👤 User Experience: The "Storefront" Journey**

#### **2.1. The Workflow Library**

* **UI Metaphor:** A visual gallery of "Workflow Cards" (e.g., "QDA Analysis," "Persona Generator").  
* **Content Source:** Populated dynamically from the "Agent Knowledge" files uploaded in the Admin Panel.  
* **Visibility Logic (Admin Control):**  
  * The Library must respect Visibility Rules set in the Admin Panel.  
  * **Use Case:** A Company on the "Free Plan" might not see the "Strategic Synthesis" card. Or a specific Company might see a "Custom Workflow" built just for them.

#### **2.2. The "Dynamic Run Wizard" (The Launchpad)**

* **Context:** This is the most critical interaction. It bridges the gap between the User's Files and the Agent's Data Contract.  
* **UI Behavior:** When a user clicks "Run" on a card, a modal appears. This modal is dynamically generated based on the specific Inputs/Outputs defined for that Agent in the Admin Panel.  
* **Wizard Step 1: Select Inputs (Transactional)**  
  * **Source:** The user sees their company's Global Data Vault.  
  * **Action:** User selects specific files (e.g., "Select these 5 transcripts") OR uploads new ones right there.  
  * TRANSCRIPT META DATA TAG SHOULD INCLUDE TYPE (sales, support etc different weights)   
  * AN AGENT SHOULD MAKE A SUGGESTION ON FILE SELECTION. NEW ADDITION.  
* **Wizard Step 2: Select Context (Company Assets)**  
  * **Requirement:** The Agent requires a Codebook.  
  * **Behavior:** The system pre-selects the Company's "Active Codebook" (Default). The user can override this by selecting a different asset from the library.  
* **Wizard Step 3: Define Research Goal (Mandatory)**  
  * **Requirement:** The user MUST provide a goal to guide the agent's focus.  
  * **Input Format:** Polymorphic.  
    * **Option A:** Text Input (e.g., "Focus on pricing complaints").  
    * **Option B:** File Upload (e.g., Upload a rigorous research brief).  
  * **Metadata:** This input becomes the Description/Name of the resulting Project instance.  
* **Wizard Step 4: Asynchronous Launch**  
  * **Action:** User clicks "Run."  
  * **UI Requirement:** The UI must never freeze. The job is submitted to the queue, and the user is returned to the dashboard with an "In Progress" status indicator.

### **3\. 🧠 Execution & Validation Logic**

#### **3.1. Zero-Touch Execution (Default)**

* **Decision:** All Workflows (whether Single-File or Multi-File) run in Zero-Touch Mode by default.  
* **The Problem Solved:** "Interactive Mode" (Chat) is identified as incompatible with Batch Processing (e.g., 20 files), as 20 agents asking clarifying questions simultaneously would be a UX disaster. (i.e. Mental DoS Attack)  
* **The Logic:** Agents are instructed via their System Prompt to LOG ambiguities rather than stopping to ask about them. They make a "Best Guess" assumption and proceed.

#### **3.2. The "Correction Loop" (Validation Strategy)**

* **Context:** This strategy addresses how to fix wrong assumptions from the Zero-Touch run without wasting tokens/credits.  
* **Step 1: The Warning:**  
  * The Final Report UI displays a "Validation Log" (e.g., "⚠️ 5 Assumptions Made").  
* **Step 2: The Verification UI:**  
  * User clicks the warning.  
  * System displays the specific ambiguity (e.g., "Ambiguous Term: 'Project X'").  
  * System displays the assumption made (e.g., "Assumed 'Project X' \= 'Pricing Initiative'").  
* **Step 3: The User Correction:**  
  * User rejects the assumption and provides the correct context (e.g., "Project X \= Churn Initiative").  
  * **ADDITIONAL POINT: LET USER GIVE OPENENDED FEEDBACK. Maybe something else is wrong and agent didnt catch it.**  
* **Step 4: The "Stale State" & Cost Control:**  
  * **Crucial Logic:** The system does NOT auto-run immediately upon correction (to prevent token waste).  
  * **Notification:** The Report UI enters a "Stale State" with a notification: "Context updated. Report is based on old assumptions."  
  * **Action:** A prominent button appears: "Update Report (Cost: \~X Credits)".  
  * **Execution:** Only when the user confirms the cost does the system re-process the logic using the corrected context.

### 

### 

### 

### **4\. 📄 The Report Viewer & "Traceable Truth"**

#### **4.1. Interactive Web Report**

* **Format:** A read-only, web-based document viewer rendering the agent's structured output (not a static PDF).  
* **Traceability Feature:**  
  * **Visual:** Insights/claims in the text have visual citation markers (e.g., \[3\]).  
  * **Interaction:** Clicking a marker opens a Sidebar (not a jump-link).  
  * **Content:** The sidebar displays the Raw Source Quote, the Speaker Name, and the Source File Name.

#### **4.2. Contextual Chat Interface**

* **Decision:** A "Global/Omniscient" chat is rejected for the MVP.  
* **Scope:** Report-Context Chat.  
* **Location:** A persistent side-panel within the Report Viewer.  
* **Context Window:** The LLM has access to three specific layers:  
  1. The Current Report Content.  
  2. The Source Files used in this specific run.  
  3. The Company-Wide Knowledge Graph (to answer broader questions).  
* **Capabilities:** Users can ask the agent to refine sections, explain insights, or query the source data.

#### **4.3. Export Engine (Offline Traceability)**

* **Requirement:** Users must be able to take the report "offline" (Word/PDF).  
* **Reference Conversion Logic:**  
  * The system must automatically convert the interactive web markers into Standard References (Footnotes or Endnotes).  
* **Precision Requirement:** The citation must be granular to ensure the "Traceable Truth" persists offline.  
* **Format:** \[Ref 3\] \-\> "Interview\_Amy.pdf", Page 3, Lines 8-9.

TALK TO HUBSPOT 