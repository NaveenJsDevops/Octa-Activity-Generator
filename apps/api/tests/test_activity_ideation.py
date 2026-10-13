import pytest
import os
import tempfile
import uuid
import json
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from pydantic import ValidationError

from apps.api.main import app
from apps.api.routers.activity_ideation import get_excel_repository, get_ai_orchestrator, get_ideation_service
from apps.api.routers.activities import get_activity_service
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.activity_ideation.service import ActivityIdeationService
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.services.ai.exceptions import AIRetryExhaustedError
from apps.api.models.domain import TopicStatus, ActivityStatus
from apps.api.models.activity_ideation import ActivityIdeationAIResponse, AIActivityConcept


def ai_template(name, description=None):
    return {
        "activity_name": name,
        "activity_duration": "25 minutes",
        "pre_activity": {
            "activity_description": description or f"Explore {name.lower()} by building a colorful nature discovery journal.",
            "parents_note": f"An adult can help with the safe setup for {name.lower()}.",
            "parents_guide": f"For {name.lower()}, stay nearby and help the child work safely.",
            "pre_activity_engagement": [f"What clues could help with {name.lower()}?"],
            "why_how_is_this_important": f"Planning {name.lower()} helps children notice and compare evidence.",
            "lets_get_started": f"Gather your notebook and begin the {name.lower()} investigation.",
        },
        "main_activity": {
            "activity_step_task_title": f"{name}: collect clues and design a field guide",
            "scenario_real_life_connection": f"Scientists use {name.lower()} to investigate changing habitats.",
            "in_depth_description_and_process": [
                f"Choose a safe place for the {name.lower()} activity with an adult.",
                f"Record three different clues in your {name.lower()} field guide.",
                f"Compare the clues and explain what they reveal about {name.lower()}.",
            ],
            "reflection_questions": [
                f"Which clue was most useful for {name.lower()}?",
                f"How could you use {name.lower()} to solve a real-world question?",
            ],
        },
        "post_activity": {
            "whats_next": f"Share your {name.lower()} field guide with someone at home.",
            "extend_the_learning": [f"Repeat {name.lower()} with a new location and compare the evidence."],
            "how_to_improvise_or_level_up": f"Challenge a partner to extend your {name.lower()} investigation.",
            "post_activity_summary": f"{name}: a child-created field guide based on collected evidence.",
        },
    }


# --- MOCK EXCEL REPO SETUP ---
@pytest.fixture
def test_data_dir():
    with tempfile.TemporaryDirectory() as temp_dir:
        repo = ExcelRepository(temp_dir)
        repo.initialize_workbooks()
        
        # Insert minimal master data
        repo.append_record("TopicFamilies", {"topic_family_id": "TF1", "name": "Science"})
        repo.append_record("Intelligences", {"intelligence_id": "I1", "name": "Logical"})
        repo.append_record("Skills", {"skill_id": "SK1", "intelligence_id": "I1", "name": "Observation"})
        repo.append_record("SubSkills", {"sub_skill_id": "SS1", "skill_id": "SK1", "name": "Noticing details"})
        repo.append_record("Skills", {"skill_id": "SK2", "intelligence_id": "I1", "name": "Creative thinking"})
        repo.append_record("SubSkills", {"sub_skill_id": "SS2", "skill_id": "SK2", "name": "Designing solutions"})
        repo.append_record("ActivityTypes", {"activity_type_id": "AT1", "name": "Investigation"})
        
        # Insert a SELECTED topic
        repo.append_record("Topics", {
            "topic_id": "TOP-001",
            "topic": "Urban Wildlife",
            "short_description": "Find animals in your city.",
            "topic_family_id": "TF1",
            "age_min": 6,
            "age_max": 9,
            "status": TopicStatus.SELECTED.value,
            "created_by": "test",
            "created_at": "2026-01-01T00:00:00",
            "updated_at": "2026-01-01T00:00:00"
        })
        
        # Insert a non-selected topic
        repo.append_record("Topics", {
            "topic_id": "TOP-002",
            "topic": "Space Travel",
            "short_description": "Go to the moon.",
            "topic_family_id": "TF1",
            "age_min": 6,
            "age_max": 9,
            "status": TopicStatus.DRAFT.value,
            "created_by": "test",
            "created_at": "2026-01-01T00:00:00",
            "updated_at": "2026-01-01T00:00:00"
        })
        
        # Topic Skills & Keywords
        repo.append_record("TopicSkills", {"topic_id": "TOP-001", "skill_id": "SK1", "sub_skill_id": "SS1"})
        repo.append_record("TopicKeywords", {"topic_id": "TOP-001", "keyword": "animals"})
        
        yield repo

