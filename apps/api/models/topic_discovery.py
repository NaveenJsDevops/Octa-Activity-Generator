from pydantic import BaseModel, Field, model_validator, field_validator
from typing import List, Optional, Any
from apps.api.models.domain import Topic

class TopicDiscoveryRequest(BaseModel):
    age_min: int = Field(..., ge=0)
    age_max: int = Field(..., ge=0)
    target_class: Optional[str] = None
    country_context: Optional[str] = None
    topic_family_id: Optional[str] = None
    intelligence_id: Optional[str] = None
    intelligence_name: Optional[str] = None
    skill_id: Optional[str] = None
    skill_name: Optional[str] = None
    sub_skill_id: Optional[str] = None
    sub_skill_name: Optional[str] = None
    requested_count: int = Field(default=5, gt=0, le=20)
    keywords: List[str] = Field(default_factory=list)

    @model_validator(mode='after')
    def validate_ranges(self) -> 'TopicDiscoveryRequest':
        if self.age_min > self.age_max:
            raise ValueError("age_min cannot be greater than age_max")
        return self

class TopicCandidateEditRequest(BaseModel):
    topic: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None

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
    suggested_intelligence: Optional[str] = None
    suggested_skills: List[str] = Field(default_factory=list)
    suggested_sub_skills: List[str] = Field(default_factory=list)
    user_selected_intelligence: Optional[str] = None
    user_selected_skills: List[str] = Field(default_factory=list)
    user_selected_sub_skills: List[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map legacy or test aliases
            if "suggested_skill_names" in data and "suggested_skills" not in data:
                data["suggested_skills"] = data["suggested_skill_names"]
            if "suggested_sub_skill_names" in data and "suggested_sub_skills" not in data:
                data["suggested_sub_skills"] = data["suggested_sub_skill_names"]
        return data

    @field_validator(
        "keywords",
        "suggested_skills",
        "suggested_sub_skills",
        "user_selected_skills",
        "user_selected_sub_skills",
        mode="before"
    )
    @classmethod
    def parse_str_or_list(cls, v: Any) -> List[str]:
        if v is None:
            return []
        if isinstance(v, list):
            return [str(item).strip() for item in v if str(item).strip()]
        if isinstance(v, str):
            return [part.strip() for part in v.split(",") if part.strip()]
        return [str(v)]

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
