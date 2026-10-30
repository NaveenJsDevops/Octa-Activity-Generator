import os
import sys

# Add root directory to python path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from apps.api.core.config import settings
from apps.api.core.topic_families import DEFAULT_TOPIC_FAMILIES
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.master_data import ensure_default_master_data


def initialize():
    print("Initializing master data and workbooks...")
    
    # Initialize repository
    repo = ExcelRepository(settings.DATA_DIR)
    
    # Create all workbooks and sheets
    repo.initialize_workbooks()
    print("Workbooks and sheets initialized successfully.")
    
    ensure_default_master_data(repo)
    print("Default master data (Topic Families, Activity Types, Intelligences, Skills) is ready.")
    print("Initialization complete.")

if __name__ == "__main__":
    initialize()
