import pytest
import os
import tempfile
import shutil
from unittest.mock import MagicMock
from datetime import datetime

from apps.api.models.topic_discovery import (
    TopicDiscoveryRequest,
    TopicDiscoveryOutput,
    TopicCandidate,
    TopicCandidateEditRequest,
)
from apps.api.services.topic_discovery.service import TopicDiscoveryService
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.ai.prompts.registry import PromptRegistry, PromptTemplate
from apps.api.models.domain import Skill, SubSkill

@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def repo(temp_data_dir):
    repo = FirestoreRepository(temp_data_dir)
    repo.initialize_database()
    
    # Populate some dummy master data
    repo.append_record("TopicFamilies", {"topic_family_id": "tf-science-technology", "name": "Science & Technology"})
    repo.append_record("Skills", {"skill_id": "SK-001", "intelligence_id": "INT-001", "name": "Observation"})
    repo.append_record("SubSkills", {"sub_skill_id": "SS-001", "skill_id": "SK-001", "name": "Visual Analysis"})
    
    return repo

@pytest.fixture
def prompt_registry():
    registry = PromptRegistry()
    registry.register_prompt(PromptTemplate(
        prompt_name="topic_discovery",
        version="v1.1",
        user_prompt_template="Topic family: {topic_family_name}",
        created_at=datetime.now()
    ))
    return registry

@pytest.fixture
def orchestrator():
    orch = MagicMock(spec=AIOrchestrator)
    return orch

@pytest.fixture
def service(repo, orchestrator, prompt_registry):
    # Ensure DuckDuckGo isn't actually called in tests
    svc = TopicDiscoveryService(repo, orchestrator, prompt_registry)
    svc.researcher.search = MagicMock(return_value=[{"title": "test", "snippet": "test", "url": "http://test"}])
    return svc

def test_successful_topic_discovery(service, orchestrator, repo):
    request = TopicDiscoveryRequest(
        age_min=5,
        age_max=7,
        keywords=["test"],
        skill_id="SK-001",
        topic_family_id="tf-science-technology",
        requested_count=2
    )
    
    # Mock AI response
    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Space Explorers",
                short_description="Let's go to space!",
                full_description="Kids love stars",
                activity_potential="HIGH",
                age_suitability="Perfect for 5-7",
                suggested_skill_names=["Observation"],
                suggested_sub_skill_names=["Visual Analysis"],
                keywords=["space", "stars"]
            ),
            TopicCandidate(
                topic="Deep Ocean",
                short_description="Dive deep!",
                full_description="Ocean is mysterious",
                activity_potential="MEDIUM",
                age_suitability="Perfect for 5-7",
                suggested_skill_names=["Observation"],
                suggested_sub_skill_names=["Fake SubSkill"],
                keywords=["ocean"]
            )
        ]
    )
    
    # Add a fake generation run so _generate_topic_id works
    repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
    result = service.discover_topics(request)
    assert "Topic family: Science & Technology" in orchestrator.generate_structured.call_args.kwargs["prompt"]
    
    assert "session_id" in result
    session_id = result["session_id"]
    
    # Keep the first candidate (Space Explorers)
    keep_result = service.keep_candidate(session_id, 0)
    assert keep_result["status"] == "success"
    
    # Reject the second candidate
    rej_result = service.reject_candidate(session_id, 1)
    assert rej_result["status"] == "success"
    
    # Check persistence
    saved_topics = repo.read_sheet("Topics")
    assert len(saved_topics) == 1
    assert saved_topics[0]["topic_id"] == "TOP-000001"
    assert saved_topics[0]["topic"] == "Space Explorers"
    assert saved_topics[0]["topic_family_id"] == "tf-science-technology"
    

    saved_keywords = repo.read_sheet("TopicKeywords")
    assert len(saved_keywords) == 2 

def test_discovery_rejects_unknown_topic_family(service, orchestrator):
    request = TopicDiscoveryRequest(
        age_min=5,
        age_max=7,
        topic_family_id="TF-UNKNOWN",
        requested_count=1,
    )

    with pytest.raises(ValueError, match="topic_family_id TF-UNKNOWN does not exist"):
        service.discover_topics(request)

    orchestrator.generate_structured.assert_not_called()


