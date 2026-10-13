from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import datetime
import json
from apps.api.models.enums import TopicStatus, ActivityStatus, RelationshipType, GenerationStatus, QualityStatus, ActivityPotential

# Master Data Models
class Intelligence(BaseModel):
    intelligence_id: str
    name: str
    description: Optional[str] = None

class Skill(BaseModel):
    skill_id: str
    intelligence_id: str
    name: str
    description: Optional[str] = None

class SubSkill(BaseModel):
    sub_skill_id: str
    skill_id: str
    name: str
    description: Optional[str] = None

class TopicFamily(BaseModel):
    topic_family_id: str
    name: str
    description: Optional[str] = None

class ActivityType(BaseModel):
    activity_type_id: str
    name: str
    description: Optional[str] = None

# Topic Domain
class Topic(BaseModel):
    topic_id: str
    topic: str
    short_description: Optional[str] = None
    topic_family_id: Optional[str] = None
    age_min: int
    age_max: int
    target_class: Optional[str] = None
    country_context: Optional[str] = None
    full_description: Optional[str] = None
    activity_potential: Optional[ActivityPotential] = None
    age_suitability: Optional[str] = None
    status: TopicStatus = TopicStatus.DRAFT
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str
    generation_id: Optional[str] = None

class TopicSkill(BaseModel):
    topic_id: str
    skill_id: str
    sub_skill_id: str
    relationship_type: RelationshipType = RelationshipType.PRIMARY

class TopicKeyword(BaseModel):
    topic_id: str
    keyword: str
    source: Optional[str] = None

class TopicSource(BaseModel):
    source_id: str
    topic_id: str
    source_url: str
    source_title: str
    source_domain: Optional[str] = None
    source_date: Optional[str] = None
    retrieved_at: datetime
    relevance: Optional[str] = None

class TopicReviewHistory(BaseModel):
    review_id: str
    topic_id: str
    action: str
    previous_status: TopicStatus
    new_status: TopicStatus
    reason: Optional[str] = None
    changed_at: datetime
    changed_by: str