# --- MOCK AI ORCHESTRATOR ---
@pytest.fixture
def mock_ai():
    orchestrator = MagicMock(spec=AIOrchestrator)
    # Default to 3 valid concepts
    orchestrator.generate_structured.return_value = ActivityIdeationAIResponse(
        activities=[
            AIActivityConcept(
                **ai_template("Concept 1", "This is a concept description."),
                activity_type="Investigation",
                primary_skill="Observation",
                primary_sub_skill="Noticing details",
                learning_objective="Learners observe patterns in urban wildlife.",
                materials=["paper", "pencils"],
                assessment_criteria="Learner records two observations and explains one pattern.",
                estimated_duration=25,
                difficulty_level="Beginner",
            ),
            AIActivityConcept(
                **ai_template("Unique Idea", "Use a color-coded city map to find imaginary wildlife tracks and plan a safe route."),
                activity_type="Investigation",
                primary_skill="Observation",
                primary_sub_skill="Noticing details",
            )
        ]
    )
    return orchestrator

@pytest.fixture
def client(test_data_dir, mock_ai):
    app.dependency_overrides[get_excel_repository] = lambda: test_data_dir
    app.dependency_overrides[get_ai_orchestrator] = lambda: mock_ai
    app.dependency_overrides[get_activity_service] = lambda: ActivityIdeationService(test_data_dir, mock_ai)
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()

def test_generate_success(client, test_data_dir):
    res = client.post("/api/activity-ideation/generate", json={"topic_id": "TOP-001", "requested_count": 2})
    assert res.status_code == 200
    data = res.json()
    assert data["generated_count"] == 2
    assert data["accepted_count"] == 2
    assert data["duplicate_count"] == 0
    assert data["rejected_count"] == 0
    assert len(data["concepts"]) == 2
    assert data["concepts"][0]["activity_title"] == "Concept 1"
    assert data["concepts"][0]["activity_name"] == "Concept 1"
    assert data["concepts"][0]["pre_activity"]["parents_note"]
    assert len(data["concepts"][0]["main_activity"]["in_depth_description_and_process"]) >= 3
    assert data["concepts"][0]["post_activity"]["post_activity_summary"]
    assert data["concepts"][0]["status"] == "TEMPORARY"
    assert data["session_id"]
    assert test_data_dir.read_sheet("ActivityConcepts") == []
    assert test_data_dir.read_sheet("Activities") == []


def test_template_schema_requires_parents_note_and_complete_sections():
    response = ai_template("Schema test")
    del response["pre_activity"]["parents_note"]
    with pytest.raises(ValidationError):
        AIActivityConcept.model_validate({**response, "activity_type": "Investigation"})


def test_generation_prompt_requires_ordered_octakidz_template(test_data_dir, mock_ai):
    service = ActivityIdeationService(test_data_dir, mock_ai)
    _, prompt = service._build_prompt(service._get_topic_context("TOP-001"), 2)
    assert prompt.index("pre_activity") < prompt.index("main_activity") < prompt.index("post_activity")
    assert "parents_note" in prompt
    assert "pre_activity_engagement" in prompt

def test_generate_non_selected_topic(client):
    res = client.post("/api/activity-ideation/generate", json={"topic_id": "TOP-002", "requested_count": 2})
    assert res.status_code == 409
    
def test_generate_topic_not_found(client):
    res = client.post("/api/activity-ideation/generate", json={"topic_id": "TOP-999", "requested_count": 2})
    assert res.status_code == 404

def test_approved_topics_are_available_and_drafts_are_excluded(client, test_data_dir):
    test_data_dir.update_record("Topics", "TOP-002", {"status": TopicStatus.APPROVED.value})
    response = client.get("/api/activity-ideation/topics")
    assert response.status_code == 200
    topic_ids = {topic["topic"]["topic_id"] for topic in response.json()["topics"]}
    assert topic_ids == {"TOP-001", "TOP-002"}

def test_generate_with_duplicates_and_invalid(client, mock_ai):
    # Mock AI returns duplicates and invalid types
    mock_ai.generate_structured.return_value = ActivityIdeationAIResponse(
        activities=[
            AIActivityConcept(
                **ai_template("Concept 1", "This is a concept description."),
                activity_type="Investigation",
                primary_skill="Observation",
                primary_sub_skill="Noticing details",
            ),
            AIActivityConcept(
                **ai_template("Concept 1", "This is a concept description."),
                activity_type="Investigation",
                primary_skill="Observation",
                primary_sub_skill="Noticing details",
            ), # Exact duplicate
            AIActivityConcept(
                **ai_template("Concept 3", "Awesome fun."),
                activity_type="UnknownType", # Invalid type
                primary_skill="Observation",
                primary_sub_skill="Noticing details",
            )
        ]
    )
    
    res = client.post("/api/activity-ideation/generate", json={"topic_id": "TOP-001", "requested_count": 3})
    assert res.status_code == 200
    data = res.json()
    assert data["generated_count"] == 3
    assert data["accepted_count"] == 1
    assert data["duplicate_count"] == 1
    assert data["rejected_count"] == 1
    
