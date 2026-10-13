import os
import tempfile
import pytest
import shutil
from datetime import datetime

from apps.api.repositories.excel import ExcelRepository
from apps.api.models.enums import TopicStatus

@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def repo(temp_data_dir):
    repo = ExcelRepository(temp_data_dir)
    repo.initialize_workbooks()
    
    # Seed master data needed for validation
    repo.append_record("TopicFamilies", {
        "topic_family_id": "tf-test",
        "name": "Test Family"
    })
    repo.append_record("Skills", {
        "skill_id": "sk-test",
        "intelligence_id": "int-test",
        "name": "Test Skill"
    })
    repo.append_record("SubSkills", {
        "sub_skill_id": "ssk-test",
        "skill_id": "sk-test",
        "name": "Test SubSkill"
    })
    repo.append_record("ActivityTypes", {
        "activity_type_id": "at-test",
        "name": "Test Type"
    })
    
    return repo

def test_workbook_and_sheet_creation(repo, temp_data_dir):
    master_path = os.path.join(temp_data_dir, "master", "Octa_Master.xlsx")
    assert os.path.exists(master_path)
    
    import pandas as pd
    xls = pd.ExcelFile(master_path)
    assert "TopicFamilies" in xls.sheet_names
    assert "Skills" in xls.sheet_names

def test_pydantic_validation_fails(repo):
    # Missing required field `topic_hook` is optional but `topic` is required.
    # Wait, let's omit `topic`
    with pytest.raises(ValueError, match="Validation error"):
        repo.append_record("Topics", {
            "topic_id": "t-1",
            "topic_family_id": "tf-test",
            # missing topic
            "age_min": 5,
            "age_max": 7,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "admin"
        })

def test_enum_validation_fails(repo):
    with pytest.raises(ValueError, match="Validation error"):
        repo.append_record("Topics", {
            "topic_id": "t-1",
            "topic": "Space",
            "topic_family_id": "tf-test",
            "age_min": 5,
            "age_max": 7,
            "status": "INVALID_STATUS", # Invalid enum
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "admin"
        })

def test_record_creation_and_retrieval(repo):
    dt = datetime.now()
    topic_data = {
        "topic_id": "t-1",
        "topic": "Space",
        "topic_family_id": "tf-test",
        "age_min": 5,
        "age_max": 7,
        "status": TopicStatus.DRAFT,
        "created_at": dt,
        "updated_at": dt,
        "created_by": "admin"
    }
    
    # Create
    repo.append_record("Topics", topic_data)
    
    # Retrieve
    records = repo.read_sheet("Topics")
    assert len(records) == 1
    assert records[0]["topic_id"] == "t-1"
    assert records[0]["topic"] == "Space"
    
def test_record_update(repo):
    dt = datetime.now()
    topic_data = {
        "topic_id": "t-1",
        "topic": "Space",
        "topic_family_id": "tf-test",
        "age_min": 5,
        "age_max": 7,
        "status": TopicStatus.DRAFT,
        "created_at": dt,
        "updated_at": dt,
        "created_by": "admin"
    }
    
    repo.append_record("Topics", topic_data)
    
    # Update
    repo.update_record("Topics", "t-1", {"topic": "Deep Space"})
    
    records = repo.read_sheet("Topics")
    assert records[0]["topic"] == "Deep Space"

def test_duplicate_id_detection(repo):
    dt = datetime.now()
    topic_data = {
        "topic_id": "t-1",
        "topic": "Space",
        "topic_family_id": "tf-test",
        "age_min": 5,
        "age_max": 7,
        "status": TopicStatus.DRAFT,
        "created_at": dt,
        "updated_at": dt,
        "created_by": "admin"
    }
    
    repo.append_record("Topics", topic_data)
    
    with pytest.raises(ValueError, match="already exists"):
        repo.append_record("Topics", topic_data)

def test_invalid_topic_family_reference(repo):
    dt = datetime.now()
    topic_data = {
        "topic_id": "t-1",
        "topic": "Space",
        "topic_family_id": "tf-invalid", # Does not exist
        "age_min": 5,
        "age_max": 7,
        "status": TopicStatus.DRAFT,
        "created_at": dt,
        "updated_at": dt,
        "created_by": "admin"
    }
    
    with pytest.raises(ValueError, match="topic_family_id tf-invalid does not exist"):
        repo.append_record("Topics", topic_data)

