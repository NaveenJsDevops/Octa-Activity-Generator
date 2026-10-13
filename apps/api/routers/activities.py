from typing import List, Optional

from fastapi import APIRouter, Depends

from apps.api.core.config import settings
from apps.api.models.activity_ideation import ActivityLibraryItem
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.activity_ideation.service import ActivityIdeationService
from apps.api.services.ai.orchestrator import AIOrchestrator

router = APIRouter(prefix="/api/activities", tags=["Activities"])


def get_activity_service() -> ActivityIdeationService:
    repository = ExcelRepository(settings.DATA_DIR)
    return ActivityIdeationService(repository, AIOrchestrator(repository))


@router.get("", response_model=List[ActivityLibraryItem])
def list_activities(
    search: Optional[str] = None,
    topic_id: Optional[str] = None,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    return service.list_activities(search=search, topic_id=topic_id)


@router.get("/{activity_id}", response_model=ActivityLibraryItem)
def get_activity(
    activity_id: str,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    return service.get_activity(activity_id)