def test_select_concept(client, test_data_dir):
    # Setup DRAFT concept
    test_data_dir.append_record("ActivityConcepts", {
        "concept_id": "ACT-123",
        "topic_id": "TOP-001",
        "activity_title": "Test Activity",
        "activity_type_id": "AT1",
        "activity_concept": "Concept...",
        "learner_task": "Task...",
        "expected_output": "Output...",
        "primary_skill_id": "SK1",
        "primary_sub_skill_id": "SS1",
        "status": ActivityStatus.DRAFT.value,
        "created_at": "2026-01-01T00:00:00"
    })
    
    res = client.post("/api/activity-ideation/concepts/ACT-123/select")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == ActivityStatus.SELECTED.value
    
def test_select_concept_multiple_protection(client, test_data_dir):
    test_data_dir.append_record("ActivityConcepts", {
        "concept_id": "ACT-123",
        "topic_id": "TOP-001",
        "activity_title": "Test Activity",
        "activity_type_id": "AT1",
        "activity_concept": "Concept...",
        "learner_task": "Task...",
        "expected_output": "Output...",
        "primary_skill_id": "SK1",
        "primary_sub_skill_id": "SS1",
        "status": ActivityStatus.SELECTED.value,
        "created_at": "2026-01-01T00:00:00"
    })
    
    test_data_dir.append_record("ActivityConcepts", {
        "concept_id": "ACT-456",
        "topic_id": "TOP-001",
        "activity_title": "Test Activity 2",
        "activity_type_id": "AT1",
        "activity_concept": "Concept...",
        "learner_task": "Task...",
        "expected_output": "Output...",
        "primary_skill_id": "SK1",
        "primary_sub_skill_id": "SS1",
        "status": ActivityStatus.DRAFT.value,
        "created_at": "2026-01-01T00:00:00"
    })
    
    res = client.post("/api/activity-ideation/concepts/ACT-456/select")
    assert res.status_code == 400
    assert "already selected" in res.json()["detail"]

def test_approve_persists_activity_and_is_idempotent(client, test_data_dir):
    generated = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    ).json()
    concept = generated["concepts"][0]
    edited_post = {
        **concept["post_activity"],
        "post_activity_summary": "Edited final summary saved after explicit approval.",
    }
    concept = client.patch(
        f"/api/activity-ideation/sessions/{generated['session_id']}/concepts/{concept['concept_id']}",
        json={"post_activity": edited_post},
    ).json()
    path = f"/api/activity-ideation/sessions/{generated['session_id']}/concepts/{concept['concept_id']}/approve"

    first = client.post(path)
    second = client.post(path)

    assert first.status_code == second.status_code == 200
    assert first.json()["status"] == ActivityStatus.APPROVED.value
    activities = test_data_dir.read_sheet("Activities")
    assert len(activities) == 1
    assert activities[0]["topic_id"] == "TOP-001"
    assert activities[0]["title"] == concept["activity_title"]
    assert activities[0]["activity_name"] == concept["activity_name"]
    assert activities[0]["pre_activity"]["parents_note"] == concept["pre_activity"]["parents_note"]
    assert activities[0]["main_activity"]["in_depth_description_and_process"] == concept["main_activity"]["in_depth_description_and_process"]
    assert activities[0]["post_activity"]["post_activity_summary"] == edited_post["post_activity_summary"]
    assert activities[0]["status"] == ActivityStatus.APPROVED.value
    assert activities[0]["materials"] == ["paper", "pencils"]
    assert activities[0]["learning_objective"] == "Learners observe patterns in urban wildlife."
    assert activities[0]["instructions"].startswith("1. Choose a safe place for the concept 1 activity with an adult.")
    assert activities[0]["generation_id"] is None
    saved_concepts = test_data_dir.read_sheet("ActivityConcepts")
    assert len(saved_concepts) == 1
    assert saved_concepts[0]["status"] == ActivityStatus.APPROVED.value
    assert saved_concepts[0]["materials"] == ["paper", "pencils"]
    assert len(test_data_dir.read_sheet("ActivitySkills")) == 1
    library = client.get("/api/activities")
    assert library.status_code == 200
    assert len(library.json()) == 1
    assert library.json()[0]["activity"]["materials"] == ["paper", "pencils"]
    assert library.json()[0]["activity"]["pre_activity"]["parents_note"]
    assert library.json()[0]["activity"]["main_activity"]["reflection_questions"]
    assert library.json()[0]["activity"]["post_activity"]["extend_the_learning"]
    assert library.json()[0]["skills"][0]["skill_name"] == "Observation"
    detail = client.get(f"/api/activities/{activities[0]['activity_id']}")
    assert detail.status_code == 200
    assert detail.json()["activity"]["post_activity"]["post_activity_summary"] == edited_post["post_activity_summary"]

