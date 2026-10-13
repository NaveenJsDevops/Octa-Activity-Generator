# Octa AI Activity Generation Platform

## Project Purpose
The Octa AI Activity Platform is a local-first, AI-powered application designed to automate the discovery, validation, ideation, and generation of activity sheets for Octa Kids. It enables an end-to-end workflow from selecting a topic to generating high-quality PDFs.

## Architecture Overview
The platform uses a decoupled frontend-backend architecture:
- **Frontend**: Next.js (React + TypeScript) for user interactions, workflow management, and UI dashboards.
- **Backend**: FastAPI (Python) for business logic, interacting with AI models, managing local storage, and processing data.
- **Data Persistence**: Excel files act as the single source of truth for all structured data (topics, activities). No relational databases are used.
- **File Storage**: Generated content and drafts are stored securely on the local filesystem.

## Technology Stack
- **Frontend**: Next.js 15+, React 19, TypeScript, TailwindCSS
- **Backend**: Python 3+, FastAPI, Pydantic, Pandas, OpenPyXL
- **AI Integration**: Designed with an `AIProvider` abstraction to support multiple AI backends (e.g., OpenAI, Gemini).

## Directory Structure & Excel Locations
```
octa-ai-platform/
  apps/
    web/          # Next.js frontend application
    api/          # FastAPI backend application
  data/
    master/       # Octa_Master.xlsx (Skills, TopicFamilies, etc)
    topics/       # Octa_Topics.xlsx (Topics, Keywords, Sources)
    activities/   # Octa_Activities.xlsx (Concepts, Activities, Checks)
    ai/           # Octa_AI_Logs.xlsx (Generation Runs)
  storage/
    drafts/       # In-progress activity generations
    generated/    # Finalized generations pending approval
    approved/     # Approved content
    rejected/     # Rejected content
    exports/      # Exported PDFs and deliverables
  logs/           # Application logs
  config/         # Shared configuration (if applicable)
  docs/           # Architectural and operational documentation
```

## Local Setup
1. **Prerequisites**: Node.js 20+, Python 3.10+
2. **Environment Variables**: Copy `.env.example` to `.env` and fill in the required variables.
3. **Backend Initialization**:
   ```bash
   cd apps/api
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   # Initialize the master excel files and directories
   PYTHONPATH=../../ python apps/api/scripts/init_master_data.py
   uvicorn main:app --reload
   ```
4. **Frontend**:
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

## Development Commands
- **Frontend linting**: `cd apps/web && npm run lint`
- **Frontend type-check**: `cd apps/web && npx tsc --noEmit`
- **Backend type-check**: `cd apps/api && PYTHONPATH=../../ mypy --ignore-missing-imports main.py core/config.py auth/security.py repositories/excel.py storage/local.py services/ai.py`
- **Backend unit tests**: `cd apps/api && PYTHONPATH=../../ pytest tests/`

## Current Implementation Status
**Phase 1 Complete**: Domain Models & Excel Persistence.
- Strict Pydantic domain models implemented (`apps/api/models/domain.py`).
- Controlled vocabularies established via Enums.
- ExcelRepository implemented with robust pandas abstraction.
- Application-level schema validation and relationship checks (Foreign Keys) enforced.
- Master data initialization script provided (`apps/api/scripts/init_master_data.py`).
- Comprehensive testing suite configured and passing for the Excel Repository.

## Activity Generation Workflow
- Draft topics can be edited and approved directly, or moved through `REVIEW` before approval. The Activity Generation screen lists only `APPROVED` or `SELECTED` topics; after approving a topic, refresh the list if that screen is already open.
- AI results are structured and validated, and remain temporary in the API process until a user action.
- Edit, regenerate, and reject operate on temporary review-session concepts. Approval writes the `APPROVED` concept and its `APPROVED` activity to `Octa_Activities.xlsx`; supported topic skill mappings are written alongside them.
- Related activity and skill rows are validated and committed using a single staged workbook replacement. Repeated approvals do not create a second activity for the same concept.
- Generated activities follow the OCTAKIDZ `Pre-Activity` → `Main Activity` → `Post-Activity` template. The required Parent's Note and all section fields are schema-validated; optional parent guidance and warm-up prompts remain conditional.
- Template sections are stored as structured JSON in the `ActivityConcepts` and `Activities` sheets. Existing generic activity columns remain available for compatibility, and legacy activities without template data are shown with their saved content and clearly marked missing fields.
- The review screen supports editing each template field. The Activity Library displays the same three-section structure, with any existing learning, material, assessment, and supported skill data kept separately as additional educational metadata.

Activity endpoints:
- `GET /api/activity-ideation/topics`
- `POST /api/activity-ideation/generate`
- `GET /api/activity-ideation/sessions/{session_id}`
- `PATCH /api/activity-ideation/sessions/{session_id}/concepts/{concept_id}`
- `POST /api/activity-ideation/sessions/{session_id}/concepts/{concept_id}/regenerate`
- `POST /api/activity-ideation/sessions/{session_id}/concepts/{concept_id}/approve`
- `POST /api/activity-ideation/sessions/{session_id}/concepts/{concept_id}/reject`
- `GET /api/activities` and `GET /api/activities/{activity_id}`

## Explicit Architectural Constraints
- **NO DATABASES**: Do not use PostgreSQL, MySQL, MongoDB, Prisma, Supabase, etc.
- **NO CLOUD STORAGE**: Do not use AWS S3, Google Cloud Storage, Azure Blob Storage.
- **LOCAL-FIRST**: Everything must be persisted in Excel or the local filesystem.
- **NO EXTERNAL AUTH**: Do not use OAuth, JWT, or database-backed authentication. Use hardcoded configurations for now.
# Octa-Activity-Generator
# Octa-Activity-Generator