def test_discovery_without_topic_family_is_allowed(service, orchestrator):
    request = TopicDiscoveryRequest(
        age_min=5,
        age_max=7,
        keywords=["animals"],
        requested_count=1,
    )
    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(topics=[])

    service.discover_topics(request)

    assert "Topic family: Any" in orchestrator.generate_structured.call_args.kwargs["prompt"]

def test_duplicate_detection(service, orchestrator, repo):
    # Existing topic
    repo.append_record("Topics", {
        "topic_id": "TOP-000001", "topic": "Space Explorers", "topic_family_id": "tf-science-technology",
        "age_min": 5, "age_max": 7, "created_at": datetime.now(), "updated_at": datetime.now(),
        "created_by": "system", "status": "DRAFT"
    })
    
    request = TopicDiscoveryRequest(
        age_min=5, age_max=7, requested_count=2
    )
    
    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Space Explorers", # Exact duplicate
                short_description="Go to space", full_description="Kids love stars",
                activity_potential="HIGH", age_suitability="5-7"
            ),
            TopicCandidate(
                topic="Animals in Cities", 
                short_description="Urban animals", full_description="Kids love animals",
                activity_potential="HIGH", age_suitability="5-7"
            ),
            TopicCandidate(
                topic="Animals Living in Cities", # Lexical duplicate of above within same generation
                short_description="Urban animals 2", full_description="Kids love animals 2",
                activity_potential="HIGH", age_suitability="5-7"
            )
        ]
    )
    
    repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
    result = service.discover_topics(request)
    session_id = result["session_id"]
    
    keep_result = service.keep_all(session_id)
    results = keep_result["results"]
    
    assert results[0]["status"] == "rejected"
    assert "duplicate" in results[0]["reason"].lower()
    
    assert results[1]["status"] == "kept"
    saved_topics = repo.read_sheet("Topics")
    assert saved_topics[1]["topic_family_id"] is None
    
    assert results[2]["status"] == "rejected"
    assert "duplicate" in results[2]["reason"].lower()

def test_validation_failure(service, orchestrator, repo):
    request = TopicDiscoveryRequest(
        age_min=5, age_max=7, requested_count=1
    )
    
    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Too short", # Will fail hook length validation
                short_description="A", full_description="B",
                activity_potential="INVALID_POTENTIAL", age_suitability="5-7"
            )
        ]
    )
    
    repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
    result = service.discover_topics(request)
    session_id = result["session_id"]
    
    keep_result = service.keep_all(session_id)
    assert keep_result["results"][0]["status"] == "rejected"
    assert "insufficient" in keep_result["results"][0]["reason"].lower()

def test_activity_potential_validation(service, orchestrator, repo):
    request = TopicDiscoveryRequest(
        age_min=5, age_max=7, requested_count=6
    )
    
    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Topic HIGH", short_description="Great hook ok", full_description="Why interesting long enough",
                activity_potential="HIGH", age_suitability="5-7"
            ),
            TopicCandidate(
                topic="Topic MEDIUM", short_description="Great hook ok", full_description="Why interesting long enough",
                activity_potential="MEDIUM", age_suitability="5-7"
            ),
            TopicCandidate(
                topic="Topic LOW", short_description="Great hook ok", full_description="Why interesting long enough",
                activity_potential="LOW", age_suitability="5-7"
            ),
            TopicCandidate(
                topic="Topic Sentence", short_description="Great hook ok", full_description="Why interesting long enough",
                activity_potential="Students will design and build...", age_suitability="5-7"
            ),
            TopicCandidate(
                topic="Topic Invalid Enum", short_description="Great hook ok", full_description="Why interesting long enough",
                activity_potential="VERY_HIGH", age_suitability="5-7"
            ),
            TopicCandidate(
                topic="Topic Mixed", short_description="Great hook ok", full_description="Why interesting long enough",
                activity_potential="  medium  ", age_suitability="5-7"
            ),
        ]
    )
    
    repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
    result = service.discover_topics(request)
    session_id = result["session_id"]
    
    keep_result = service.keep_all(session_id)
    results = keep_result["results"]
    
    # 0, 1, 2, 5 should be kept. 3, 4 rejected.
    assert results[0]["status"] == "kept"
    assert results[1]["status"] == "kept"
    assert results[2]["status"] == "kept"
    assert results[3]["status"] == "rejected"
    assert results[4]["status"] == "rejected"
    assert results[5]["status"] == "kept"

