import json
import pytest
from datetime import datetime
from apps.api.models.domain import Topic, TopicStatus, Activity, ActivityStatus, ActivityPotential
from apps.api.models.topic_review import TopicEditRequest
from apps.api.models.activity_ideation import ActivityEditRequest
from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.topic_review.service import TopicReviewService
from apps.api.services.activity_ideation.service import ActivityIdeationService
from apps.api.services.ai.orchestrator import AIOrchestrator


@pytest.fixture
def repo(tmp_path):
    repo = FirestoreRepository(str(tmp_path))
    repo.initialize_database()
    repo.append_record("TopicFamilies", {"topic_family_id": "FAM-HUMAN", "name": "Human & Society"})
    repo.append_record("ActivityTypes", {"activity_type_id": "ACT-TYPE-CORE", "name": "Core Task"})
    return repo


def test_topic_versioning_edit_and_restore(repo):
    service = TopicReviewService(repo)
    topic_id = "TOP-TEST-VER-01"

    # Seed initial topic
    repo.append_record(
        "Topics",
        {
            "topic_id": topic_id,
            "topic": "Original Topic Title",
            "short_description": "Original description",
            "full_description": "Original full description",
            "topic_family_id": "FAM-HUMAN",
            "age_min": 10,
            "age_max": 12,
            "target_class": "Grade 6",
            "country_context": "India",
            "activity_potential": "HIGH",
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        },
    )

    # 1. Fetch versions when none exist -> should create baseline v1
    v_list = service.get_topic_versions(topic_id)
    assert len(v_list) == 1
    assert v_list[0]["version_number"] == 1
    assert "baseline" in v_list[0]["change_summary"].lower()

    # 2. Edit topic -> should create v2
    req = TopicEditRequest(
        topic="Updated Topic Title",
        age_min=11,
        age_max=13,
        target_class="Grade 7",
    )
    success, msg = service.edit_topic(topic_id, req)
    assert success is True

    # Check updated topic
    detail = service.get_topic_detail(topic_id)
    assert detail["topic"].topic == "Updated Topic Title"
    assert detail["topic"].target_class == "Grade 7"

    # Check versions list -> should have 2 versions
    v_list2 = service.get_topic_versions(topic_id)
    assert len(v_list2) == 2
    assert v_list2[0]["version_number"] == 2
    assert v_list2[1]["version_number"] == 1

    # Check diffs in v2
    diff_fields = [d["field"] for d in v_list2[0]["changes"]]
    assert "topic" in diff_fields
    assert "target_class" in diff_fields

    # 3. Restore to v1
    v1_id = v_list2[1]["version_id"]
    success_res, res_msg = service.restore_topic_version(topic_id, v1_id)
    assert success_res is True

    # Topic should have reverted to original
    restored_detail = service.get_topic_detail(topic_id)
    assert restored_detail["topic"].topic == "Original Topic Title"
    assert restored_detail["topic"].target_class == "Grade 6"

    # Should now have v3 documenting restore
    v_list3 = service.get_topic_versions(topic_id)
    assert len(v_list3) == 3
    assert v_list3[0]["version_number"] == 3


def test_topic_deletion(repo):
    service = TopicReviewService(repo)
    topic_id = "TOP-TEST-DEL-01"

    repo.append_record(
        "Topics",
        {
            "topic_id": topic_id,
            "topic": "Topic To Delete",
            "short_description": "To be removed",
            "full_description": "To be removed",
            "topic_family_id": "FAM-HUMAN",
            "age_min": 10,
            "age_max": 12,
            "target_class": "Grade 6",
            "country_context": "India",
            "activity_potential": "HIGH",
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        },
    )
    repo.append_record("TopicKeywords", {"topic_id": topic_id, "keyword": "delete_me"})

    # Delete
    success, msg = service.delete_topic(topic_id)
    assert success is True

    # Verify absence
    detail = service.get_topic_detail(topic_id)
    assert detail is None
    kw_records = [k for k in repo.read_sheet("TopicKeywords") if k.get("topic_id") == topic_id]
    assert len(kw_records) == 0


