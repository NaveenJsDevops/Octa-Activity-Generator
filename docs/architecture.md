# Architecture Documentation

## Core Architectural Principles

The Octa AI Activity Generation Platform adheres to a strict set of architectural principles designed for simplicity, professional operation, and high-quality AI interaction.

1. **Clean Persistence & Cloud Firestore**: 
   - Google Cloud Firestore is the primary source of truth for all structured data.
   - High-performance in-memory caching ensures sub-millisecond query responses.
   - All generated drafts, JSON metadata, and final PDF exports are stored directly on the local filesystem.
2. **Decoupled Frontend/Backend**:
   - The Next.js frontend acts solely as a UI and state management layer.
   - The FastAPI backend orchestrates all data reading/writing, validation, and AI requests.
3. **Strict AI Governance**:
   - All AI interactions MUST use structured JSON outputs (enforced via Pydantic on the backend).
   - Free-form responses must be rejected.
   - AI logic is completely isolated from business rules, UI state, and database implementation details.

## Module Boundaries (Backend)

### Strict Layering Rule
`API -> Service -> Repository -> Cloud Firestore`
Business logic must NOT directly manipulate raw DB access details. The repository layer owns all persistence concerns and validation.

### 1. `apps.api.repositories.firestore.FirestoreRepository`
Handles all read and write operations to Google Cloud Firestore with strict Pydantic model validation and cross-entity reference validation.

### 2. `apps.api.storage.local.LocalStorage`
Handles all read and write operations for raw files to the `storage/` directory.

### 3. `apps.api.services.ai.AIProvider`
An abstract boundary for communicating with different LLMs (Gemini, Anthropic, OpenAI). Current and future AI implementations adhere to this contract.

## Domain Models & Validation Flow

The application relies on strictly-typed Pydantic domain models located in `apps.api.models.domain` to enforce data contracts. 

### Validation Flow (Before saving to the database):
1. **Pydantic Validation**: Converts incoming dicts into strict Pydantic objects. Enforces required fields, types, and datetime parsing.
2. **Enum Validation**: Checks fields like `TopicStatus` and `ActivityStatus` against controlled vocabularies.
3. **Foreign-Key Validation**: Validates cross-collection relationships in code (e.g. `topic_family_id` must exist in `TopicFamilies`, `skill_id` in `Skills`).
4. **Unique ID Constraint**: Checks if primary IDs already exist to prevent duplication during append operations.
5. **Atomic Write**: If validation passes, the repository commits changes atomically to Cloud Firestore with rollback on failure.

### Domain Models & Firestore Collections
- **Master Data (`topic_families`, `intelligences`, `skills`, `sub_skills`, `activity_types`)**
- **Topic Domain (`topics`, `topic_skills`, `topic_keywords`, `topic_sources`, `topic_review_history`)**
- **Activity Domain (`activity_concepts`, `activities`, `activity_skills`, `activity_versions`, `quality_checks`)**
- **AI Tracking (`generation_runs`)**

## Topic Discovery Engine

The `TopicDiscoveryService` orchestrates the generation of topic candidates without directly interacting with the AI Provider.

### Topic Discovery Components
- **`TopicDiscoveryRequest` & `TopicDiscoveryOutput`**: Strict Pydantic models for enforcing API inputs and AI structure.
- **`KeywordBuilder`**: Assembles core and rotating keywords.
- **`SkillResolver`**: Deterministically matches AI-suggested skill strings against existing Master Data. No new skills are invented by the AI.
- **`TopicValidator`**: Validates AI-generated topics against business rules (e.g. Activity Potential vocabulary, Age Suitability, presence of hook).
- **`DuplicateChecker`**: Detects duplicates against previously accepted candidates and existing stored topics using exact normalized matching and lexical Jaccard similarity.
- **Persistence & Partial Success**: Generates DRAFT topics, assigns deterministic IDs (e.g. `TOP-000001`), handles relationships in `TopicSkills` and `TopicKeywords`, and supports partial success. Logs everything to `generation_runs` in Firestore.