def test_invalid_skill_reference(repo):
    data = {
        "topic_id": "t-1",
        "skill_id": "sk-invalid",
        "sub_skill_id": "ssk-test",
    }
    with pytest.raises(ValueError, match="skill_id sk-invalid does not exist"):
        repo.append_record("TopicSkills", data)
        
def test_invalid_sub_skill_reference(repo):
    data = {
        "topic_id": "t-1",
        "skill_id": "sk-test",
        "sub_skill_id": "ssk-invalid",
    }
    with pytest.raises(ValueError, match="sub_skill_id ssk-invalid does not exist"):
        repo.append_record("TopicSkills", data)

def test_invalid_activity_type_reference(repo):
    dt = datetime.now()
    concept_data = {
        "concept_id": "c-1",
        "topic_id": "t-1",
        "activity_title": "Test Activity",
        "activity_type_id": "at-invalid", # Does not exist
        "activity_concept": "Concept",
        "learner_task": "Task",
        "expected_output": "Output",
        "primary_skill_id": "sk-test",
        "primary_sub_skill_id": "ssk-test",
        "created_at": dt
    }
    
    with pytest.raises(ValueError, match="activity_type_id at-invalid does not exist"):
        repo.append_record("ActivityConcepts", concept_data)

def test_atomic_activity_append_rolls_back_related_records(repo):
    dt = datetime.now()
    repo.append_record("Topics", {
        "topic_id": "t-atomic",
        "topic": "Local wildlife",
        "topic_family_id": "tf-test",
        "age_min": 6,
        "age_max": 9,
        "status": TopicStatus.APPROVED,
        "created_at": dt,
        "updated_at": dt,
        "created_by": "test",
    })
    activity = {
        "activity_id": "act-atomic",
        "concept_id": "con-atomic",
        "topic_id": "t-atomic",
        "title": "Wildlife journal",
        "description": "Observe wildlife and record evidence.",
        "instructions": "1. Observe safely.",
        "expected_output": "A journal",
        "age_min": 6,
        "age_max": 9,
        "estimated_duration": 25,
        "status": "APPROVED",
        "created_at": dt,
        "updated_at": dt,
        "materials": '["paper"]',
        "activity_type_id": "at-test",
    }
    concept = {
        "concept_id": "con-atomic",
        "topic_id": "t-atomic",
        "activity_title": "Wildlife journal",
        "activity_type_id": "at-test",
        "activity_concept": "Observe wildlife and record evidence.",
        "learner_task": "Observe animal signs from a safe distance.",
        "expected_output": "A wildlife observation journal.",
        "primary_skill_id": "sk-test",
        "primary_sub_skill_id": "ssk-test",
        "status": "APPROVED",
        "created_at": dt,
    }

    with pytest.raises(ValueError, match="sub_skill_id ssk-invalid does not exist"):
        repo.append_records_atomic([
            ("ActivityConcepts", concept),
            ("Activities", activity),
            ("ActivitySkills", {
                "activity_id": "act-atomic",
                "skill_id": "sk-test",
                "sub_skill_id": "ssk-invalid",
            }),
        ])

    assert repo.read_sheet("Activities") == []
    assert repo.read_sheet("ActivityConcepts") == []
    assert repo.read_sheet("ActivitySkills") == []

def test_atomic_activity_append_preserves_structured_materials(repo):
    dt = datetime.now()
    repo.append_record("Topics", {
        "topic_id": "t-atomic",
        "topic": "Local wildlife",
        "topic_family_id": "tf-test",
        "age_min": 6,
        "age_max": 9,
        "status": TopicStatus.APPROVED,
        "created_at": dt,
        "updated_at": dt,
        "created_by": "test",
    })
    repo.append_records_atomic([
        ("ActivityConcepts", {
            "concept_id": "con-atomic",
            "topic_id": "t-atomic",
            "activity_title": "Wildlife journal",
            "activity_type_id": "at-test",
            "activity_concept": "Observe wildlife and record evidence.",
            "learner_task": "Observe animal signs from a safe distance.",
            "expected_output": "A wildlife observation journal.",
            "primary_skill_id": "sk-test",
            "primary_sub_skill_id": "ssk-test",
            "status": "APPROVED",
            "created_at": dt,
        }),
        ("Activities", {
        "activity_id": "act-atomic",
        "concept_id": "con-atomic",
        "topic_id": "t-atomic",
        "title": "Wildlife journal",
        "description": "Observe wildlife and record evidence.",
        "instructions": "1. Observe safely.",
        "expected_output": "A journal",
        "age_min": 6,
        "age_max": 9,
        "estimated_duration": 25,
        "status": "APPROVED",
        "created_at": dt,
        "updated_at": dt,
        "materials": '["paper", "pencils"]',
        "activity_type_id": "at-test",
    })])

    assert repo.read_sheet("Activities")[0]["materials"] == ["paper", "pencils"]


