from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, TypeVar, Generic
from datetime import datetime

T = TypeVar('T', bound=BaseModel)

class GenerationContext(BaseModel):
    """
    Context representing a specific AI generation attempt.
    """
    generation_id: str
    generation_type: str
    model: str
    prompt_version: str
    request_timestamp: datetime = Field(default_factory=datetime.now)
    metadata: Optional[Dict[str, Any]] = None

class AIResponse(BaseModel):
    """
    Standardized response from the AI provider.
    """
    content: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None
    duration_ms: Optional[int] = None
