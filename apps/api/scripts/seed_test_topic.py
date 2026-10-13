import os
import sys
from datetime import datetime

# Add root directory to python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from apps.api.core.config import settings
from apps.api.repositories.excel import ExcelRepository

def seed():
    repo = ExcelRepository(settings.DATA_DIR)
    
    # Check if we already have a topic
    topics = repo.read_sheet("Topics")
    if not topics:
        print("Seeding test topic...")
        repo.append_record("Topics", {
            "topic_id": "test-topic-001",
            "topic": "Exploring Mars",
            "topic_hook": "Journey to the red planet",
            "why_interesting": "Mars is cool and we might go there soon.",
            "activity_potential": "HIGH",
            "age_min": 5,
            "age_max": 7,
            "status": "APPROVED",
            "created_by": "human_tester",
            "topic_family_id": "tf-001",
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        })
        repo.append_record("TopicSkills", {
            "topic_id": "test-topic-001",
            "skill_id": "sk-001",
            "sub_skill_id": "ssk-001"
        })
        print("Topic seeded.")
    else:
        print("Topic already exists.")

if __name__ == "__main__":
    seed()
