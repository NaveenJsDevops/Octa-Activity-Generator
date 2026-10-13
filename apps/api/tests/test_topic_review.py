import pytest
import os
import tempfile
import shutil
from datetime import datetime
from fastapi.testclient import TestClient

# Set up temp dir and app
temp_data_dir = tempfile.mkdtemp()
os.environ["DATA_DIR"] = temp_data_dir

from apps.api.main import app
from apps.api.repositories.excel import ExcelRepository
from apps.api.routers.topic_review import get_topic_review_service
from apps.api.services.topic_review.service import TopicReviewService

@pytest.fixture(scope="module")
def client():
    # Setup test data
    repo = ExcelRepository(temp_data_dir)
    repo.initialize_workbooks()
    
    # Add dummy master data
    repo.append_record("Intelligences", {"intelligence_id": "INT-1", "name": "Visual-Spatial"})
    repo.append_record("TopicFamilies", {"topic_family_id": "TF-1", "name": "Nature"})
    repo.append_record("Skills", {"skill_id": "SK-1", "intelligence_id": "INT-1", "name": "Observation"})
    repo.append_record("SubSkills", {"sub_skill_id": "SS-1", "skill_id": "SK-1", "name": "Visual"})
    
    # Add dummy topics
    repo.append_record("Topics", {
        "topic_id": "TOP-1", "topic": "Bugs", "short_description": "Look at bugs!", 
        "topic_family_id": "TF-1", "age_min": 5, "age_max": 7, 
        "status": "DRAFT", "created_at": datetime.now(), "updated_at": datetime.now(), "created_by": "ai"
    })
    repo.append_record("Topics", {
        "topic_id": "TOP-2", "topic": "Plants", "short_description": "Look at plants!", 
        "topic_family_id": "TF-1", "age_min": 5, "age_max": 7, 
        "status": "APPROVED", "created_at": datetime.now(), "updated_at": datetime.now(), "created_by": "ai"
    })
    
    # Add relations
    repo.append_record("TopicSkills", {"topic_id": "TOP-1", "skill_id": "SK-1", "sub_skill_id": "SS-1", "relationship_type": "PRIMARY"})
    
    with TestClient(app) as c:
        app.dependency_overrides[get_topic_review_service] = lambda: TopicReviewService(repo)
        yield c
        app.dependency_overrides.clear()
        
    shutil.rmtree(temp_data_dir)

def test_list_topics(client):
    res = client.get("/api/topics")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 2
    assert len(data["topics"]) == 2
    
def test_list_topics_filter(client):
    res = client.get("/api/topics?status=APPROVED")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["topics"][0]["topic"]["topic_id"] == "TOP-2"

def test_get_topic_detail(client):
    res = client.get("/api/topics/TOP-1")
    assert res.status_code == 200
    data = res.json()
    assert data["topic"]["topic_id"] == "TOP-1"
    assert data["topic_family_name"] == "Nature"
    assert data["skills"][0]["skill_name"] == "Observation"

def test_edit_topic(client):
    res = client.patch("/api/topics/TOP-1", json={"topic": "Cool Bugs"})
    assert res.status_code == 200
    
    res2 = client.get("/api/topics/TOP-1")
    assert res2.json()["topic"]["topic"] == "Cool Bugs"

def test_state_transitions(client):
    # DRAFT -> REVIEW
    res = client.post("/api/topics/TOP-1/review")
    assert res.status_code == 200
    assert res.json()["new_status"] == "REVIEW"
    
    # REVIEW -> APPROVED
    res2 = client.post("/api/topics/TOP-1/approve")
    assert res2.status_code == 200
    assert res2.json()["new_status"] == "APPROVED"
    
    # APPROVED -> SELECTED
    res3 = client.post("/api/topics/action/select", json={"topic_ids": ["TOP-1"]})
    assert res3.status_code == 200
    assert res3.json()["selected_count"] == 1
    
    # SELECTED -> UNSELECTED
    res4 = client.post("/api/topics/TOP-1/unselect")
    assert res4.status_code == 200
    assert res4.json()["new_status"] == "APPROVED"


