import pytest
import os
import tempfile
import shutil
from unittest.mock import MagicMock
from datetime import datetime

from apps.api.models.topic_discovery import TopicDiscoveryRequest, TopicDiscoveryOutput, TopicCandidate
from apps.api.services.topic_discovery.service import TopicDiscoveryService
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.ai.prompts.registry import PromptRegistry, PromptTemplate
from apps.api.models.domain import TopicFamily, Skill, SubSkill, Topic

@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def excel_repo(temp_data_dir):
    repo = ExcelRepository(temp_data_dir)
    repo.initialize_workbooks()
    
    # Populate some dummy master data
    repo.append_record("TopicFamilies", {"topic_family_id": "TF-001", "name": "Science & Nature"})
    repo.append_record("Skills", {"skill_id": "SK-001", "intelligence_id": "INT-001", "name": "Observation"})
    repo.append_record("SubSkills", {"sub_skill_id": "SS-001", "skill_id": "SK-001", "name": "Visual Analysis"})
    
    return repo

@pytest.fixture
def prompt_registry():
    registry = PromptRegistry()
    registry.register_prompt(PromptTemplate(
        prompt_name="topic_discovery",
        version="v1.1",
        user_prompt_template="Test",
        created_at=datetime.now()
    ))
    return registry

@pytest.fixture
def orchestrator():
    orch = MagicMock(spec=AIOrchestrator)
    return orch

@pytest.fixture
def service(excel_repo, orchestrator, prompt_registry):
    # Ensure DuckDuckGo isn't actually called in tests
    svc = TopicDiscoveryService(excel_repo, orchestrator, prompt_registry)
    svc.researcher.search = MagicMock(return_value=[{"title": "test", "snippet": "test", "url": "http://test"}])
    return svc

def test_successful_topic_discovery(service, orchestrator, excel_repo):
    request = TopicDiscoveryRequest(
        age_min=5,
        age_max=7,
        keywords=["test"],
        skill_id="SK-001",
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
    excel_repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
    result = service.discover_topics(request)
    
    assert "session_id" in result
    session_id = result["session_id"]
    
    # Keep the first candidate (Space Explorers)
    keep_result = service.keep_candidate(session_id, 0)
    assert keep_result["status"] == "success"
    
    # Reject the second candidate
    rej_result = service.reject_candidate(session_id, 1)
    assert rej_result["status"] == "success"
    
    # Check persistence
    saved_topics = excel_repo.read_sheet("Topics")
    assert len(saved_topics) == 1
    assert saved_topics[0]["topic_id"] == "TOP-000001"
    assert saved_topics[0]["topic"] == "Space Explorers"
    

    saved_keywords = excel_repo.read_sheet("TopicKeywords")
    assert len(saved_keywords) == 2 

def test_duplicate_detection(service, orchestrator, excel_repo):
    # Existing topic
    excel_repo.append_record("Topics", {
        "topic_id": "TOP-000001", "topic": "Space Explorers", "topic_family_id": "TF-001",
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
    
    excel_repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
    result = service.discover_topics(request)
    session_id = result["session_id"]
    
    keep_result = service.keep_all(session_id)
    results = keep_result["results"]
    
    assert results[0]["status"] == "rejected"
    assert "duplicate" in results[0]["reason"].lower()
    
    assert results[1]["status"] == "kept"
    
    assert results[2]["status"] == "rejected"
    assert "duplicate" in results[2]["reason"].lower()

def test_validation_failure(service, orchestrator, excel_repo):
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
    
    excel_repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
    result = service.discover_topics(request)
    session_id = result["session_id"]
    
    keep_result = service.keep_all(session_id)
    assert keep_result["results"][0]["status"] == "rejected"
    assert "insufficient" in keep_result["results"][0]["reason"].lower()

def test_activity_potential_validation(service, orchestrator, excel_repo):
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
    
    excel_repo.append_record("GenerationRuns", {"generation_id": "gen-123", "generation_type": "TOPIC_DISCOVERY", "model": "gpt", "prompt_version": "v1.0", "started_at": datetime.now(), "status": "COMPLETED"})
    
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
