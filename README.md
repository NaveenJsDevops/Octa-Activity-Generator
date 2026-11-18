# Octa AI Activity Generation Platform

## Project Purpose
The Octa AI Activity Platform is a local-first, AI-powered application designed to automate the discovery, validation, ideation, and generation of activity sheets for Octa Kids. It enables an end-to-end workflow from selecting a topic to generating high-quality PDFs.

## Architecture Overview
The platform uses a decoupled frontend-backend architecture:
- **Frontend**: Next.js (React + TypeScript) for user interactions, workflow management, and UI dashboards.
- **Backend**: FastAPI (Python) for business logic, interacting with AI models, managing local storage, and processing data.
- **Data Persistence**: Google Cloud Firestore is the single source of truth for structured application data (topics, activities, generation logs, and master reference records).
- **File Storage**: Generated content and drafts are stored securely on the local filesystem.

## Technology Stack
- **Frontend**: Next.js 15+, React 19, TypeScript, TailwindCSS
- **Backend**: Python 3+, FastAPI, Pydantic, Pandas, Google Cloud Firestore SDK
- **AI Integration**: Designed with an `AIProvider` abstraction to support multiple AI backends (e.g., OpenAI, Gemini).

## Directory Structure & Data Locations
```
octa-ai-platform/
  apps/
    web/          # Next.js frontend application
    api/          # FastAPI backend application
  data/
    firebase-key.json # Firebase service account credentials for Cloud Firestore
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

## Quick Start
Run everything with a single command:
```bash
./start.sh          # Automatically sets up dependencies and launches both Backend & Frontend
./start.sh --build  # Optional: Builds frontend and initializes Firestore master data
```

## Manual Setup
1. **Prerequisites**: Node.js 20+, Python 3.10+
2. **Environment Variables**: Verify `apps/api/.env` and `apps/web/.env.local`.
3. **Backend Initialization**:
   ```bash
   cd apps/api
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   # Initialize master data in Cloud Firestore
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
The frontend is published to GitHub Pages by `.github/workflows/deploy-pages.yml`, and the FastAPI backend runs on Render for demos. The root `render.yaml` defines the API service:
- Render builds from the repository root using `apps/api/requirements.txt` and runs `apps.api.main:app`.
- Data is persisted directly to Google Cloud Firestore using the configured service credentials.

Deployment steps:
1. Create a Render Blueprint from this repository and deploy the `octa-activity-api` service.
2. In Render, set `FRONTEND_URL` to `https://naveenjsdevops.github.io` (the origin only, without the repository path), `GEMINI_API_KEY` to the provider key, and `ALLOWED_USERS` to the configured comma-separated `username:password` entries.
3. The Pages workflow uses `https://octa-activity-api.onrender.com` as the default API URL. If the Render service URL changes, override it by setting the `NEXT_PUBLIC_API_URL` Actions variable in the GitHub repository. The workflow embeds this URL in the frontend at build time.

## Development Commands
- **Frontend linting**: `cd apps/web && npm run lint`
- **Frontend type-check**: `cd apps/web && npx tsc --noEmit`
- **Backend type-check**: `cd apps/api && PYTHONPATH=../../ mypy --ignore-missing-imports main.py core/config.py auth/security.py repositories/firestore.py storage/local.py services/ai.py`
- **Backend unit tests**: `cd apps/api && PYTHONPATH=../../ pytest tests/`

## Current Implementation Status
**Cloud Firestore Persistence**:
- Strict Pydantic domain models implemented (`apps/api/models/domain.py`).
- Controlled vocabularies established via Enums.
- FirestoreRepository implemented with native Google Cloud Firestore persistence and sub-millisecond in-memory caching.
- Application-level schema validation and relationship checks (Foreign Keys) enforced.
- Master data initialization script provided (`apps/api/scripts/init_master_data.py`).
- Comprehensive testing suite configured and passing for the repository layer.

## Activity Generation Workflow
- Topic discovery's Topic Family choices are hardcoded in the app and optional; leaving the field as “Any topic family” generates topics without assigning a family.
- Draft topics can be edited and approved directly, or moved through `REVIEW` before approval. The Activity Generation screen lists only `APPROVED` or `SELECTED` topics; after approving a topic, refresh the list if that screen is already open.
- AI results are structured and validated, and remain temporary in the API process until a user action.
- Edit, regenerate, and reject operate on temporary review-session concepts. Approval writes the `APPROVED` concept and its `APPROVED` activity to Cloud Firestore; supported topic skill mappings are written alongside them.
- Related activity and skill records are validated and committed atomically. Repeated approvals do not create a second activity for the same concept.
- Generated activities follow the OCTAKIDZ `Pre-Activity` → `Main Activity` → `Post-Activity` template. The required Parent's Note and all section fields are schema-validated; optional parent guidance and warm-up prompts remain conditional.
- Template sections are stored as structured documents in the `activity_concepts` and `activities` collections in Cloud Firestore. Legacy activities without template data are displayed with their saved content and clearly marked missing fields.
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
- **DATABASE**: Google Cloud Firestore is the primary cloud database and source of truth for application data. Avoid PostgreSQL, MySQL, MongoDB, Prisma, and Supabase.
- **FILES**: Local filesystem stores exported files, logs, and templates.
- **NO EXTERNAL AUTH**: Do not use OAuth, JWT, or database-backed authentication. Use hardcoded configurations for now.
# Octa-Activity-Generator
# Octa-Activity-Generator