def test_draft_topic_can_be_approved_directly_and_used_for_activity_generation(client):
    repo = ExcelRepository(temp_data_dir)
    repo.append_record("Topics", {
        "topic_id": "TOP-DRAFT-APPROVAL",
        "topic": "Draft ready for activity ideas",
        "topic_family_id": "TF-1",
        "age_min": 6,
        "age_max": 8,
        "status": "DRAFT",
        "created_at": datetime.now(),
        "updated_at": datetime.now(),
        "created_by": "test",
    })
    response = client.post("/api/topics/TOP-DRAFT-APPROVAL/approve")
    assert response.status_code == 200
    assert response.json()["new_status"] == "APPROVED"

    topic_detail = client.get("/api/topics/TOP-DRAFT-APPROVAL")
    assert topic_detail.status_code == 200
    assert topic_detail.json()["topic"]["status"] == "APPROVED"


def test_reject_topic(client):
    # DRAFT -> REJECTED is not allowed, must be from DRAFT or REVIEW. Wait, DRAFT -> REJECTED IS allowed.
    # Let's add a new DRAFT topic
    repo = ExcelRepository(temp_data_dir)
    repo.append_record("Topics", {
        "topic_id": "TOP-3", "topic": "To Reject", "topic_family_id": "TF-1",
        "age_min": 5, "age_max": 7, "status": "DRAFT", "created_at": datetime.now(), 
        "updated_at": datetime.now(), "created_by": "ai"
    })
    
    res = client.post("/api/topics/TOP-3/reject", json={"reason": "Not good enough"})
    assert res.status_code == 200
    assert res.json()["new_status"] == "REJECTED"
    
    detail = client.get("/api/topics/TOP-3").json()
    assert detail["topic"]["rejection_reason"] == "Not good enough"
    
def test_invalid_state_transition(client):
    # TOP-2 is APPROVED. Cannot move directly to REJECTED.
    res = client.post("/api/topics/TOP-2/reject", json={"reason": "Changed my mind"})
    assert res.status_code == 409
    
    # Cannot select DRAFT
    # TOP-3 is REJECTED
    res2 = client.post("/api/topics/action/select", json={"topic_ids": ["TOP-3"]})
    assert res2.status_code == 409
    
def test_history_logging(client):
    repo = ExcelRepository(temp_data_dir)
    history = repo.read_sheet("TopicReviewHistory")
    assert len(history) >= 4 # Edit, Review, Approve, Select, Unselect, Reject
    actions = [h["action"] for h in history]
    assert "EDIT" in actions
    assert "REVIEW" in actions
    assert "APPROVE" in actions
    assert "SELECT" in actions
    assert "UNSELECT" in actions
    assert "REJECT" in actions

def test_search_topics(client):
    # Setup test with a specific searchable topic
    repo = ExcelRepository(temp_data_dir)
    repo.append_record("Topics", {
        "topic_id": "TOP-SEARCH", "topic": "Animals in Cities", 
        "short_description": "How animals adapt to urban environments.", 
        "full_description": "A detailed explanation of how different animals live in cities.",
        "topic_family_id": "TF-1", "age_min": 5, "age_max": 7, 
        "status": "APPROVED", "created_at": datetime.now(), 
        "updated_at": datetime.now(), "created_by": "ai"
    })
    
    # Search by topic name
    res1 = client.get("/api/topics?search=Animals")
    assert res1.status_code == 200
    assert any(t["topic"]["topic_id"] == "TOP-SEARCH" for t in res1.json()["topics"])
    
    # Search by short description (hook)
    res2 = client.get("/api/topics?search=urban")
    assert res2.status_code == 200
    assert any(t["topic"]["topic_id"] == "TOP-SEARCH" for t in res2.json()["topics"])
    
    # Search by full description (why_interesting)
    res3 = client.get("/api/topics?search=detailed%20explanation")
    assert res3.status_code == 200
    assert any(t["topic"]["topic_id"] == "TOP-SEARCH" for t in res3.json()["topics"])
    
    # Case insensitive
    res4 = client.get("/api/topics?search=CITIES")
    assert res4.status_code == 200
    assert any(t["topic"]["topic_id"] == "TOP-SEARCH" for t in res4.json()["topics"])
    
    # Empty search
    res5 = client.get("/api/topics?search=")
    assert res5.status_code == 200
    assert res5.json()["total"] > 0
