import os
import sys

# Add root directory to python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from apps.api.core.config import settings
from apps.api.core.topic_families import DEFAULT_TOPIC_FAMILIES
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.master_data import ensure_default_topic_families


def initialize():
    print("Initializing master data and workbooks...")
    
    # Initialize repository
    repo = ExcelRepository(settings.DATA_DIR)
    
    # Create all workbooks and sheets
    repo.initialize_workbooks()
    print("Workbooks and sheets initialized successfully.")
    
    ensure_default_topic_families(repo)
    print("Default topic families are ready.")
        
    skills = repo.read_sheet("Skills")
    if not skills:
        print("Seeding sample Skills...")
        repo.append_record("Skills", {
            "skill_id": "sk-001",
            "intelligence_id": "int-001",
            "name": "Logical Reasoning",
            "description": "Ability to reason logically"
        })
        
    sub_skills = repo.read_sheet("SubSkills")
    if not sub_skills:
        print("Seeding sample SubSkills...")
        repo.append_record("SubSkills", {
            "sub_skill_id": "ssk-001",
            "skill_id": "sk-001",
            "name": "Pattern Recognition"
        })
        
    activity_types = repo.read_sheet("ActivityTypes")
    if not activity_types:
        print("Seeding sample ActivityTypes...")
        repo.append_record("ActivityTypes", {
            "activity_type_id": "at-001",
            "name": "Worksheet",
            "description": "Printable activity sheet"
        })
        
    print("Initialization complete.")

if __name__ == "__main__":
    initialize()
