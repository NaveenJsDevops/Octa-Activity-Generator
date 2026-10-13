from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from contextlib import asynccontextmanager
import os

from apps.api.core.config import settings
from apps.api.auth.security import get_current_user
from apps.api.routers.topics import router as topics_router
from apps.api.routers.topic_review import router as topic_review_router
from apps.api.routers.activity_ideation import router as activity_ideation_router
from apps.api.routers.activities import router as activities_router
from apps.api.routers.master import router as master_router
from apps.api.routers.settings import router as settings_router
from apps.api.repositories.excel import ExcelRepository

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize excel workbooks safely on startup
    repo = ExcelRepository(settings.DATA_DIR)
    repo.initialize_workbooks()
    yield

app = FastAPI(
    title="Octa AI Activity Platform API",
    description="Backend API for the Octa AI Activity Platform",
    version="0.1.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics_router)
app.include_router(topic_review_router)
app.include_router(activity_ideation_router)
app.include_router(activities_router)
app.include_router(master_router)
app.include_router(settings_router)

@app.get("/")
def read_root() -> Dict[str, str]:
    return {"status": "ok", "message": "Octa AI Activity Platform API is running"}

@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    # Check Excel Configuration
    repo = ExcelRepository(settings.DATA_DIR)
    excel_configured = os.path.exists(repo.data_dir)
    excel_initialized = os.path.exists(os.path.join(repo.data_dir, "topics", "Octa_Topics.xlsx"))
    
    # Check AI Configuration
    provider = settings.AI_PROVIDER.lower()
    if provider == "openai":
        ai_key = settings.OPENAI_API_KEY
    elif provider == "gemini":
        ai_key = settings.GEMINI_API_KEY
    elif provider == "anthropic":
        ai_key = settings.ANTHROPIC_API_KEY
    else:
        ai_key = settings.AI_API_KEY
        
    ai_configured = bool(ai_key and ai_key.strip() and not ai_key.lower().startswith("your_"))
    
    ai_status = {
        "provider": settings.AI_PROVIDER,
        "configured": ai_configured
    }
    if ai_configured:
        ai_status["model"] = settings.AI_MODEL
        ai_status["temperature"] = settings.AI_TEMPERATURE
        ai_status["max_tokens"] = settings.AI_MAX_OUTPUT_TOKENS

    return {
        "status": "ok", 
        "environment": settings.ENVIRONMENT,
        "excel": {
            "configured": excel_configured,
            "initialized": excel_initialized
        },
        "ai": ai_status
    }

@app.get("/api/protected-route")
def protected_route(username: str = Depends(get_current_user)) -> Dict[str, str]:
    return {"message": f"Hello {username}, you have access to this protected route."}
