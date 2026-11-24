from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from apps.api.core.config import settings
from apps.api.models.activity_ideation import (
    ActivityLibraryItem,
    ActivityEditRequest,
    VersionItemResponse,
)
from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.activity_ideation.service import ActivityIdeationService
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.services.export_service import generate_activity_excel, generate_batch_activities_excel, _sanitize_filename

router = APIRouter(prefix="/api/activities", tags=["Activities"])

# Batch export maximum safety ceiling
MAX_BATCH_EXPORT_SIZE = 50


def get_activity_service() -> ActivityIdeationService:
    repository = FirestoreRepository(settings.DATA_DIR)
    return ActivityIdeationService(repository, AIOrchestrator(repository))


@router.get("", response_model=List[ActivityLibraryItem])
def list_activities(
    search: Optional[str] = None,
    topic_id: Optional[str] = None,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    return service.list_activities(search=search, topic_id=topic_id)


@router.post("/export/excel")
def export_activity_excel_post(
    data: Dict[str, Any],
):
    """Generates and downloads an Excel file for an activity or review concept with optional section controls."""
    try:
        options = data.get("options")
        buffer = generate_activity_excel(data, options=options)
        title = data.get("activity_name") or data.get("title") or data.get("activity_title") or "activity"
        filename = f"{_sanitize_filename(title)}.xlsx"
        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export activity to Excel: {str(e)}")


@router.post("/export/excel/batch")
def export_activities_excel_batch(
    payload: Dict[str, Any],
):
    """Generates and downloads a consolidated Excel workbook for multiple selected activities."""
    try:
        activities = payload.get("activities", [])
        if not activities:
            raise HTTPException(status_code=400, detail="No activities provided for batch export")
        if len(activities) > MAX_BATCH_EXPORT_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Batch export limit exceeded: Maximum {MAX_BATCH_EXPORT_SIZE} activities per request (received {len(activities)})",
            )

        options = payload.get("options")
        buffer = generate_batch_activities_excel(activities, options=options)
        filename = f"OCTAKIDZ_Activities_Batch_{len(activities)}_Items.xlsx"
        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to batch export activities to Excel: {str(e)}")


@router.get("/{activity_id}/export/excel")
def export_activity_excel_get(
    activity_id: str,
    include_educational_metadata: bool = Query(True, description="Include Section 6 educational metadata"),
    include_parent_guidance: bool = Query(True, description="Include Parent Note and Guide"),
    include_carried_forward_mappings: bool = Query(True, description="Include Section 2 carried-forward mappings"),
    service: ActivityIdeationService = Depends(get_activity_service),
):
    """Generates and downloads an Excel file for an existing approved activity."""
    item = service.get_activity(activity_id)
    if not item:
        raise HTTPException(status_code=404, detail="Activity not found")

    act_dict = item.get("activity", {})
    export_payload = {
        **act_dict,
        "topic_title": item.get("topic_title"),
        "topic_family_name": item.get("topic_family_name"),
        "country_context": item.get("country_context"),
        "keywords": item.get("keywords", []),
        "mappings": item.get("mappings"),
        "skills": item.get("skills", []),
    }
    options = {
        "include_educational_metadata": include_educational_metadata,
        "include_parent_guidance": include_parent_guidance,
        "include_carried_forward_mappings": include_carried_forward_mappings,
    }
    buffer = generate_activity_excel(export_payload, options=options)
    title = act_dict.get("activity_name") or act_dict.get("title") or "activity"
    filename = f"{_sanitize_filename(title)}.xlsx"
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{activity_id}", response_model=ActivityLibraryItem)
def get_activity(
    activity_id: str,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    return service.get_activity(activity_id)


@router.patch("/{activity_id}", response_model=ActivityLibraryItem)
def edit_activity(
    activity_id: str,
    req: ActivityEditRequest,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    return service.edit_activity(activity_id, req)


@router.delete("/{activity_id}")
def delete_activity(
    activity_id: str,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    service.delete_activity(activity_id)
    return {"success": True, "activity_id": activity_id, "message": "Activity deleted successfully"}


@router.get("/{activity_id}/versions", response_model=List[VersionItemResponse])
def get_activity_versions(
    activity_id: str,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    return service.get_activity_versions(activity_id)


@router.post("/{activity_id}/restore/{version_id}", response_model=ActivityLibraryItem)
def restore_activity_version(
    activity_id: str,
    version_id: str,
    service: ActivityIdeationService = Depends(get_activity_service),
):
    return service.restore_activity_version(activity_id, version_id)
