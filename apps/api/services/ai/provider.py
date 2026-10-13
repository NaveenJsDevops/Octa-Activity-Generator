from typing import Dict, Any, Optional, Type, TypeVar
from abc import ABC, abstractmethod
from pydantic import BaseModel

from apps.api.services.ai.models import GenerationContext, AIResponse

T = TypeVar('T', bound=BaseModel)

class AIProvider(ABC):
    """
    Abstract base class for all AI providers.
    Ensures that any external provider conforms to the internal application contract.
    """
    
    @abstractmethod
    def generate_unstructured(
        self, 
        prompt: str, 
        context: GenerationContext,
        system_prompt: Optional[str] = None
    ) -> AIResponse:
        """
        Generate plain text/unstructured content.
        Must handle its own API timeouts and raise application-level AIProviderError exceptions.
        """
        pass

    @abstractmethod
    def generate_structured(
        self, 
        prompt: str, 
        context: GenerationContext, 
        schema_model: Type[T],
        system_prompt: Optional[str] = None
    ) -> AIResponse:
        """
        Generate structured JSON content based on the provided Pydantic schema model.
        The returned AIResponse.content must be a valid JSON string that can be parsed by `schema_model`.
        """
        pass