# Activity Domain
class PreActivity(BaseModel):
    activity_description: str = Field(min_length=1)
    parents_note: str = Field(min_length=1)
    parents_guide: Optional[str] = None
    pre_activity_engagement: list[str] = Field(default_factory=list, max_length=3)
    why_how_is_this_important: str = Field(min_length=1)
    lets_get_started: str = Field(min_length=1)

    @field_validator(
        "activity_description",
        "parents_note",
        "why_how_is_this_important",
        "lets_get_started",
        mode="before",
    )
    @classmethod
    def require_non_empty_text(cls, value):
        if isinstance(value, str):
            value = value.strip()
        return value

    @field_validator("parents_guide", mode="before")
    @classmethod
    def normalize_optional_guide(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("pre_activity_engagement", mode="before")
    @classmethod
    def parse_engagement(cls, value):
        return _clean_text_list(_parse_json_array(value))


class MainActivity(BaseModel):
    activity_step_task_title: str = Field(min_length=1)
    scenario_real_life_connection: Optional[str] = None
    in_depth_description_and_process: list[str] = Field(min_length=3)
    reflection_questions: list[str] = Field(min_length=2)

    @field_validator("activity_step_task_title", mode="before")
    @classmethod
    def require_non_empty_title(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("scenario_real_life_connection", mode="before")
    @classmethod
    def normalize_optional_scenario(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("in_depth_description_and_process", "reflection_questions", mode="before")
    @classmethod
    def parse_main_lists(cls, value):
        return _clean_text_list(_parse_json_array(value))


class PostActivity(BaseModel):
    whats_next: str = Field(min_length=1)
    extend_the_learning: list[str] = Field(min_length=1)
    how_to_improvise_or_level_up: str = Field(min_length=1)
    post_activity_summary: str = Field(min_length=1)

    @field_validator(
        "whats_next",
        "how_to_improvise_or_level_up",
        "post_activity_summary",
        mode="before",
    )
    @classmethod
    def require_non_empty_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("extend_the_learning", mode="before")
    @classmethod
    def parse_extension_list(cls, value):
        return _clean_text_list(_parse_json_array(value))


class ActivityConcept(BaseModel):
    concept_id: str
    topic_id: str
    activity_title: str
    activity_type_id: str
    activity_concept: str
    learner_task: str
    expected_output: str
    primary_skill_id: Optional[str] = None
    primary_sub_skill_id: Optional[str] = None
    why_engaging: Optional[str] = None
    status: ActivityStatus = ActivityStatus.DRAFT
    created_at: datetime
    generation_id: Optional[str] = None
    learning_objective: Optional[str] = None
    materials: list[str] = Field(default_factory=list)
    instructions: list[str] = Field(default_factory=list)
    assessment_criteria: Optional[str] = None
    estimated_duration: Optional[int] = None
    difficulty_level: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    target_class: Optional[str] = None
    activity_name: Optional[str] = None
    activity_duration: Optional[str] = None
    pre_activity: Optional[PreActivity] = None
    main_activity: Optional[MainActivity] = None
    post_activity: Optional[PostActivity] = None

    @field_validator("materials", "instructions", mode="before")
    @classmethod
    def parse_concept_lists(cls, value):
        return _parse_json_array(value)

    @field_validator("pre_activity", "main_activity", "post_activity", mode="before")
    @classmethod
    def parse_activity_sections(cls, value):
        return _parse_json_object(value)


class Activity(BaseModel):
    activity_id: str
    concept_id: str
    topic_id: str
    title: str
    description: str
    instructions: str
    expected_output: str
    age_min: int = Field(ge=0)
    age_max: int = Field(ge=0)
    estimated_duration: int = Field(gt=0)
    status: ActivityStatus = ActivityStatus.DRAFT
    created_at: datetime
    updated_at: datetime
    learning_objective: Optional[str] = None
    target_class: Optional[str] = None
    materials: list[str] = Field(default_factory=list)
    assessment_criteria: Optional[str] = None
    difficulty_level: Optional[str] = None
    activity_type_id: Optional[str] = None
    generation_id: Optional[str] = None
    activity_name: Optional[str] = None
    activity_duration: Optional[str] = None
    pre_activity: Optional[PreActivity] = None
    main_activity: Optional[MainActivity] = None
    post_activity: Optional[PostActivity] = None

    @field_validator("materials", mode="before")
    @classmethod
    def parse_materials(cls, value):
        return _parse_json_array(value)

    @field_validator("pre_activity", "main_activity", "post_activity", mode="before")
    @classmethod
    def parse_activity_sections(cls, value):
        return _parse_json_object(value)

    @model_validator(mode="after")
    def validate_age_range(self):
        if self.age_max < self.age_min:
            raise ValueError("age_max must be greater than or equal to age_min")
        return self


def _parse_json_array(value):
    if isinstance(value, str):
        if not value.strip():
            return []
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError("value must be a JSON array") from exc
        return parsed
    return value


def _parse_json_object(value):
    if isinstance(value, str):
        if not value.strip():
            return None
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError as exc:
            raise ValueError("value must be a JSON object") from exc
        if not isinstance(parsed, dict):
            raise ValueError("value must be a JSON object")
        return parsed
    return value


def _clean_text_list(value):
    if isinstance(value, list):
        cleaned = [item.strip() if isinstance(item, str) else item for item in value]
        if any(not item for item in cleaned if isinstance(item, str)):
            raise ValueError("list items must not be empty")
        return cleaned
    return value

class ActivitySkill(BaseModel):
    activity_id: str
    skill_id: str
    sub_skill_id: str
    relationship_type: RelationshipType = RelationshipType.PRIMARY

class ActivityVersion(BaseModel):
    version_id: str
    activity_id: str
    version_number: int
    content: str
    generation_id: Optional[str] = None
    created_at: datetime
    created_by: str

class QualityCheck(BaseModel):
    quality_check_id: str
    activity_id: str
    version_id: str
    age_suitability: QualityStatus
    clarity: QualityStatus
    creativity: QualityStatus
    skill_alignment: QualityStatus
    duplication: QualityStatus
    safety: QualityStatus
    overall_status: QualityStatus
    feedback: Optional[str] = None
    checked_at: datetime

# AI Tracking
class GenerationRun(BaseModel):
    generation_id: str
    generation_type: str
    model: str
    prompt_version: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: GenerationStatus
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    duration_ms: Optional[int] = None
    error: Optional[str] = None
    metadata: Optional[str] = None
