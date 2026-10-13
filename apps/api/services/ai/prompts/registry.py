from typing import Optional, Type, Dict, Any
from pydantic import BaseModel
from datetime import datetime

class PromptTemplate(BaseModel):
    prompt_name: str
    version: str
    system_prompt: Optional[str] = None
    user_prompt_template: str
    schema_model: Optional[Type[BaseModel]] = None
    status: str = "ACTIVE"
    created_at: datetime
    
class PromptRegistry:
    """
    Foundation for Prompt Versioning.
    In future phases, this can load prompts from Excel or a local database.
    """
    def __init__(self) -> None:
        self._prompts: Dict[str, PromptTemplate] = {}
        
    def register_prompt(self, template: PromptTemplate):
        key = f"{template.prompt_name}@{template.version}"
        self._prompts[key] = template
        
    def get_prompt(self, prompt_name: str, version: str) -> Optional[PromptTemplate]:
        key = f"{prompt_name}@{version}"
        return self._prompts.get(key)
        
    def get_latest_prompt(self, prompt_name: str) -> Optional[PromptTemplate]:
        # For this foundation, simple exact match or scanning can be done.
        # This is just the architecture for now.
        pass
