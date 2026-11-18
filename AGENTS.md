# Octa AI Activity Platform — Engineering Rules

## Project Goal

Build a professional AI-powered activity generation platform for Octa Kids.

## Architecture

Frontend:
- Next.js
- React
- TypeScript

Backend:
- Python
- FastAPI

Persistence:
- Google Cloud Firestore database as the primary source of truth

File storage:
- Local filesystem for static assets

Authentication:
- Configurable hardcoded users
- No database authentication

AI:
- Provider abstraction
- Structured JSON outputs
- Prompt versioning
- Validation before persistence

## Important Constraints

DO NOT introduce:

- PostgreSQL
- MySQL
- MongoDB
- Prisma
- Supabase
- S3
- OAuth
- JWT
- External authentication services

Google Cloud Firestore is the primary source of truth for application data.

## AI Rules

Never rely on free-form AI responses.

All AI responses must:

1. Have a defined schema.
2. Be validated.
3. Be rejected if schema validation fails.
4. Be logged.
5. Be versioned.

AI must not directly write files or database records.

AI must return structured data to the backend.

Backend services are responsible for persistence.

## Architecture Rules

Use clear separation between:

- API
- Business logic
- AI
- Repository layer (Firestore)
- Validation
- Workflow

Do not put business logic inside API routes.

Do not put database manipulation inside AI services.

Do not put AI prompts inside frontend code.

## Development Rules

Before implementing a feature:

1. Inspect existing code.
2. Explain the implementation approach.
3. Identify affected files.
4. Implement the smallest required change.
5. Run tests/type checks.
6. Report changed files.
7. Report validation results.

Do not rewrite unrelated code.

Do not introduce dependencies without justification.

Prefer maintainable and testable code over shortcuts.
