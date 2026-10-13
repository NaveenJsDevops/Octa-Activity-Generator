import json
from typing import Optional, Type, TypeVar
from pydantic import BaseModel
import openai
from openai import OpenAIError, APITimeoutError as OpenAITimeoutError

from apps.api.core.config import settings
from apps.api.services.ai.provider import AIProvider
from apps.api.services.ai.models import GenerationContext, AIResponse
from apps.api.services.ai.exceptions import (
    AIProviderError, AITimeoutError, AIConfigurationError
)

T = TypeVar('T', bound=BaseModel)

class OpenAIProvider(AIProvider):
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.is_configured = bool(self.api_key and self.api_key.strip() and self.api_key != "your_openai_api_key_here")
        
        if self.is_configured:
            kwargs = {
                "api_key": self.api_key,
                "timeout": settings.AI_TIMEOUT_SECONDS
            }
            if settings.AI_BASE_URL:
                kwargs["base_url"] = settings.AI_BASE_URL
            self.client = openai.OpenAI(**kwargs)
        else:
            self.client = None
            
        self.model = settings.AI_MODEL
        self.temperature = settings.AI_TEMPERATURE
        self.max_tokens = settings.AI_MAX_OUTPUT_TOKENS

    def _convert_error(self, e: Exception) -> Exception:
        if isinstance(e, OpenAITimeoutError):
            return AITimeoutError(f"OpenAI request timed out: {str(e)}")
        elif isinstance(e, OpenAIError):
            return AIProviderError(f"OpenAI API error: {str(e)}")
        return AIProviderError(f"Unexpected AI error: {str(e)}")

    def generate_unstructured(
        self, 
        prompt: str, 
        context: GenerationContext,
        system_prompt: Optional[str] = None
    ) -> AIResponse:
        if not self.is_configured:
            raise AIConfigurationError("AI provider is not configured. Please configure OPENAI_API_KEY.")
            
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
            )
            
            return AIResponse(
                content=response.choices[0].message.content or "",
                input_tokens=response.usage.prompt_tokens if response.usage else None,
                output_tokens=response.usage.completion_tokens if response.usage else None,
                # We don't have exact duration_ms from OpenAI client directly easily without timing it.
                # Orchestrator will handle timing.
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
            raise AIConfigurationError("AI provider is not configured. Please configure OPENAI_API_KEY.")
            
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        # In a real implementation we might pass the JSON schema to OpenAI
        # For this Phase, we just request JSON response format.
        schema_json = schema_model.model_json_schema()
        instructions = f"\\n\\nYou MUST output strictly in JSON format matching this schema:\\n{json.dumps(schema_json)}"
        
        messages.append({"role": "user", "content": prompt + instructions})
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}
            )
            
            return AIResponse(
                content=response.choices[0].message.content or "{}",
                input_tokens=response.usage.prompt_tokens if response.usage else None,
                output_tokens=response.usage.completion_tokens if response.usage else None,
                duration_ms=None
            )
        except Exception as e:
            raise self._convert_error(e)
