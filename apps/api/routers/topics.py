from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from apps.api.models.topic_discovery import (
    TopicDiscoveryRequest, TopicDiscoveryResult, 
    TopicCandidate, RejectedCandidate, TopicCandidateEditRequest
)
from apps.api.services.topic_discovery.service import TopicDiscoveryService
from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.services.ai.prompts.registry import PromptRegistry, PromptTemplate
from apps.api.services.ai.exceptions import AIConfigurationError
from apps.api.core.config import settings
from datetime import datetime

router = APIRouter(prefix="/api/topics", tags=["topics"])

# Dependency injection helpers
def get_repository() -> FirestoreRepository:
    return FirestoreRepository(settings.DATA_DIR)

def get_prompt_registry() -> PromptRegistry:
    registry = PromptRegistry()
    registry.register_prompt(PromptTemplate(
        prompt_name="topic_discovery",
        version="v1.1",
        system_prompt="You are an expert curriculum designer for Octa Kids. Generate engaging, unique activity topics strictly aligned with our educational taxonomy.",
        user_prompt_template=(
            "Generate {requested_count} topic candidates for age {age_min} to {age_max} (Class: {target_class}).\n"
            "Topic family: {topic_family_name}. Context: {country_context}.\n"
            "{educational_focus}\n"
            "Use these keywords for inspiration: {keyword_context}.\n"
            "Web Research Info to guide topics:\n{web_research_context}\n\n"
            "Ensure topics are highly engaging, educational, and suitable for the age group.\n"
            "CRITICAL: For every topic candidate, you MUST populate 'suggested_intelligence', 'suggested_skills', and 'suggested_sub_skills' strictly using our official taxonomy:\n"
            "1. 'suggested_intelligence': MUST be exactly one of: Artistic, Arithmetic, Communication, Cognitive, Creative, Emotional, Environmental, Social. (Never combine or invent categories like 'Multidisciplinary').\n"
            "2. 'suggested_skills': 1 to 3 skills selected from our official skills: Artistic Expression, Craftsmanship, Data Analysis, Financial Literacy, Mathematical Thinking & Calculations, Numerical Patterns, Listening, Verbal Expression, Written Expression, Conceptualization, Critical Thinking, Decision-Making, Logical Reasoning, Observation, Systems Thinking, Abstract Thinking, Adaptability, Curiosity, Experimentation, Exploration, Imagination, Lateral Thinking, Mindfulness, Positive Reinforcement, Self-Awareness, Self-Motivation, Self-Regulation, Eco-Awareness, Spatial Awareness, Collaboration, Conflict Resolution, Constructive Feedback, Empathy, Group Dynamics, Leadership, Trust-Building.\n"
            "3. 'suggested_sub_skills': 1 to 3 specific sub-skills matching the selected skills from our official catalogue (e.g. Exploring Visual Art Techniques, Analyzing Elements of Artwork, Graphing and Charting, Problem Solving with Numbers, Active Listening, Structuring a Story, Analysis, Critical Thinking, Pattern Recognition, In-depth Exploration, Hypothesis Testing, Prototyping, Understanding Ecosystems, Biodiversity and Conservation, Teamwork Strategies, Perspective-Taking).\n"
            "IMPORTANT: 'activity_potential' MUST be exactly one of: HIGH, MEDIUM, or LOW.\n"
            "Do NOT include explanations, sentences, or natural language in 'activity_potential'."
        ),
        status="ACTIVE",
        created_at=datetime.now()
    ))
    return registry

def get_ai_orchestrator(repo: FirestoreRepository = Depends(get_repository)) -> AIOrchestrator:
    return AIOrchestrator(repo)

def get_topic_discovery_service(
    repo: FirestoreRepository = Depends(get_repository),
    orchestrator: AIOrchestrator = Depends(get_ai_orchestrator),
    prompt_registry: PromptRegistry = Depends(get_prompt_registry)
) -> TopicDiscoveryService:
    return TopicDiscoveryService(repo, orchestrator, prompt_registry)

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

@router.patch("/discovery/{session_id}/candidate/{index}")
def edit_candidate(
    session_id: str,
    index: int,
    req: TopicCandidateEditRequest,
    service: TopicDiscoveryService = Depends(get_topic_discovery_service)
):
    try:
        return service.edit_candidate(session_id, index, req)
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
