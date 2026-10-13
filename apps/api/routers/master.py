from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from apps.api.repositories.excel import ExcelRepository
from apps.api.core.config import settings

router = APIRouter(prefix="/api/master", tags=["master"])

def get_excel_repository() -> ExcelRepository:
    return ExcelRepository(settings.DATA_DIR)

@router.get("")
def get_master_data(repo: ExcelRepository = Depends(get_excel_repository)) -> Dict[str, List[Dict[str, Any]]]:
    return {
        "topicFamilies": repo.read_sheet("TopicFamilies"),
        "intelligences": repo.read_sheet("Intelligences"),
        "skills": repo.read_sheet("Skills"),
        "subSkills": repo.read_sheet("SubSkills")
    }