def test_topic_discovery_with_intelligence_and_skills(service, orchestrator, repo):
    request = TopicDiscoveryRequest(
        age_min=10,
        age_max=12,
        keywords=["space", "robotics"],
        intelligence_id="INT-001",
        skill_id="SK-001",
        sub_skill_id="SS-001",
        requested_count=1
    )

    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Space Rover Exploration",
                short_description="Students design a lunar rover.",
                full_description="A hands-on challenge designing a rover.",
                activity_potential="HIGH",
                age_suitability="10-12",
                keywords=["space", "rover"]
            )
        ]
    )

    repo.append_record("GenerationRuns", {
        "generation_id": "gen-skills-test",
        "generation_type": "TOPIC_DISCOVERY",
        "model": "gpt",
        "prompt_version": "v1.0",
        "started_at": datetime.now(),
        "status": "COMPLETED"
    })

    result = service.discover_topics(request)
    session_id = result["session_id"]
    assert len(result["candidates"]) == 1

    keep_result = service.keep_candidate(session_id, 0)
    assert keep_result["status"] == "success"
    topic_id = keep_result["topic"]["topic_id"]

    # Verify TopicSkills record was saved
    topic_skills = repo.read_sheet("TopicSkills")
    matching_skills = [ts for ts in topic_skills if ts["topic_id"] == topic_id]
    assert len(matching_skills) == 1
    assert matching_skills[0]["skill_id"] == "SK-001"
    assert matching_skills[0]["sub_skill_id"] == "SS-001"
    assert matching_skills[0]["relationship_type"] == "PRIMARY"

def test_topic_discovery_user_selected_and_ai_suggested_mappings_distinction(service, orchestrator, repo):
    repo.append_record("Skills", {"skill_id": "SK-002", "intelligence_id": "INT-002", "name": "Data Analysis"})
    repo.append_record("Skills", {"skill_id": "SK-003", "intelligence_id": "INT-002", "name": "Eco-Awareness"})
    repo.append_record("SubSkills", {"sub_skill_id": "SS-002", "skill_id": "SK-002", "name": "Sensor Calibration"})

    request = TopicDiscoveryRequest(
        age_min=8,
        age_max=10,
        keywords=["robotics"],
        intelligence_id="INT-001",
        skill_id="SK-001",
        sub_skill_id="SS-001",
        requested_count=1
    )

    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Automated Weather Station",
                short_description="Build a miniature weather monitor.",
                full_description="Students assemble sensors and read atmospheric data.",
                activity_potential="HIGH",
                age_suitability="8-10",
                keywords=["weather", "sensors"],
                suggested_intelligence="Environmental",
                suggested_skills=["Data Analysis", "Eco-Awareness"],
                suggested_sub_skills=["Sensor Calibration"]
            )
        ]
    )

    repo.append_record("GenerationRuns", {
        "generation_id": "gen-mapping-test",
        "generation_type": "TOPIC_DISCOVERY",
        "model": "gemini",
        "prompt_version": "v1.1",
        "started_at": datetime.now(),
        "status": "COMPLETED"
    })

    result = service.discover_topics(request)
    session_id = result["session_id"]
    candidate = result["candidates"][0]

    # Verify user selections are tracked separately on candidate
    assert candidate["user_selected_skills"] == ["Observation"]
    assert candidate["user_selected_sub_skills"] == ["Visual Analysis"]
    assert candidate["suggested_intelligence"] == "Environmental"
    assert candidate["suggested_skills"] == ["Data Analysis", "Eco-Awareness"]
    assert candidate["suggested_sub_skills"] == ["Sensor Calibration"]

    # Save candidate
    keep_result = service.keep_candidate(session_id, 0)
    assert keep_result["status"] == "success"
    topic_data = keep_result["topic"]

    # Verify persisted Topic retains both mappings separately
    assert topic_data["user_selected_skills"] == ["Observation"]
    assert topic_data["user_selected_sub_skills"] == ["Visual Analysis"]
    assert topic_data["suggested_intelligence"] == "Environmental"
    assert topic_data["suggested_skills"] == ["Data Analysis", "Eco-Awareness"]
    assert topic_data["suggested_sub_skills"] == ["Sensor Calibration"]

