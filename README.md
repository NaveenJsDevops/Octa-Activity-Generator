# Octa AI Activity Generation Platform

## Project Purpose
The Octa AI Activity Platform is a local-first, AI-powered application designed to automate the discovery, validation, ideation, and generation of activity sheets for Octa Kids. It enables an end-to-end workflow from selecting a topic to generating high-quality PDFs.

## Architecture Overview
The platform uses a decoupled frontend-backend architecture:
- **Frontend**: Next.js (React + TypeScript) for user interactions, workflow management, and UI dashboards.
- **Backend**: FastAPI (Python) for business logic, interacting with AI models, managing local storage, and processing data.
- **Data Persistence**: SQLite is the single source of truth for structured application data (topics, activities, generation logs, and master reference records).
- **File Storage**: Generated content and drafts are stored securely on the local filesystem.

## Technology Stack
- **Frontend**: Next.js 15+, React 19, TypeScript, TailwindCSS
- **Backend**: Python 3+, FastAPI, Pydantic, Pandas, OpenPyXL
- **AI Integration**: Designed with an `AIProvider` abstraction to support multiple AI backends (e.g., OpenAI, Gemini).

## Directory Structure & Data Locations
```
octa-ai-platform/
  apps/
    web/          # Next.js frontend application
    api/          # FastAPI backend application
  data/
    octa.db       # SQLite database containing master data, topics, activities, and generation logs
    master/       # Legacy workbook placeholders, retained for compatibility and exports
    topics/       # Legacy workbook placeholders, retained for compatibility and exports
    activities/   # Legacy workbook placeholders, retained for compatibility and exports
    ai/           # Legacy workbook placeholders, retained for compatibility and exports
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

## Deployment: GitHub Pages Frontend + Render API
The frontend is published to GitHub Pages by `.github/workflows/deploy-pages.yml`, and the FastAPI backend runs on Render with a persistent disk for the SQLite database and generated files. The root `render.yaml` defines the API service and its disk:
- Render builds from the repository root using `apps/api/requirements.txt` and runs `apps.api.main:app`.
- The 1 GB persistent disk is mounted at `/var/data`; `DATA_DIR` and `STORAGE_DIR` point inside that mount so application data survives deploys and restarts.
- The Render service uses the paid `starter` plan because Render persistent disks require a paid service.

Deployment steps:
1. Create a Render Blueprint from this repository and deploy the `octa-activity-api` service.
2. In Render, set `FRONTEND_URL` to `https://naveenjsdevops.github.io` (the origin only, without the repository path), `GEMINI_API_KEY` to the provider key, and `ALLOWED_USERS` to the configured comma-separated `username:password` entries.
3. In the GitHub repository's Actions variables, set `NEXT_PUBLIC_API_URL` to the Render service's public base URL, such as `https://octa-activity-api.onrender.com`. The Pages workflow embeds it in the frontend at build time.

The frontend sends requests directly to the Render API, so Render CORS must allow the exact GitHub Pages origin. The SQLite database and generated files remain on Render's persistent disk. That disk is attached to one service instance and cannot be used for horizontal scaling; back up the data regularly.

## Development Commands
- **Frontend linting**: `cd apps/web && npm run lint`
- **Frontend type-check**: `cd apps/web && npx tsc --noEmit`
- **Backend type-check**: `cd apps/api && PYTHONPATH=../../ mypy --ignore-missing-imports main.py core/config.py auth/security.py repositories/excel.py storage/local.py services/ai.py`
- **Backend unit tests**: `cd apps/api && PYTHONPATH=../../ pytest tests/`

## Current Implementation Status
**Phase 1 Complete**: Domain Models & SQLite Persistence.
- Strict Pydantic domain models implemented (`apps/api/models/domain.py`).
- Controlled vocabularies established via Enums.
- DatabaseRepository implemented with SQLite persistence and compatibility wrappers for the existing repository interface.
- Application-level schema validation and relationship checks (Foreign Keys) enforced.
- Master data initialization script provided (`apps/api/scripts/init_master_data.py`).
- Comprehensive testing suite configured and passing for the repository layer.

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
- **LOCAL DATABASE**: Use SQLite for application persistence. Avoid PostgreSQL, MySQL, MongoDB, Prisma, and Supabase.
- **NO CLOUD STORAGE**: Do not use AWS S3, Google Cloud Storage, Azure Blob Storage.
- **LOCAL-FIRST**: Everything must be persisted in SQLite or the local filesystem.
- **NO EXTERNAL AUTH**: Do not use OAuth, JWT, or database-backed authentication. Use hardcoded configurations for now.
# Octa-Activity-Generator
# Octa-Activity-Generator