def test_activity_versioning_edit_and_restore(repo):
    ai_orch = AIOrchestrator(repo)
    service = ActivityIdeationService(repo, ai_orch)
    act_id = "ACT-TEST-VER-01"
    concept_id = "CON-TEST-VER-01"
    topic_id = "TOP-TEST-FOR-ACT"

    # Seed parent topic
    repo.append_record(
        "Topics",
        {
            "topic_id": topic_id,
            "topic": "Topic For Activity",
            "short_description": "Topic desc",
            "full_description": "Topic full desc",
            "topic_family_id": "FAM-HUMAN",
            "age_min": 10,
            "age_max": 12,
            "target_class": "Grade 6",
            "country_context": "India",
            "activity_potential": "HIGH",
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        },
    )

    # Seed concept
    repo.append_record(
        "ActivityConcepts",
        {
            "concept_id": concept_id,
            "topic_id": topic_id,
            "activity_title": "Original Activity Title",
            "activity_type_id": "ACT-TYPE-CORE",
            "activity_concept": "Concept text",
            "learner_task": "Task",
            "expected_output": "Output",
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": datetime.now(),
        },
    )

    # Seed activity
    now = datetime.now()
    repo.append_record(
        "Activities",
        {
            "activity_id": act_id,
            "concept_id": concept_id,
            "topic_id": topic_id,
            "title": "Original Activity Title",
            "description": "Original description",
            "instructions": "1. Step one\n2. Step two",
            "expected_output": "Original expected output",
            "age_min": 10,
            "age_max": 12,
            "estimated_duration": 30,
            "activity_name": "Original Activity Title",
            "activity_duration": "30 minutes",
            "target_class": "Grade 6",
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": now,
            "updated_at": now,
        },
    )

    # 1. Fetch versions -> creates baseline v1
    v_list = service.get_activity_versions(act_id)
    assert len(v_list) == 1
    assert v_list[0]["version_number"] == 1

    # 2. Edit activity -> creates v2
    req = ActivityEditRequest(
        activity_name="Updated Activity Name",
        estimated_duration=45,
        activity_duration="45 minutes",
        target_class="Grade 8",
    )
    updated = service.edit_activity(act_id, req)
    assert updated["activity"]["title"] == "Updated Activity Name"
    assert updated["activity"]["estimated_duration"] == 45

    # Check versions
    v_list2 = service.get_activity_versions(act_id)
    assert len(v_list2) == 2
    assert v_list2[0]["version_number"] == 2
    assert v_list2[1]["version_number"] == 1

    # 3. Restore to v1
    v1_id = v_list2[1]["version_id"]
    restored = service.restore_activity_version(act_id, v1_id)
    assert restored["activity"]["title"] == "Original Activity Title"
    assert restored["activity"]["estimated_duration"] == 30

    # Check v3
    v_list3 = service.get_activity_versions(act_id)
    assert len(v_list3) == 3


def test_activity_deletion(repo):
    ai_orch = AIOrchestrator(repo)
    service = ActivityIdeationService(repo, ai_orch)
    act_id = "ACT-TEST-DEL-01"
    concept_id = "CON-TEST-DEL-01"
    topic_id = "TOP-TEST-DEL-ACT"

    # Seed
    repo.append_record(
        "Topics",
        {
            "topic_id": topic_id,
            "topic": "Topic For Del Activity",
            "short_description": "Desc",
            "full_description": "Full desc",
            "topic_family_id": "FAM-HUMAN",
            "age_min": 10,
            "age_max": 12,
            "target_class": "Grade 6",
            "country_context": "India",
            "activity_potential": "HIGH",
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        },
    )
    repo.append_record(
        "ActivityConcepts",
        {
            "concept_id": concept_id,
            "topic_id": topic_id,
            "activity_title": "Activity To Delete",
            "activity_type_id": "ACT-TYPE-CORE",
            "activity_concept": "Concept",
            "learner_task": "Task",
            "expected_output": "Output",
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": datetime.now(),
        },
    )
    repo.append_record(
        "Activities",
        {
            "activity_id": act_id,
            "concept_id": concept_id,
            "topic_id": topic_id,
            "title": "Activity To Delete",
            "description": "Desc",
            "instructions": "1. Step",
            "expected_output": "Output",
            "age_min": 10,
            "age_max": 12,
            "estimated_duration": 30,
            "status": "APPROVED",
            "created_by": "ai",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
        },
    )

    # Delete
    res = service.delete_activity(act_id)
    assert res is True

    # Verify
    with pytest.raises(Exception):
        service.get_activity(act_id)
