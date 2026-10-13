from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional

from apps.api.models.topic_review import (
    TopicListFilter, TopicListResponse, TopicDetailResponse,
    TopicEditRequest, RejectTopicRequest, SelectTopicsRequest,
    TopicActionResponse, BulkTopicActionResponse
)
from apps.api.models.domain import TopicStatus
from apps.api.services.topic_review.service import TopicReviewService
from apps.api.repositories.excel import ExcelRepository
from apps.api.core.config import settings

router = APIRouter(prefix="/api/topics", tags=["Topic Review"])

def get_topic_review_service() -> TopicReviewService:
    repo = ExcelRepository(settings.DATA_DIR)
    return TopicReviewService(repo)

@router.get("", response_model=TopicListResponse)
def list_topics(
    status: Optional[str] = None,
    topic_family_id: Optional[str] = None,
    skill_id: Optional[str] = None,
    age_min: Optional[int] = None,
    age_max: Optional[int] = None,
    target_class: Optional[str] = None,
    search: Optional[str] = None,
    service: TopicReviewService = Depends(get_topic_review_service)
):
    # Sanitize status filter: ignore 'ALL', empty strings, and case discrepancies
    cleaned_status = None
    if status and status.strip() and status.strip().upper() != "ALL":
        try:
            cleaned_status = TopicStatus(status.strip().upper())
        except ValueError:
            cleaned_status = None

    filters = TopicListFilter(
        status=cleaned_status,
        topic_family_id=topic_family_id,
        skill_id=skill_id,
        age_min=age_min,
        age_max=age_max,
        target_class=target_class,
        search=search
    )
    topics = service.list_topics(filters)
    # Convert to detail response
    detailed = []
    for t in topics:
        detail = service.get_topic_detail(t.topic_id)
        if detail:
            detailed.append(TopicDetailResponse(**detail))
            
    return TopicListResponse(topics=detailed, total=len(detailed))

@router.get("/{topic_id}", response_model=TopicDetailResponse)
def get_topic(topic_id: str, service: TopicReviewService = Depends(get_topic_review_service)):
    detail = service.get_topic_detail(topic_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Topic not found")
    return TopicDetailResponse(**detail)

@router.patch("/{topic_id}", response_model=TopicActionResponse)
def edit_topic(topic_id: str, req: TopicEditRequest, service: TopicReviewService = Depends(get_topic_review_service)):
    success, msg = service.edit_topic(topic_id, req)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return TopicActionResponse(success=True, topic_id=topic_id, new_status="UNCHANGED", message=msg)

@router.post("/{topic_id}/review", response_model=TopicActionResponse)
def review_topic(topic_id: str, service: TopicReviewService = Depends(get_topic_review_service)):
    success, msg = service.review_topic(topic_id)
    if not success:
        raise HTTPException(status_code=409, detail=msg)
    return TopicActionResponse(success=True, topic_id=topic_id, new_status="REVIEW", message=msg)

@router.post("/{topic_id}/approve", response_model=TopicActionResponse)
def approve_topic(topic_id: str, service: TopicReviewService = Depends(get_topic_review_service)):
    success, msg = service.approve_topic(topic_id)
    if not success:
        raise HTTPException(status_code=409, detail=msg)
    return TopicActionResponse(success=True, topic_id=topic_id, new_status="APPROVED", message=msg)

@router.post("/{topic_id}/reject", response_model=TopicActionResponse)
def reject_topic(topic_id: str, req: RejectTopicRequest, service: TopicReviewService = Depends(get_topic_review_service)):
    success, msg = service.reject_topic(topic_id, req.reason)
    if not success:
        raise HTTPException(status_code=409, detail=msg)
    return TopicActionResponse(success=True, topic_id=topic_id, new_status="REJECTED", message=msg)

@router.post("/action/select", response_model=BulkTopicActionResponse)
def select_topics(req: SelectTopicsRequest, service: TopicReviewService = Depends(get_topic_review_service)):
    success_count, errors = service.select_topics(req.topic_ids)
    if success_count == 0 and errors:
        raise HTTPException(status_code=409, detail={"message": "Failed to select any topics", "errors": errors})
    return BulkTopicActionResponse(
        success=True,
        selected_count=success_count,
        failed_count=len(errors),
        errors=errors
    )

@router.post("/{topic_id}/unselect", response_model=TopicActionResponse)
def unselect_topic(topic_id: str, service: TopicReviewService = Depends(get_topic_review_service)):
    success, msg = service.unselect_topic(topic_id)
    if not success:
        raise HTTPException(status_code=409, detail=msg)
    return TopicActionResponse(success=True, topic_id=topic_id, new_status="APPROVED", message=msg)

@router.delete("/{topic_id}", response_model=TopicActionResponse)
def delete_topic(topic_id: str, service: TopicReviewService = Depends(get_topic_review_service)):
    success, msg = service.delete_topic(topic_id)
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    return TopicActionResponse(success=True, topic_id=topic_id, new_status="DELETED", message=msg)
