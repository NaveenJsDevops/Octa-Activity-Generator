import os
import sys

# Add root directory to python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from apps.api.core.config import settings
from apps.api.repositories.excel import ExcelRepository
from apps.api.models.domain import TopicFamily, Skill, SubSkill, ActivityType

DEFAULT_TOPIC_FAMILIES = [
    {
        "topic_family_id": "tf-001",
        "name": "Space Exploration",
        "description": "Topics related to space, planets, and astronomy",
    },
    {
        "topic_family_id": "tf-animals-wildlife",
        "name": "Animals & Wildlife",
        "description": "Animals, habitats, biodiversity, and wildlife conservation",
    },
    {
        "topic_family_id": "tf-nature-environment",
        "name": "Nature & Environment",
        "description": "Plants, ecosystems, weather, and caring for the environment",
    },
    {
        "topic_family_id": "tf-science-technology",
        "name": "Science & Technology",
        "description": "Science experiments, inventions, engineering, and technology",
    },
    {
        "topic_family_id": "tf-arts-creativity",
        "name": "Arts & Creativity",
        "description": "Visual arts, music, design, storytelling, and creative expression",
    },
    {
        "topic_family_id": "tf-culture-community",
        "name": "Culture & Community",
        "description": "Cultures, traditions, relationships, and the communities around us",
    },
    {
        "topic_family_id": "tf-history-geography",
        "name": "History & Geography",
        "description": "People, places, maps, landmarks, and events from the past",
    },
    {
        "topic_family_id": "tf-health-wellbeing",
        "name": "Health & Wellbeing",
        "description": "Healthy habits, emotions, mindfulness, and personal wellbeing",
    },
    {
        "topic_family_id": "tf-food-nutrition",
        "name": "Food & Nutrition",
        "description": "Food, cooking, nutrition, and how food gets to our tables",
    },
    {
        "topic_family_id": "tf-sports-movement",
        "name": "Sports & Movement",
        "description": "Sports, physical activity, coordination, and teamwork",
    },
    {
        "topic_family_id": "tf-math-logic",
        "name": "Math & Logic",
        "description": "Numbers, patterns, puzzles, and logical problem-solving",
    },
    {
        "topic_family_id": "tf-language-literacy",
        "name": "Language & Literacy",
        "description": "Reading, writing, communication, and learning new languages",
    },
]


def initialize():
    print("Initializing master data and workbooks...")
    
    # Initialize repository
    repo = ExcelRepository(settings.DATA_DIR)
    
    # Create all workbooks and sheets
    repo.initialize_workbooks()
    print("Workbooks and sheets initialized successfully.")
    
    # Seed missing default families without replacing configured records.
    families = repo.read_sheet("TopicFamilies")
    existing_family_ids = {family["topic_family_id"] for family in families}
    for family in DEFAULT_TOPIC_FAMILIES:
        if family["topic_family_id"] not in existing_family_ids:
            repo.append_record("TopicFamilies", family)
            print(f"Added topic family: {family['name']}")
        
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
