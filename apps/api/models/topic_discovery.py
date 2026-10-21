from pydantic import BaseModel, Field, model_validator
from typing import List, Optional, Any
from apps.api.models.domain import Topic
class TopicDiscoveryRequest(BaseModel):
    age_min: int = Field(..., ge=0)
    age_max: int = Field(..., ge=0)
    target_class: Optional[str] = None
    country_context: Optional[str] = None
    topic_family_id: Optional[str] = None
    requested_count: int = Field(default=5, gt=0, le=20)
    keywords: List[str] = Field(default_factory=list)

    @model_validator(mode='after')
    def validate_ranges(self) -> 'TopicDiscoveryRequest':
        if self.age_min > self.age_max:
            raise ValueError("age_min cannot be greater than age_max")
        return self

class TopicCandidate(BaseModel):
    topic: str
    short_description: str
    full_description: str
    activity_potential: str = Field(
        ..., 
        json_schema_extra={"enum": ["HIGH", "MEDIUM", "LOW"]}
    )
    age_suitability: str
    keywords: List[str] = Field(default_factory=list)

class TopicDiscoveryOutput(BaseModel):
    """The strict structure expected from the AI provider."""
    topics: List[TopicCandidate]

class DuplicateCheckResult(BaseModel):
    is_duplicate: bool
    matched_topic_id: Optional[str] = None
    similarity_type: Optional[str] = None
    reason: Optional[str] = None

class RejectedCandidate(BaseModel):
    candidate: TopicCandidate
    reason: str
    validation_type: str

class TopicDiscoveryResult(BaseModel):
    request: TopicDiscoveryRequest
    generation_id: str
    requested_count: int
    generated_count: int
    accepted_count: int
    rejected_count: int
    duplicate_count: int
    topics: List[Topic]
    rejected_candidates: List[RejectedCandidate]
    duplicates: List[RejectedCandidate]
