---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - docs/Bubble_ Initial Product Definition - Brainstorm.md
  - docs/Product Charter Bubble.md
date: 2026-01-09
author: Erinc
---

# Product Brief: project_bubble

## Executive Summary

Bubble is an agentic workflow builder designed to empower Product Marketing Managers (PMMs) at B2B SaaS companies. By transforming the messy, unstructured process of customer and market research into a rigorous, verifiable workflow, Bubble bridges the gap between raw data and strategic insight. Built on an enterprise-grade **Hexagonal Architecture**, it combines a **Per-Company Knowledge Graph** with specialized **Agentic Workflows** to deliver "Traceable Truth"—insights that are always linked back to their verifiable source.

---

## Core Vision

### Problem Statement

Product Marketers are expected to drive strategy with data, yet their reality is drowning in unstructured qualitative inputs (interview transcripts, sales calls, competitive intel). Their current toolkit fails them:
*   **Manual Analysis:** Time-consuming, unscalable, and inconsistent.
*   **Generic LLMs:** "Black boxes" that hallucinate, lack "Company Memory" (context of previous projects), and provide no audit trail, making them untrustworthy for high-stakes decisions.
*   **The "Codebook" Gap:** Insights are trapped in individual sessions or files, preventing the compounding of organizational knowledge.

### Proposed Solution: The Bubble Platform

Bubble is not a chatbot; it is a **Process Engine** for intelligence.

#### 1. The Core Data Model (The Secret Sauce)
The architecture explicitly distinguishes three classes of data to solve the context problem:
*   **Agent Knowledge (The Brain):** Admin-managed instruction files and frameworks (e.g., SPICED, Jobs-to-be-Done). Fixed and version-controlled.
*   **Transactional Inputs (The Raw Material):** Dynamic, run-specific data provided by the user (e.g., a batch of 20 interview transcripts).
*   **Company Assets (The Memory):** Living, shared resources (e.g., Codebooks, Competitor Lists, Persona Definitions) that multiple agents can read from and write to. This enables the **Company-Wide Knowledge Graph**.

#### 2. The Agentic Workflow Engine
*   **Zero-Touch Batch Processing:** designed for scale (e.g., analyzing 50 calls at once) rather than fragile chat interactions.
*   **Traceable Truth:** Every claim or insight in a report is visually cited. Users can click a citation to view the exact raw quote and source file, ensuring absolute trust.
*   **Admin-Led Definition:** To ensure consistency, workflows are defined by the "Internal Admin Panel" (The Factory) and exposed to users via a "Storefront", preventing prompt-drift.

### Technical Foundation & Architecture

Bubble is built on a rigorous **Nx Monorepo** using **Hexagonal Architecture (Ports & Adapters)** to ensure scalability and maintainability.

*   **Structure:**
    *   **Apps (`apps/`):** Thin orchestration layers responsible only for wiring and deployment.
    *   **Libraries (`libs/`):** The core domain logic, strictly isolated by feature (e.g., `libs/interviews`, `libs/marketing-assets`).
*   **Stack:**
    *   **Backend:** **NestJS** microservices using **MikroORM**. Explicit separation of "Client" (Message Producers) and "Server" (Message Consumers) for asynchronous scale.
    *   **Frontend:** **Angular** with strict vertical slicing. Frontend logic is bound to backend contracts (`libs/common`) ensuring type safety across the stack.

### Key Differentiators

1.  **The "Company Asset" Architecture:** Unlike generic tools that treat every chat as a blank slate, Bubble's architecture allows agents to build upon a shared, evolving "Company Codebook".
2.  **Verifiable Trust:** The "Traceable Truth" citation system solves the "Hallucination" fear that blocks AI adoption in enterprise.
3.  **Process over Chat:** By focusing on pre-defined, rigorous workflows (e.g., "Run a SPICED analysis on these 10 files"), Bubble delivers consistent, board-ready results that chat interfaces cannot match.

---

## Target Users

### Primary User: "PMM Amy" (The In-House Strategist)
*   **Role:** Senior Product Marketing Manager at a mid-sized B2B SaaS (€10-100M ARR).
*   **Context:** She is drowning in qualitative data (calls, interviews) and is often perceived as a "reactive support resource" rather than a strategic partner.
*   **The Pain:** She wants to be data-driven but lacks the time to manually tag 50 transcripts. She doesn't trust generic AI summaries because she can't defend them to her VP.
*   **The Goal:** To shift from "Opinion-Driven" to "Truth-Driven" decision making, validating her strategy with hard evidence.

### Secondary User: The Freelance PMM (The Power Partner)
*   **Role:** External consultant hired for specific projects (e.g., "Fix our Messaging").
*   **Usage:** Uses Bubble as a "force multiplier" to deliver high-quality audits and strategy decks faster than manual methods allow.

### User Journey (The "Storefront" Flow)

1.  **Discovery (The Storefront):** Amy visits the *Workflow Library* and selects a specific card (e.g., "SPICED Analysis") rather than facing an empty chat box.
2.  **Configuration (The Wizard):**
    *   She selects 20 raw transcripts from the *Global Data Vault*.
    *   She selects the "Company Codebook" to ensure tags align with previous projects.
    *   She hits "Run".
3.  **The "Black Box" (Zero-Touch):** The system processes the batch asynchronously. Amy does not sit and chat; she does other work.
4.  **The Aha! Moment (Traceable Truth):**
    *   She gets an alert: "Analysis Complete."
    *   She opens the *Interactive Report*. She sees a surprising insight about "Pricing Anxiety."
    *   Skeptical, she clicks the citation [3]. The sidebar opens to show the *exact customer quote* and timestamp.
    *   **Trust is established.** She exports the report to share with her VP.

---

## Success Metrics

### Business Objectives (The "North Star")
*   **Revenue:** Achieve €25K MRR within 3 months of launch.
*   **Efficiency:** Average gross margin ≥ 70%.
*   **Growth:** Net Revenue Retention (NRR) ≥ 100%.

### Key Performance Indicators (Product Health)
*   **Activation:** % of new users who execute a full workflow (e.g., "First Report Generated") within 7 days.
*   **Time-to-Value:** "Time to First Insight" — minimizing the friction between upload and analysis.
*   **Trust Adoption:** % of users who actively use the "Traceable Truth" feature (clicking citations) to validate an insight.
*   **Retention:** Weekly Return Rate (users adding new data to existing projects).