def test_edit_and_reject_temporary_concept_does_not_persist(client, test_data_dir):
    generated = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    ).json()
    concept = generated["concepts"][0]
    base = f"/api/activity-ideation/sessions/{generated['session_id']}/concepts/{concept['concept_id']}"

    revised_pre = {**concept["pre_activity"], "parents_note": "An adult should guide the outdoor observation."}
    revised_main = {
        **concept["main_activity"],
        "activity_step_task_title": "Build a wildlife clue map",
    }
    revised_post = {
        **concept["post_activity"],
        "whats_next": "Compare your map with a new observation tomorrow.",
    }
    edited = client.patch(base, json={
        "activity_name": "Revised Wildlife Explorer",
        "pre_activity": revised_pre,
        "main_activity": revised_main,
        "post_activity": revised_post,
    })
    rejected = client.post(f"{base}/reject")

    assert edited.status_code == 200
    assert edited.json()["activity_title"] == "Revised Wildlife Explorer"
    assert edited.json()["activity_name"] == "Revised Wildlife Explorer"
    assert edited.json()["pre_activity"]["parents_note"] == revised_pre["parents_note"]
    assert edited.json()["main_activity"]["activity_step_task_title"] == revised_main["activity_step_task_title"]
    assert edited.json()["post_activity"]["whats_next"] == revised_post["whats_next"]
    assert rejected.status_code == 200
    assert rejected.json()["status"] == ActivityStatus.REJECTED.value
    assert test_data_dir.read_sheet("Activities") == []
    assert test_data_dir.read_sheet("ActivityConcepts") == []

def test_regenerate_replaces_only_temporary_candidate(client, mock_ai, test_data_dir):
    initial = AIActivityConcept(
        **ai_template("Original Activity", "Observe wildlife near home."),
        activity_type="Investigation",
        primary_skill="Observation",
        primary_sub_skill="Noticing details",
    )
    regenerated_template = ai_template(
        "Habitat Corridor Map",
        "Use a large neighborhood map to connect separate green spaces with safe wildlife corridors.",
    )
    regenerated_template["main_activity"]["activity_step_task_title"] = "Draw connected green corridors on a neighborhood map"
    regenerated_template["post_activity"]["post_activity_summary"] = "A color-coded corridor map showing safe routes between animal habitats."
    regenerated = AIActivityConcept(
        **regenerated_template,
        activity_type="Investigation",
        primary_skill="Observation",
        primary_sub_skill="Noticing details",
    )
    mock_ai.generate_structured.side_effect = [
        ActivityIdeationAIResponse(activities=[initial]),
        ActivityIdeationAIResponse(activities=[regenerated]),
    ]
    generated = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    ).json()
    concept = generated["concepts"][0]
    response = client.post(
        f"/api/activity-ideation/sessions/{generated['session_id']}/concepts/{concept['concept_id']}/regenerate"
    )

    assert response.status_code == 200
    assert response.json()["concept_id"] == concept["concept_id"]
    assert response.json()["activity_title"] == "Habitat Corridor Map"
    assert test_data_dir.read_sheet("Activities") == []

def test_quota_failure_is_reported_and_saves_nothing(client, test_data_dir, mock_ai):
    mock_ai.generate_structured.side_effect = AIRetryExhaustedError("429 quota exceeded")
    response = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    )
    assert response.status_code == 429
    assert test_data_dir.read_sheet("Activities") == []

def test_malformed_structured_response_is_reported_and_saves_nothing(client, test_data_dir, mock_ai):
    mock_ai.generate_structured.side_effect = AIRetryExhaustedError(
        "Failed after 4 attempts. Last error: AI response is not valid JSON"
    )
    response = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    )
    assert response.status_code == 502
    assert test_data_dir.read_sheet("Activities") == []
    assert test_data_dir.read_sheet("ActivityConcepts") == []

def test_unsupported_topic_skill_mapping_is_rejected(client, mock_ai):
    mock_ai.generate_structured.return_value = ActivityIdeationAIResponse(
        activities=[
            AIActivityConcept(
                **ai_template("Unsupported skill activity", "Learners create an original habitat solution."),
                activity_type="Investigation",
                primary_skill="Creative thinking",
                primary_sub_skill="Designing solutions",
            )
        ]
    )
    response = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    )
    assert response.status_code == 200
    result = response.json()
    assert result["accepted_count"] == 0
    assert "not supported" in result["rejected_candidates"][0]["reason"]

def test_activity_generation_rejects_unapproved_topics(client, test_data_dir):
    test_data_dir.update_record("Topics", "TOP-001", {"status": TopicStatus.DRAFT.value})
    response = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    )
    assert response.status_code == 409
