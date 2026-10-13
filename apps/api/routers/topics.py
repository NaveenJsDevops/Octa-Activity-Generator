from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from apps.api.models.topic_discovery import (
    TopicDiscoveryRequest, TopicDiscoveryResult, 
    TopicCandidate, RejectedCandidate
)
from apps.api.services.topic_discovery.service import TopicDiscoveryService
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.services.ai.prompts.registry import PromptRegistry, PromptTemplate
from apps.api.services.ai.exceptions import AIConfigurationError
from apps.api.core.config import settings
from datetime import datetime

router = APIRouter(prefix="/api/topics", tags=["topics"])

# Dependency injection helpers
def get_excel_repository() -> ExcelRepository:
    return ExcelRepository(settings.DATA_DIR)

def get_prompt_registry() -> PromptRegistry:
    registry = PromptRegistry()
    registry.register_prompt(PromptTemplate(
        prompt_name="topic_discovery",
        version="v1.1",
        system_prompt="You are an expert curriculum designer for Octa Kids. Generate engaging, unique activity topics.",
        user_prompt_template=(
            "Generate {requested_count} topic candidates for age {age_min} to {age_max} (Class: {target_class}). "
            "Context: {country_context}. "
            "Use these keywords for inspiration: {keyword_context}. "
            "Web Research Info to guide topics:\n{web_research_context}\n"
            "Ensure topics are highly engaging and suitable for the age group. "
            "IMPORTANT: 'activity_potential' MUST be exactly one of: HIGH, MEDIUM, or LOW. "
            "Do NOT include explanations, sentences, or natural language in 'activity_potential'."
        ),
        status="ACTIVE",
        created_at=datetime.now()
    ))
    return registry

def get_ai_orchestrator(excel_repo: ExcelRepository = Depends(get_excel_repository)) -> AIOrchestrator:
    return AIOrchestrator(excel_repo)

def get_topic_discovery_service(
    excel_repo: ExcelRepository = Depends(get_excel_repository),
    orchestrator: AIOrchestrator = Depends(get_ai_orchestrator),
    prompt_registry: PromptRegistry = Depends(get_prompt_registry)
) -> TopicDiscoveryService:
    return TopicDiscoveryService(excel_repo, orchestrator, prompt_registry)

@router.post("/discover")
def discover_topics(
    request: TopicDiscoveryRequest,
    service: TopicDiscoveryService = Depends(get_topic_discovery_service)
):
    try:
        # Returns a dict with session_id and candidates
        return service.discover_topics(request)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except AIConfigurationError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/discovery/{session_id}/keep/{index}")
def keep_candidate(
    session_id: str,
    index: int,
    service: TopicDiscoveryService = Depends(get_topic_discovery_service)
):
    try:
        return service.keep_candidate(session_id, index)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/discovery/{session_id}/reject/{index}")
def reject_candidate(
    session_id: str,
    index: int,
    service: TopicDiscoveryService = Depends(get_topic_discovery_service)
):
    try:
        return service.reject_candidate(session_id, index)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/discovery/{session_id}/keep-all")
def keep_all_candidates(
    session_id: str,
    service: TopicDiscoveryService = Depends(get_topic_discovery_service)
):
    try:
        return service.keep_all(session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
