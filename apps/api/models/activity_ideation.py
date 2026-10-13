from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from apps.api.models.domain import Activity, MainActivity, PostActivity, PreActivity

class ActivityIdeationRequest(BaseModel):
    topic_id: str
    requested_count: int = Field(default=5, ge=1, le=10)

class AIActivityConcept(BaseModel):
    activity_name: str = Field(min_length=3, max_length=160)
    activity_duration: str = Field(min_length=1)
    pre_activity: PreActivity
    main_activity: MainActivity
    post_activity: PostActivity
    activity_type: str
    primary_skill: Optional[str] = None
    primary_sub_skill: Optional[str] = None
    secondary_skills: List[str] = Field(default_factory=list)
    learning_objective: Optional[str] = None
    materials: List[str] = Field(default_factory=list)
    assessment_criteria: Optional[str] = None
    estimated_duration: int = Field(default=30, ge=5, le=180)
    difficulty_level: Optional[str] = None

    @field_validator("activity_name", "activity_duration", mode="before")
    @classmethod
    def trim_required_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @property
    def activity_title(self) -> str:
        return self.activity_name

    @property
    def activity_concept(self) -> str:
        return self.pre_activity.activity_description

    @property
    def learner_task(self) -> str:
        return self.main_activity.activity_step_task_title

    @property
    def expected_output(self) -> str:
        return self.post_activity.post_activity_summary

    @property
    def why_it_is_engaging(self) -> str:
        return self.pre_activity.why_how_is_this_important

    @property
    def instructions(self) -> List[str]:
        return self.main_activity.in_depth_description_and_process

class ActivityIdeationAIResponse(BaseModel):
    activities: List[AIActivityConcept]

class ActivityConceptResponse(BaseModel):
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
    status: str
    created_at: str
    generation_id: Optional[str] = None
    learning_objective: Optional[str] = None
    materials: List[str] = Field(default_factory=list)
    instructions: List[str] = Field(default_factory=list)
    assessment_criteria: Optional[str] = None
    estimated_duration: Optional[int] = None
    difficulty_level: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    target_class: Optional[str] = None
    topic_title: Optional[str] = None
    activity_name: Optional[str] = None
    activity_duration: Optional[str] = None
    pre_activity: Optional[PreActivity] = None
    main_activity: Optional[MainActivity] = None
    post_activity: Optional[PostActivity] = None

class ActivityIdeationResult(BaseModel):
    topic_id: str
    session_id: Optional[str] = None
    generated_count: int
    accepted_count: int
    duplicate_count: int
    rejected_count: int
    concepts: List[ActivityConceptResponse]
    rejected_candidates: List[dict]


class ActivityConceptEditRequest(BaseModel):
    activity_name: Optional[str] = Field(default=None, min_length=3, max_length=160)
    activity_duration: Optional[str] = Field(default=None, min_length=1)
    pre_activity: Optional[PreActivity] = None
    main_activity: Optional[MainActivity] = None
    post_activity: Optional[PostActivity] = None
    learning_objective: Optional[str] = None
    materials: Optional[List[str]] = None
    assessment_criteria: Optional[str] = None
    estimated_duration: Optional[int] = Field(default=None, ge=5, le=180)
    difficulty_level: Optional[str] = None


class ActivityLibraryItem(BaseModel):
    activity: Activity
    topic_title: str
    skills: List[dict] = Field(default_factory=list)
