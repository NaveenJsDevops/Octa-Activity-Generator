import pytest
import os
import tempfile
import uuid
import json
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from pydantic import ValidationError

from apps.api.main import app
from apps.api.routers.activity_ideation import get_repository, get_ai_orchestrator, get_ideation_service
from apps.api.routers.activities import get_activity_service
from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.activity_ideation.service import ActivityIdeationService
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.services.ai.exceptions import AIRetryExhaustedError
from apps.api.models.domain import TopicStatus, ActivityStatus, PreActivity, MainActivity, PostActivity
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


# --- REPOSITORY SETUP ---
@pytest.fixture
def test_data_dir():
    with tempfile.TemporaryDirectory() as temp_dir:
        repo = FirestoreRepository(temp_dir)
        repo.initialize_database()
        
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
    app.dependency_overrides[get_repository] = lambda: test_data_dir
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

def test_regenerate_concept_section_pre_activity(client, mock_ai, test_data_dir):
    initial = AIActivityConcept(
        **ai_template("Original Activity", "Observe wildlife near home."),
        activity_type="Investigation",
        primary_skill="Observation",
        primary_sub_skill="Noticing details",
    )
    new_pre = PreActivity(
        activity_description="A brand new regenerated pre-activity description.",
        parents_note="Special adult supervision note.",
        parents_guide="Step-by-step adult guide.",
        pre_activity_engagement=["Warm-up prompt 1", "Warm-up prompt 2"],
        why_how_is_this_important="Explaining why this section matters.",
        lets_get_started="Ready, set, go!"
    )
    mock_ai.generate_structured.side_effect = [
        ActivityIdeationAIResponse(activities=[initial]),
        new_pre,
    ]
    generated = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    ).json()
    concept = generated["concepts"][0]

    response = client.post(
        f"/api/activity-ideation/sessions/{generated['session_id']}/concepts/{concept['concept_id']}/regenerate-section",
        json={"section": "pre_activity"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["concept_id"] == concept["concept_id"]
    # Pre-activity is updated
    assert data["pre_activity"]["activity_description"] == "A brand new regenerated pre-activity description."
    assert data["pre_activity"]["parents_note"] == "Special adult supervision note."
    assert data["activity_concept"] == "A brand new regenerated pre-activity description."
    # Main activity and Post activity remain unchanged!
    assert data["main_activity"]["activity_step_task_title"] == concept["main_activity"]["activity_step_task_title"]
    assert data["post_activity"]["whats_next"] == concept["post_activity"]["whats_next"]

def test_regenerate_concept_section_main_activity(client, mock_ai, test_data_dir):
    initial = AIActivityConcept(
        **ai_template("Original Activity", "Observe wildlife near home."),
        activity_type="Investigation",
        primary_skill="Observation",
        primary_sub_skill="Noticing details",
    )
    new_main = MainActivity(
        activity_step_task_title="Brand new core task title",
        scenario_real_life_connection="Real world connection context.",
        in_depth_description_and_process=["Step 1: Do this", "Step 2: Do that", "Step 3: Analyze"],
        reflection_questions=["Question 1?", "Question 2?"]
    )
    mock_ai.generate_structured.side_effect = [
        ActivityIdeationAIResponse(activities=[initial]),
        new_main,
    ]
    generated = client.post(
        "/api/activity-ideation/generate",
        json={"topic_id": "TOP-001", "requested_count": 1},
    ).json()
    concept = generated["concepts"][0]

    response = client.post(
        f"/api/activity-ideation/sessions/{generated['session_id']}/concepts/{concept['concept_id']}/regenerate-section",
        json={"section": "main_activity"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["main_activity"]["activity_step_task_title"] == "Brand new core task title"
    assert data["learner_task"] == "Brand new core task title"
    # Pre-activity and post-activity remain unchanged!
    assert data["pre_activity"]["activity_description"] == concept["pre_activity"]["activity_description"]
    assert data["post_activity"]["whats_next"] == concept["post_activity"]["whats_next"]


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

def test_export_activity_excel_post(client):
    payload = {
        "activity_name": "Bird Feeder Craft",
        "activity_duration": "30 minutes",
        "topic_title": "Local Birds and Habitats",
        "topic_family_name": "Nature & Environment",
        "age_min": 7,
        "age_max": 9,
        "target_class": "Grade 3",
        "country_context": "India",
        "keywords": ["birds", "craft", "nature"],
        "user_selected_intelligence": "Environmental",
        "user_selected_skills": ["Observation"],
        "user_selected_sub_skills": ["Ecosystems"],
        "suggested_intelligence": "Creative",
        "suggested_skills": ["Designing solutions"],
        "suggested_sub_skills": ["Model building"],
        "pre_activity": {
            "activity_description": "Build a recycled bird feeder to observe garden birds.",
            "parents_note": "Assist with cutting materials safely.",
            "parents_guide": None,
            "pre_activity_engagement": ["What birds have you seen nearby?"],
            "why_how_is_this_important": "Encourages empathy and biodiversity appreciation.",
            "lets_get_started": "Collect clean plastic containers and bird seeds."
        },
        "main_activity": {
            "activity_step_task_title": "Build and hang the feeder",
            "scenario_real_life_connection": "Urban ornithologists monitor bird populations using feeders.",
            "in_depth_description_and_process": [
                "Cut small feeding holes in the container with an adult.",
                "Insert wooden spoons as perches.",
                "Fill with seeds and hang near a window."
            ],
            "reflection_questions": [
                "Which birds visited first?",
                "How does weather affect feeding times?"
            ]
        },
        "post_activity": {
            "whats_next": "Keep a 7-day bird visitor log.",
            "extend_the_learning": ["Try different types of bird feed."],
            "how_to_improvise_or_level_up": "Design a squirrel-proof roof.",
            "post_activity_summary": "A student-built bird feeder and 7-day field observation journal."
        },
        "learning_objective": "Understand local bird diets and nesting habits.",
        "materials": ["Plastic bottle", "Wooden spoons", "Twine", "Bird seed"],
        "assessment_criteria": "Active observation and recorded notes.",
        "difficulty_level": "Beginner"
    }
    response = client.post("/api/activities/export/excel", json=payload)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment" in response.headers["content-disposition"]
    assert len(response.content) > 1000

def test_export_activity_excel_get(client, test_data_dir):
    # Setup concept and approved activity
    now = "2026-11-23T10:00:00"
    test_data_dir.append_record("ActivityConcepts", {
        "concept_id": "CON-1",
        "topic_id": "TOP-001",
        "activity_title": "Solar Oven S'mores",
        "activity_type_id": "AT1",
        "activity_concept": "Harness sunlight using a cardboard box.",
        "learner_task": "Construct solar cooker",
        "expected_output": "Solar-baked snack and temperature record",
        "status": "APPROVED",
        "created_at": now,
    })
    test_data_dir.append_record("Activities", {
        "activity_id": "ACT-EXPORT-1",
        "concept_id": "CON-1",
        "topic_id": "TOP-001",
        "title": "Solar Oven S'mores",
        "description": "Harness sunlight using a cardboard box.",
        "instructions": "1. Line box with foil\n2. Place marshmallows inside\n3. Angle towards sun",
        "expected_output": "Solar-baked snack and temperature record",
        "age_min": 8,
        "age_max": 10,
        "estimated_duration": 40,
        "status": "APPROVED",
        "created_at": now,
        "updated_at": now,
        "activity_name": "Solar Oven S'mores",
        "activity_duration": "40 minutes",
        "pre_activity": {
            "activity_description": "Harness sunlight using a cardboard box.",
            "parents_note": "Supervise sun exposure.",
            "parents_guide": None,
            "pre_activity_engagement": ["How hot does black paper get in the sun?"],
            "why_how_is_this_important": "Demonstrates renewable solar thermal energy.",
            "lets_get_started": "Gather a pizza box and aluminum foil."
        },
        "main_activity": {
            "activity_step_task_title": "Construct solar cooker",
            "scenario_real_life_connection": "Clean cookstoves in rural communities.",
            "in_depth_description_and_process": [
                "Line the pizza box flap with foil.",
                "Cover the opening with plastic wrap.",
                "Position facing direct sunlight."
            ],
            "reflection_questions": [
                "How long did it take to melt?",
                "What made the temperature rise?"
            ]
        },
        "post_activity": {
            "whats_next": "Test with different colored containers.",
            "extend_the_learning": ["Calculate thermal efficiency."],
            "how_to_improvise_or_level_up": "Add a reflector mirror.",
            "post_activity_summary": "Cooked food using 100% solar energy."
        }
    })

    response = client.get("/api/activities/ACT-EXPORT-1/export/excel")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment" in response.headers["content-disposition"]
    assert len(response.content) > 1000

def test_batch_export_excel(client):
    activities = [
        {
            "activity_id": "ACT-BATCH-1",
            "title": "Stargazing Compass",
            "activity_duration": "25 minutes",
            "topic_title": "Space & Stars",
            "topic_family_name": "Space Exploration",
            "age_min": 7,
            "age_max": 9,
            "target_class": "Grade 3",
            "country_context": "India",
            "user_selected_intelligence": "Environmental",
            "user_selected_skills": ["Observation"],
            "pre_activity": {
                "activity_description": "Locate the North Star using a homemade compass.",
                "parents_note": "Outdoor night assistance.",
                "parents_guide": None,
                "pre_activity_engagement": ["Which direction does Polaris point?"],
                "why_how_is_this_important": "Ancient navigation science.",
                "lets_get_started": "Step outside under a clear sky."
            },
            "main_activity": {
                "activity_step_task_title": "Track stellar movement",
                "scenario_real_life_connection": "Ancient mariners navigations.",
                "in_depth_description_and_process": [
                    "Locate Ursa Major constellation.",
                    "Trace the pointer stars to Polaris.",
                    "Record hourly position changes."
                ],
                "reflection_questions": [
                    "Why does Polaris stay stationary?",
                    "How does Earth's rotation affect other constellations?"
                ]
            },
            "post_activity": {
                "whats_next": "Build a star map.",
                "extend_the_learning": ["Track constellations across seasons."],
                "how_to_improvise_or_level_up": "Use binoculars for nebulae.",
                "post_activity_summary": "Learned stellar alignment and celestial navigation."
            }
        },
        {
            "activity_id": "ACT-BATCH-2",
            "title": "Seed Germination Lab",
            "activity_duration": "30 minutes",
            "topic_title": "Botany Basics",
            "topic_family_name": "Nature & Environment",
            "age_min": 6,
            "age_max": 8,
            "target_class": "Grade 2",
            "country_context": "India",
            "user_selected_intelligence": "Cognitive",
            "user_selected_skills": ["Data Recording"],
            "pre_activity": {
                "activity_description": "Sprout seeds in cotton to observe root emergence.",
                "parents_note": "Provide seeds and damp paper towels.",
                "parents_guide": None,
                "pre_activity_engagement": ["What does a seed need to wake up?"],
                "why_how_is_this_important": "Plant biology fundamentals.",
                "lets_get_started": "Dampen paper towel and place bean seeds."
            },
            "main_activity": {
                "activity_step_task_title": "Measure root growth daily",
                "scenario_real_life_connection": "Farming and food production.",
                "in_depth_description_and_process": [
                    "Place damp paper in clear zip bag.",
                    "Tape to sunny window.",
                    "Measure radicle length with ruler daily."
                ],
                "reflection_questions": [
                    "Did roots grow upwards or downwards?",
                    "Why do roots seek gravity?"
                ]
            },
            "post_activity": {
                "whats_next": "Transplant into potting soil.",
                "extend_the_learning": ["Compare seeds in dark vs sunlight."],
                "how_to_improvise_or_level_up": "Add colored water.",
                "post_activity_summary": "Documented seed germination and gravitropism."
            }
        }
    ]

    response = client.post("/api/activities/export/excel/batch", json={"activities": activities})
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    assert "attachment" in response.headers["content-disposition"]
    assert "Batch_2_Items.xlsx" in response.headers["content-disposition"]
    assert len(response.content) > 2000

    # Test empty payload returns 400
    empty_resp = client.post("/api/activities/export/excel/batch", json={"activities": []})
    assert empty_resp.status_code == 400

def test_batch_export_limit_exceeded(client):
    # Test that > 50 activities returns HTTP 400
    oversized = [{"activity_name": f"Activity {i}"} for i in range(51)]
    resp = client.post("/api/activities/export/excel/batch", json={"activities": oversized})
    assert resp.status_code == 400
    assert "limit exceeded" in resp.json()["detail"].lower()

def test_export_customization_options(client):
    # Test export with options excluding parent guidance and educational metadata
    payload = {
        "activity_name": "Wind Vane Engineering",
        "description": "Construct a working wind direction indicator.",
        "pre_activity": {
            "activity_description": "Build a wind vane.",
            "parents_note": "Assist with cutting.",
            "parents_guide": "Stay close.",
            "pre_activity_engagement": ["Which way is the wind blowing?"],
            "why_how_is_this_important": "Meteorology fundamentals.",
            "lets_get_started": "Gather materials."
        },
        "main_activity": {
            "activity_step_task_title": "Assemble the vane",
            "scenario_real_life_connection": "Airport wind socks.",
            "in_depth_description_and_process": ["Pin straw to pencil eraser."],
            "reflection_questions": ["Did it turn freely?"]
        },
        "post_activity": {
            "whats_next": "Test outdoors.",
            "extend_the_learning": ["Calibrate with a compass."],
            "how_to_improvise_or_level_up": "Use heavier cardstock.",
            "post_activity_summary": "Built an outdoor wind vane."
        },
        "learning_objective": "Understand aerodynamic drag.",
        "options": {
            "include_parent_guidance": False,
            "include_educational_metadata": False,
            "include_carried_forward_mappings": False,
        }
    }
    resp = client.post("/api/activities/export/excel", json=payload)
    assert resp.status_code == 200
    assert len(resp.content) > 1000

    import openpyxl
    import io
    wb = openpyxl.load_workbook(io.BytesIO(resp.content))
    sheet = wb.active
    cell_values = [sheet.cell(row=r, column=1).value for r in range(1, sheet.max_row + 1)]
    # Parent guidance and educational metadata should be omitted
    assert "PARENT'S NOTE" not in [str(v).upper() for v in cell_values]
    assert "6. EDUCATIONAL METADATA & RESOURCES" not in cell_values

def test_legacy_activity_export(client):
    # Test that legacy activities with only flat title/instructions/expected_output export cleanly
    legacy_payload = {
        "title": "Legacy Cloud Identification",
        "description": "Observe and record cloud types.",
        "instructions": "1. Look out the window.\n2. Compare shapes to cloud chart.\n3. Note cumulus vs stratus.",
        "expected_output": "Completed cloud observation log",
        "age_min": 7,
        "age_max": 9,
        "estimated_duration": 20,
    }
    resp = client.post("/api/activities/export/excel", json=legacy_payload)
    assert resp.status_code == 200
    assert len(resp.content) > 1000

def test_review_session_store_ttl_and_capacity():
    from datetime import datetime, timedelta
    from apps.api.services.activity_ideation.review_session_store import ActivityReviewSessionStore, MAX_SESSIONS

    # 1. Test creation
    session = ActivityReviewSessionStore.create("TOP-TEST", {
        "concepts": [],
        "generated_count": 0,
        "duplicate_count": 0,
        "rejected_count": 0,
        "rejected_candidates": [],
    })
    assert ActivityReviewSessionStore.get(session.session_id) is not None

    # 2. Test TTL expiration
    session.created_at = datetime.now() - timedelta(hours=25)
    # On next get or create, it should be pruned
    pruned = ActivityReviewSessionStore.get(session.session_id)
    assert pruned is None

    # 3. Test capacity pruning (cannot exceed MAX_SESSIONS)
    created_sessions = []
    for i in range(MAX_SESSIONS + 15):
        s = ActivityReviewSessionStore.create(f"TOP-{i}", {
            "concepts": [],
            "generated_count": 0,
            "duplicate_count": 0,
            "rejected_count": 0,
            "rejected_candidates": [],
        })
        created_sessions.append(s.session_id)

    assert len(ActivityReviewSessionStore._sessions) <= MAX_SESSIONS



