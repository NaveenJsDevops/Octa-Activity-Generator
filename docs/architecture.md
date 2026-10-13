# Architecture Documentation

## Core Architectural Principles

The Octa AI Activity Generation Platform adheres to a strict set of architectural principles designed for simplicity, local operation, and high-quality AI interaction.

1. **Local-First Processing & Storage**: 
   - No external databases or cloud storage mechanisms.
   - All persistence occurs locally via Excel (`.xlsx`) files (the ultimate source of truth).
   - All generated drafts, JSON metadata, and final PDF exports are stored directly on the local filesystem.
2. **Decoupled Frontend/Backend**:
   - The Next.js frontend acts solely as a UI and state management layer.
   - The FastAPI backend orchestrates all data reading/writing, validation, and AI requests.
3. **Strict AI Governance**:
   - All AI interactions MUST use structured JSON outputs (enforced via Pydantic on the backend).
   - Free-form responses must be rejected.
   - AI logic is completely isolated from business rules, UI state, and Excel manipulation.

## Module Boundaries (Backend)

### Strict Layering Rule
`API -> Service -> Repository -> Excel`
Business logic must NOT directly manipulate pandas DataFrames. The `ExcelRepository` is the sole owner of all pandas and openpyxl interactions.

### 1. `apps.api.repositories.excel.ExcelRepository`
Handles all read and write operations to the `data/` directory.

### 2. `apps.api.storage.local.LocalStorage`
Handles all read and write operations for raw files to the `storage/` directory.

### 3. `apps.api.services.ai.AIProvider`
An abstract boundary for communicating with different LLMs. Current and future AI implementations must adhere to this contract.

## Domain Models & Validation Flow

The application relies on strictly-typed Pydantic domain models located in `apps.api.models.domain` to enforce data contracts. 

### Validation Flow (Before saving to Excel):
1. **Pydantic Validation**: Converts incoming dicts into strict Pydantic objects. Enforces required fields, types, and datetime parsing.
2. **Enum Validation**: Checks fields like `TopicStatus` and `ActivityStatus` against controlled vocabularies.
3. **Foreign-Key Validation**: Validates cross-sheet relationships in code (e.g. `topic_family_id` must exist in the `TopicFamilies` sheet, `skill_id` in `Skills`).
4. **Unique ID Constraint**: Checks if primary IDs already exist to prevent duplication during append operations.
5. **Safe Excel Write**: If validation passes, a `.tmp.xlsx` file is safely written before atomically replacing the original workbook.

### Domain Models & Workbook Structure
- **Master Data (`data/master/Octa_Master.xlsx`)**
  - *Intelligences*, *Skills*, *SubSkills*, *TopicFamilies*, *ActivityTypes*
- **Topic Domain (`data/topics/Octa_Topics.xlsx`)**
  - *Topics*, *TopicSkills*, *TopicKeywords*, *TopicSources*
- **Activity Domain (`data/activities/Octa_Activities.xlsx`)**
  - *ActivityConcepts*, *Activities*, *ActivitySkills*, *ActivityVersions*, *QualityChecks*
- **AI Tracking (`data/ai/Octa_AI_Logs.xlsx`)**
  - *GenerationRuns*

## Topic Discovery Engine (Phase 3)

The `TopicDiscoveryService` is the first AI-powered business workflow. It orchestrates the generation of topic candidates without directly interacting with the AI Provider or manipulating Pandas dataframes.

### Topic Discovery Components
- **`TopicDiscoveryRequest` & `TopicDiscoveryOutput`**: Strict Pydantic models for enforcing API inputs and AI structure.
- **`KeywordBuilder`**: Assembles core and rotating keywords, abstracting future database/Excel implementations for keyword management.
- **`SkillResolver`**: Deterministically matches AI-suggested skill strings (lowercased and stripped of punctuation) against existing Master Data. No new skills are invented by the AI.
- **`TopicValidator`**: Validates AI-generated topics against business rules (e.g. Activity Potential vocabulary, Age Suitability, presence of hook).
- **`DuplicateChecker`**: Detects duplicates against previously accepted candidates and existing Excel topics using exact normalized matching and lexical Jaccard similarity.
- **Persistence & Partial Success**: Generates DRAFT topics, assigns deterministic IDs (e.g. `TOP-000001`), handles relationships in `TopicSkills` and `TopicKeywords`, and supports partial success (e.g., returning 7 valid out of 10 candidates). Logs everything to `GenerationRuns`.

## Planned AI Workflow (Future Phases)

While Topic Discovery is implemented, the architecture is designed to support the following state machine in the future:
1. **Topic Discovery**: Agent proposes potential learning topics. (Implemented)
2. **Topic Validation**: Validates proposals against constraints. (Implemented)
3. **Duplicate Detection**: Queries `ExcelRepository` to ensure topics do not already exist. (Implemented)
4. **Topic Selection**: User selects a valid topic.
5. **Activity Ideation**: AI generates concept variations.
6. **Activity Concept Selection**: User chooses the preferred concept.
7. **Skill Mapping**: Matches activity requirements with developmental milestones.
8. **Activity Generation**: Generates the full activity payload (strictly structured JSON).
9. **Quality Validation**: Ensures schema compliance and quality gates are met.
10. **Activity Sheet Generation**: Renders the JSON into a printable format (e.g., PDF) and writes to `storage/exports`.
11. **Local Storage**: Saves metadata back to `data/activities/`.
