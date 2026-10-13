from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from apps.api.models.domain import TopicStatus, Topic

class TopicListFilter(BaseModel):
    status: Optional[TopicStatus] = None
    topic_family_id: Optional[str] = None
    skill_id: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    target_class: Optional[str] = None
    search: Optional[str] = None

class TopicDetailResponse(BaseModel):
    topic: Topic
    topic_family_name: str
    skills: List[Dict[str, Any]]
    keywords: List[str]

class TopicListResponse(BaseModel):
    topics: List[TopicDetailResponse]
    total: int

class TopicEditRequest(BaseModel):
    topic: Optional[str] = None
    topic_hook: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    why_interesting: Optional[str] = None
    topic_family_id: Optional[str] = None
    activity_potential: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    target_class: Optional[str] = None
    country_context: Optional[str] = None
    keywords: Optional[List[str]] = None

class RejectTopicRequest(BaseModel):
    reason: str = Field(..., min_length=3)

class SelectTopicsRequest(BaseModel):
    topic_ids: List[str]

class TopicActionResponse(BaseModel):
    success: bool
    topic_id: str
    new_status: str
    message: str

class BulkTopicActionResponse(BaseModel):
    success: bool
    selected_count: int
    failed_count: int
    errors: List[str]