def test_topic_discovery_without_user_selection_shows_ai_suggested(service, orchestrator, repo):
    repo.append_record("Skills", {"skill_id": "SK-004", "intelligence_id": "INT-003", "name": "Craftsmanship"})
    repo.append_record("SubSkills", {"sub_skill_id": "SS-003", "skill_id": "SK-004", "name": "Pattern Recognition"})

    request = TopicDiscoveryRequest(
        age_min=6,
        age_max=8,
        keywords=["origami"],
        requested_count=1
    )

    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Origami Geometry",
                short_description="Fold paper into geometric polyhedra.",
                full_description="Explore geometry through hands-on paper folding.",
                activity_potential="HIGH",
                age_suitability="6-8",
                keywords=["origami", "geometry"],
                suggested_intelligence="Artistic",
                suggested_skills=["Craftsmanship", "Spatial Reasoning"],
                suggested_sub_skills=["Pattern Recognition"]
            )
        ]
    )

    repo.append_record("GenerationRuns", {
        "generation_id": "gen-open-test",
        "generation_type": "TOPIC_DISCOVERY",
        "model": "gemini",
        "prompt_version": "v1.1",
        "started_at": datetime.now(),
        "status": "COMPLETED"
    })

    result = service.discover_topics(request)
    session_id = result["session_id"]
    candidate = result["candidates"][0]

    # User selections should be empty
    assert candidate["user_selected_intelligence"] is None
    assert candidate["user_selected_skills"] == []
    assert candidate["user_selected_sub_skills"] == []

    # AI suggested should be present
    assert candidate["suggested_intelligence"] == "Artistic"
    assert "Craftsmanship" in candidate["suggested_skills"]

    # Save and verify persistence
    keep_result = service.keep_candidate(session_id, 0)
    topic_data = keep_result["topic"]
    assert topic_data["user_selected_intelligence"] is None
    assert topic_data["suggested_intelligence"] == "Artistic"

def test_edit_candidate_in_session_and_persist_to_firestore(service, orchestrator, repo):
    request = TopicDiscoveryRequest(
        age_min=7,
        age_max=9,
        keywords=["robotics"],
        requested_count=1
    )

    orchestrator.generate_structured.return_value = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Initial Robot Topic",
                short_description="Initial short description.",
                full_description="Initial full description.",
                activity_potential="HIGH",
                age_suitability="7-9",
                keywords=["robotics"],
                suggested_intelligence="Mechanical",
                suggested_skills=[],
                suggested_sub_skills=[]
            )
        ]
    )

    repo.append_record("GenerationRuns", {
        "generation_id": "gen-edit-test",
        "generation_type": "TOPIC_DISCOVERY",
        "model": "gemini",
        "prompt_version": "v1.1",
        "started_at": datetime.now(),
        "status": "COMPLETED"
    })

    result = service.discover_topics(request)
    session_id = result["session_id"]

    # Edit the candidate in place
    edit_req = TopicCandidateEditRequest(
        topic="Refined Rover Navigation",
        short_description="Design autonomous rovers with obstacle sensors.",
        full_description="A deeper exploration into autonomous path planning and sensor calibration."
    )
    edit_res = service.edit_candidate(session_id, 0, edit_req)
    assert edit_res["candidate"]["topic"] == "Refined Rover Navigation"
    assert edit_res["candidate"]["short_description"] == "Design autonomous rovers with obstacle sensors."

    # Save to Firestore and verify edited fields were persisted
    keep_result = service.keep_candidate(session_id, 0)
    saved_topic = keep_result["topic"]
    assert saved_topic["topic"] == "Refined Rover Navigation"
    assert saved_topic["short_description"] == "Design autonomous rovers with obstacle sensors."
    assert saved_topic["full_description"] == "A deeper exploration into autonomous path planning and sensor calibration."

