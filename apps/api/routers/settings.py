from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from apps.api.core.config import settings, ENV_PATH, GEMINI_MODEL
import dotenv
import os

router = APIRouter(
    prefix="/api/settings",
    tags=["Settings"]
)

class AIModelUpdateRequest(BaseModel):
    model: str

@router.get("/ai/models")
def get_available_models():
    """
    Return a list of common AI models that can be selected.
    This can be expanded as needed.
    """
    return {
        "models": [GEMINI_MODEL]
    }

@router.get("/ai")
def get_ai_settings():
    return {
        "provider": settings.AI_PROVIDER,
        "model": settings.AI_MODEL,
        "temperature": settings.AI_TEMPERATURE,
        "max_tokens": settings.AI_MAX_OUTPUT_TOKENS
    }

@router.patch("/ai")
def update_ai_settings(req: AIModelUpdateRequest):
    if req.model.strip() != GEMINI_MODEL:
        raise HTTPException(
            status_code=400,
            detail=f"Only {GEMINI_MODEL} is available.",
        )

    # Update in memory
    settings.AI_MODEL = GEMINI_MODEL
    settings.AI_PROVIDER = "gemini"
    
    # Update in .env file to persist
    dotenv_file = str(ENV_PATH)
    if os.path.exists(dotenv_file):
        dotenv.set_key(dotenv_file, "AI_MODEL", GEMINI_MODEL)
        dotenv.set_key(dotenv_file, "AI_PROVIDER", "gemini")
        
    return {
        "status": "success",
        "message": "AI configuration updated successfully",
        "settings": {
            "provider": settings.AI_PROVIDER,
            "model": settings.AI_MODEL
        }
    }

from pydantic import Field
class TestSchema(BaseModel):
    success: bool = Field(description="Must be true")

@router.get("/ai/test")
def test_ai_connection():
    """
    Test the AI connection by sending a tiny structured request.
    This helps identify if API keys are valid or if credits are exhausted (429).
    """
    from apps.api.services.ai.orchestrator import AIOrchestrator
    from apps.api.repositories.excel import ExcelRepository
    
    repo = ExcelRepository(settings.DATA_DIR)
    orchestrator = AIOrchestrator(repo)
    
    try:
        # We override max_retries temporarily to avoid waiting on failure
        orchestrator.max_retries = 0
        
        result = orchestrator.generate_structured(
            generation_type="connection_test",
            prompt="Respond with success=true.",
            schema_model=TestSchema,
            system_prompt="You are a test bot."
        )
        return {
            "status": "ok",
            "message": "Connection successful",
            "model": settings.AI_MODEL
        }
    except Exception as e:
        error_str = str(e).lower()
        if "429" in error_str or "quota" in error_str or "credit" in error_str:
            status = "out_of_credits"
            msg = "Rate limited or Out of credits (429)"
        elif "401" in error_str or "auth" in error_str:
            status = "unauthorized"
            msg = "Invalid API key"
        elif "404" in error_str or "not found" in error_str:
            status = "model_not_found"
            msg = f"Model {settings.AI_MODEL} not supported by the provider."
        else:
            status = "error"
            msg = str(e)
            
        return {
            "status": status,
            "message": msg,
            "model": settings.AI_MODEL,
            "raw_error": str(e)
        }
