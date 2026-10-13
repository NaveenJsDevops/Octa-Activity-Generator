from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from apps.api.models.activity_ideation import (
    ActivityConceptEditRequest, ActivityIdeationRequest, ActivityIdeationResult, ActivityConceptResponse
)
from apps.api.services.activity_ideation.service import ActivityIdeationService
from apps.api.services.ai.exceptions import (
    AIConfigurationError,
    AIProviderError,
    AIRetryExhaustedError,
)
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.core.config import settings

router = APIRouter(prefix="/api/activity-ideation", tags=["Activity Ideation"])

def get_excel_repository() -> ExcelRepository:
    return ExcelRepository(settings.DATA_DIR)

def get_ai_orchestrator(excel_repo: ExcelRepository = Depends(get_excel_repository)) -> AIOrchestrator:
    return AIOrchestrator(excel_repo)

def get_ideation_service(
    excel_repo: ExcelRepository = Depends(get_excel_repository),
    ai_orchestrator: AIOrchestrator = Depends(get_ai_orchestrator)
) -> ActivityIdeationService:
    return ActivityIdeationService(excel_repo, ai_orchestrator)

@router.post("/generate", response_model=ActivityIdeationResult)
def generate_concepts(
    request: ActivityIdeationRequest,
    service: ActivityIdeationService = Depends(get_ideation_service)
):
    try:
        return service.generate_concepts(request)
    except AIConfigurationError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except AIRetryExhaustedError as e:
        message = str(e)
        lowered = message.lower()
        if "429" in lowered or "quota" in lowered or "rate limit" in lowered:
            raise HTTPException(status_code=429, detail="AI provider quota or rate limit reached")
        raise HTTPException(status_code=502, detail=message)
    except AIProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.get("/topics")
def get_eligible_topics(
    search: Optional[str] = None,
    service: ActivityIdeationService = Depends(get_ideation_service)
):
    return {"topics": service.get_eligible_topics(search)}

@router.get("/concepts", response_model=List[ActivityConceptResponse])
def get_concepts(
    topic_id: str,
    status: Optional[str] = None,
    service: ActivityIdeationService = Depends(get_ideation_service)
):
    return service.get_concepts(topic_id, status)

@router.post("/concepts/{concept_id}/select", response_model=ActivityConceptResponse)
def select_concept(
    concept_id: str,
    service: ActivityIdeationService = Depends(get_ideation_service)
):
    return service.select_concept(concept_id)

@router.get("/sessions/{session_id}", response_model=ActivityIdeationResult)
def get_review_session(
    session_id: str,
    service: ActivityIdeationService = Depends(get_ideation_service)
):
    return service.get_review_session(session_id)

@router.patch(
    "/sessions/{session_id}/concepts/{concept_id}",
    response_model=ActivityConceptResponse,
)
def edit_concept(
    session_id: str,
    concept_id: str,
    request: ActivityConceptEditRequest,
    service: ActivityIdeationService = Depends(get_ideation_service),
):
    return service.edit_temporary_concept(session_id, concept_id, request)

@router.post(
    "/sessions/{session_id}/concepts/{concept_id}/regenerate",
    response_model=ActivityConceptResponse,
)
def regenerate_concept(
    session_id: str,
    concept_id: str,
    service: ActivityIdeationService = Depends(get_ideation_service),
):
    try:
        return service.regenerate_concept(session_id, concept_id)
    except AIConfigurationError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except AIRetryExhaustedError as e:
        message = str(e)
        lowered = message.lower()
        if "429" in lowered or "quota" in lowered or "rate limit" in lowered:
            raise HTTPException(status_code=429, detail="AI provider quota or rate limit reached")
        raise HTTPException(status_code=502, detail=message)
    except AIProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))

@router.post(
    "/sessions/{session_id}/concepts/{concept_id}/approve",
    response_model=ActivityConceptResponse,
)
def approve_concept(
    session_id: str,
    concept_id: str,
    service: ActivityIdeationService = Depends(get_ideation_service),
):
    return service.approve_concept(session_id, concept_id)

@router.post(
    "/sessions/{session_id}/concepts/{concept_id}/reject",
    response_model=ActivityConceptResponse,
)
def reject_concept(
    session_id: str,
    concept_id: str,
    service: ActivityIdeationService = Depends(get_ideation_service),
):
    return service.reject_concept(session_id, concept_id)
