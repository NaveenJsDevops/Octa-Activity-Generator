import os
import shutil
import tempfile
import sys
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

# Set environment before loading config
temp_data_dir = tempfile.mkdtemp()
os.environ["DATA_DIR"] = temp_data_dir
os.environ["AI_MAX_RETRIES"] = "1"
os.environ["AI_API_KEY"] = "dummy_key_for_test"

from apps.api.main import app
from apps.api.repositories.excel import ExcelRepository
from apps.api.models.topic_discovery import TopicDiscoveryOutput, TopicCandidate

client = TestClient(app)
repo = ExcelRepository(temp_data_dir)
repo.initialize_workbooks()

# Seed Master Data
repo.append_record("TopicFamilies", {"topic_family_id": "TF-SMOKE-1", "name": "Smoke Test Family"})
repo.append_record("Intelligences", {"intelligence_id": "INT-SMOKE-1", "name": "Logic"})
repo.append_record("Skills", {"skill_id": "SK-SMOKE-1", "intelligence_id": "INT-SMOKE-1", "name": "Observation"})
repo.append_record("SubSkills", {"sub_skill_id": "SS-SMOKE-1", "skill_id": "SK-SMOKE-1", "name": "Pattern Recognition"})

print(f"--- SMOKE TEST STARTED ---")
print(f"Data Dir: {temp_data_dir}")
print(f"TF: TF-SMOKE-1, INT: INT-SMOKE-1, SK: SK-SMOKE-1, SS: SS-SMOKE-1")

base_request = {
    "age_min": 9,
    "age_max": 11,
    "target_class": "Class 6",
    "topic_family_id": "TF-SMOKE-1",
    "intelligence_id": "INT-SMOKE-1",
    "skill_id": "SK-SMOKE-1",
    "sub_skill_id": "SS-SMOKE-1",
    "country_context": "India",
    "requested_count": 5
}

# --- C. Mock AI Test ---
from apps.api.services.ai.models import AIResponse
import json

def mock_generate_structured_success(*args, **kwargs):
    output = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Smoke Test Topic 1",
                short_description="Hook 1 long enough",
                full_description="Interesting 1 long enough",
                activity_potential="HIGH",
                age_suitability="9-11",
                keywords=["test1", "mock1"]
            ),
            TopicCandidate(
                topic="Smoke Test Topic 2",
                short_description="Hook 2 long enough",
                full_description="Interesting 2 long enough",
                activity_potential="MEDIUM",
                age_suitability="9-11",
                keywords=["test2"]
            ),
            TopicCandidate(
                topic="Smoke Test Topic 3",
                short_description="Hook 3 long enough",
                full_description="Interesting 3 long enough",
                activity_potential="LOW",
                age_suitability="9-11",
                keywords=["test3"]
            ),
        ]
    )
    return output

print("\\n[RUNNING] Mock AI Complete Flow Test & Skill Resolution...")
with patch('apps.api.services.ai.orchestrator.AIOrchestrator.generate_structured', side_effect=mock_generate_structured_success):
    response = client.post("/api/topics/discover", json=base_request)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Session ID: {data.get('session_id')}")
        print(f"Candidates generated: {len(data.get('candidates', []))}")
    else:
        print(f"Error: {response.json()}")
        
print("\\n[RUNNING] Verify Excel Persistence...")
topics = repo.read_sheet("Topics")
topic_skills = repo.read_sheet("TopicSkills")
topic_keywords = repo.read_sheet("TopicKeywords")
runs = repo.read_sheet("GenerationRuns")
print(f"Topics saved: {len(topics)}")
if topics:
    print(f"First topic ID: {topics[0]['topic_id']}, Status: {topics[0]['status']}")
print(f"TopicSkills saved: {len(topic_skills)}")
print(f"TopicKeywords saved: {len(topic_keywords)}")
print(f"GenerationRuns saved: {len(runs)}")


print("\\n[RUNNING] Duplicate Test...")
# Provide the exact same candidates
with patch('apps.api.services.ai.orchestrator.AIOrchestrator.generate_structured', side_effect=mock_generate_structured_success):
    dup_response = client.post("/api/topics/discover", json=base_request)
    d_data = dup_response.json()
    print(f"Duplicates Candidates Generated: {len(d_data.get('candidates', []))}")
    
print("\\n[RUNNING] Partial Success Test...")
def mock_partial_success(*args, **kwargs):
    output = TopicDiscoveryOutput(
        topics=[
            TopicCandidate(
                topic="Unique Valid Topic",
                short_description="Hook is long enough",
                full_description="Why is long enough",
                activity_potential="HIGH",
                age_suitability="9-11",
            ),
            TopicCandidate(
                topic="Unique Valid Topic", # Duplicate of candidate 1
                short_description="Hook is long enough",
                full_description="Why is long enough",
                activity_potential="HIGH",
                age_suitability="9-11"
            ),
            TopicCandidate(
                topic="Valid Topic 3", # Valid
                short_description="Hook is long enough",
                full_description="Why is long enough",
                activity_potential="HIGH",
                age_suitability="9-11"
            ),
            TopicCandidate(
                topic="Invalid Topic", # Invalid: activity potential wrong
                short_description="Hook is long enough",
                full_description="Why is long enough",
                activity_potential="SUPER_HIGH", # invalid
                age_suitability="9-11"
            ),
            TopicCandidate(
                topic="Smoke Test Topic 1", # Duplicate against DB
                short_description="Hook is long enough",
                full_description="Why is long enough",
                activity_potential="HIGH",
                age_suitability="9-11"
            )
        ]
    )
    return output

with patch('apps.api.services.ai.orchestrator.AIOrchestrator.generate_structured', side_effect=mock_partial_success):
    part_resp = client.post("/api/topics/discover", json=base_request)
    p_data = part_resp.json()
    print(f"Partial Candidates Generated: {len(p_data.get('candidates', []))}")

print("\\n[RUNNING] Invalid Request Test...")
invalid_req = base_request.copy()
invalid_req["age_min"] = 15
invalid_req["age_max"] = 10 # Invalid range
inv_resp = client.post("/api/topics/discover", json=invalid_req)
print(f"Status Code: {inv_resp.status_code}")
if inv_resp.status_code != 200:
    print(f"Error detail: {inv_resp.json().get('detail')}")

print("\\n[RUNNING] Structured Output Failure Test...")
from apps.api.services.ai.exceptions import AIProviderError
def mock_generate_structured_fail(*args, **kwargs):
    raise ValueError("Structured output validation failed")

with patch('apps.api.services.ai.orchestrator.AIOrchestrator.generate_structured', side_effect=mock_generate_structured_fail):
    fail_resp = client.post("/api/topics/discover", json=base_request)
    print(f"Status Code: {fail_resp.status_code}")
    print(f"Error: {fail_resp.json().get('detail')}")

print("\\n[RUNNING] Real AI Test...")
try:
    from apps.api.core.config import settings
    if settings.AI_API_KEY and settings.AI_API_KEY != "your_ai_api_key_here":
        print("API Key configured. Running real AI test with requested_count=1...")
        real_req = base_request.copy()
        real_req["requested_count"] = 1
        real_resp = client.post("/api/topics/discover", json=real_req)
        if real_resp.status_code == 200:
            print("PASS - Successfully generated with real AI")
        else:
            print(f"FAIL - {real_resp.json()}")
    else:
        print("SKIPPED — credentials not configured")
except Exception as e:
    print(f"FAIL - {str(e)}")

# Cleanup
shutil.rmtree(temp_data_dir)
print("\\n--- SMOKE TEST END ---")
