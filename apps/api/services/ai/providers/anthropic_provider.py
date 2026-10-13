import json
from typing import Optional, Type, TypeVar
from pydantic import BaseModel
import anthropic
from anthropic import AnthropicError, APITimeoutError

from apps.api.core.config import settings
from apps.api.services.ai.provider import AIProvider
from apps.api.services.ai.models import GenerationContext, AIResponse
from apps.api.services.ai.exceptions import (
    AIProviderError, AITimeoutError, AIConfigurationError
)

T = TypeVar('T', bound=BaseModel)

class AnthropicProvider(AIProvider):
    def __init__(self):
        self.api_key = settings.ANTHROPIC_API_KEY
        self.is_configured = bool(self.api_key and self.api_key.strip() and self.api_key != "your_anthropic_api_key_here")
        
        if self.is_configured:
            self.client = anthropic.Anthropic(
                api_key=self.api_key,
                timeout=settings.AI_TIMEOUT_SECONDS
            )
        else:
            self.client = None
            
        self.model = settings.AI_MODEL
        self.temperature = settings.AI_TEMPERATURE
        self.max_tokens = settings.AI_MAX_OUTPUT_TOKENS

    def _convert_error(self, e: Exception) -> Exception:
        if isinstance(e, APITimeoutError):
            return AITimeoutError(f"Anthropic request timed out: {str(e)}")
        elif isinstance(e, AnthropicError):
            return AIProviderError(f"Anthropic API error: {str(e)}")
        return AIProviderError(f"Unexpected AI error: {str(e)}")

    def generate_unstructured(
        self, 
        prompt: str, 
        context: GenerationContext,
        system_prompt: Optional[str] = None
    ) -> AIResponse:
        if not self.is_configured:
            raise AIConfigurationError("AI provider is not configured. Please configure ANTHROPIC_API_KEY.")
            
        try:
            kwargs = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
            if system_prompt:
                kwargs["system"] = system_prompt
                
            response = self.client.messages.create(**kwargs)
            
            return AIResponse(
                content=response.content[0].text,
                input_tokens=response.usage.input_tokens if response.usage else None,
                output_tokens=response.usage.output_tokens if response.usage else None,
                duration_ms=None 
            )
        except Exception as e:
            raise self._convert_error(e)

    def generate_structured(
        self, 
        prompt: str, 
        context: GenerationContext, 
        schema_model: Type[T],
        system_prompt: Optional[str] = None
    ) -> AIResponse:
        if not self.is_configured:
            raise AIConfigurationError("AI provider is not configured. Please configure ANTHROPIC_API_KEY.")
            
        # Instruct Claude to return strictly JSON
        schema_json = schema_model.model_json_schema()
        instructions = f"\n\nYou MUST output strictly in JSON format matching this schema without any markdown formatting or wrapper:\n{json.dumps(schema_json)}"
        
        try:
            kwargs = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt + instructions}],
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
            if system_prompt:
                kwargs["system"] = system_prompt
                
            response = self.client.messages.create(**kwargs)
            content = response.content[0].text
            
            # Sometimes Claude wraps in ```json ... ``` despite instructions
            if content.startswith("```json"):
                content = content[7:]
                if content.endswith("```"):
                    content = content[:-3]
            elif content.startswith("```"):
                content = content[3:]
                if content.endswith("```"):
                    content = content[:-3]
                    
            content = content.strip()
            
            return AIResponse(
                content=content,
                input_tokens=response.usage.input_tokens if response.usage else None,
                output_tokens=response.usage.output_tokens if response.usage else None,
                duration_ms=None
            )
        except Exception as e:
            raise self._convert_error(e)