def test_template_sections_round_trip_without_losing_legacy_activities(repo):
    dt = datetime.now()
    repo.append_record("Topics", {
        "topic_id": "t-template",
        "topic": "Local wildlife",
        "topic_family_id": "tf-test",
        "age_min": 6,
        "age_max": 9,
        "status": TopicStatus.APPROVED,
        "created_at": dt,
        "updated_at": dt,
        "created_by": "test",
    })
    repo.append_records_atomic([
        ("ActivityConcepts", {
            "concept_id": "con-legacy",
            "topic_id": "t-template",
            "activity_title": "Legacy activity",
            "activity_type_id": "at-test",
            "activity_concept": "Legacy activity description.",
            "learner_task": "Observe the local environment.",
            "expected_output": "A short observation note.",
            "status": "APPROVED",
            "created_at": dt,
        }),
        ("Activities", {
            "activity_id": "act-legacy",
            "concept_id": "con-legacy",
            "topic_id": "t-template",
            "title": "Legacy activity",
            "description": "Legacy activity description.",
            "instructions": "1. Observe carefully.",
            "expected_output": "A short observation note.",
            "age_min": 6,
            "age_max": 9,
            "estimated_duration": 20,
            "status": "APPROVED",
            "created_at": dt,
            "updated_at": dt,
        }),
    ])
    sections = {
        "pre_activity": {
            "activity_description": "Prepare to explore local habitats.",
            "parents_note": "An adult should supervise the outdoor observation.",
            "parents_guide": "Stay with the child and avoid disturbing wildlife.",
            "pre_activity_engagement": ["What clues might animals leave behind?"],
            "why_how_is_this_important": "Observation helps children identify patterns.",
            "lets_get_started": "Take your notebook to a safe observation spot.",
        },
        "main_activity": {
            "activity_step_task_title": "Map a nearby habitat",
            "scenario_real_life_connection": "Scientists map habitats to understand animal needs.",
            "in_depth_description_and_process": [
                "Choose a safe location with an adult.",
                "Record three habitat clues.",
                "Explain which animal might use this habitat.",
            ],
            "reflection_questions": ["Which clue was most useful?", "How can we protect this habitat?"],
        },
        "post_activity": {
            "whats_next": "Share your habitat map with a family member.",
            "extend_the_learning": ["Compare the map with another habitat."],
            "how_to_improvise_or_level_up": "Work with a partner to compare two habitats.",
            "post_activity_summary": "The learner used clues to describe a habitat.",
        },
    }
    repo.append_records_atomic([
        ("ActivityConcepts", {
            "concept_id": "con-template",
            "topic_id": "t-template",
            "activity_title": "Habitat mapper",
            "activity_type_id": "at-test",
            "activity_concept": sections["pre_activity"]["activity_description"],
            "learner_task": sections["main_activity"]["activity_step_task_title"],
            "expected_output": sections["post_activity"]["post_activity_summary"],
            "status": "APPROVED",
            "created_at": dt,
            **sections,
        }),
        ("Activities", {
            "activity_id": "act-template",
            "concept_id": "con-template",
            "topic_id": "t-template",
            "title": "Habitat mapper",
            "description": sections["pre_activity"]["activity_description"],
            "instructions": "1. Choose a safe location.\n2. Record habitat clues.\n3. Explain the clues.",
            "expected_output": sections["post_activity"]["post_activity_summary"],
            "age_min": 6,
            "age_max": 9,
            "estimated_duration": 25,
            "status": "APPROVED",
            "created_at": dt,
            "updated_at": dt,
            "activity_name": "Habitat mapper",
            "activity_duration": "25 minutes",
            **sections,
        }),
    ])

    activities = repo.read_sheet("Activities")
    legacy = next(activity for activity in activities if activity["activity_id"] == "act-legacy")
    saved = next(activity for activity in activities if activity["activity_id"] == "act-template")
    assert legacy["description"] == "Legacy activity description."
    assert legacy["pre_activity"] is None
    assert saved["pre_activity"]["parents_note"] == sections["pre_activity"]["parents_note"]
    assert saved["main_activity"]["reflection_questions"] == sections["main_activity"]["reflection_questions"]
    assert saved["post_activity"]["extend_the_learning"] == sections["post_activity"]["extend_the_learning"]
