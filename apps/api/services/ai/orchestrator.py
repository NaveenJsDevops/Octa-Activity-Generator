import time
import uuid
import json
from datetime import datetime
from typing import Optional, Type, TypeVar, Any
from pydantic import BaseModel, ValidationError

from apps.api.core.config import settings
from apps.api.models.enums import GenerationStatus
from apps.api.repositories.excel import ExcelRepository
from apps.api.services.ai.provider import AIProvider
from apps.api.services.ai.models import GenerationContext, AIResponse
from apps.api.services.ai.exceptions import (
    AIProviderError, AIStructuredOutputError, AIRetryExhaustedError, AIConfigurationError
)
# Note: we dynamically load the provider so it's abstracted.

T = TypeVar('T', bound=BaseModel)

class AIOrchestrator:
    def __init__(self, excel_repo: ExcelRepository):
        self.excel_repo = excel_repo
        self.max_retries = settings.AI_MAX_RETRIES
        self.last_generation_id: Optional[str] = None
        self.provider: AIProvider = self._initialize_provider()
        
    def _initialize_provider(self) -> AIProvider:
        provider = settings.AI_PROVIDER.lower()
        if provider == "openai":
            from apps.api.services.ai.providers.openai_provider import OpenAIProvider
            return OpenAIProvider()
        elif provider == "gemini":
            from apps.api.services.ai.providers.gemini_provider import GeminiProvider
            return GeminiProvider()
        elif provider == "anthropic":
            from apps.api.services.ai.providers.anthropic_provider import AnthropicProvider
            return AnthropicProvider()
        else:
            raise AIConfigurationError(f"Unsupported AI Provider: {settings.AI_PROVIDER}")

    def _log_generation_run(self, run_data: dict):
        """Persist generation record through the ExcelRepository."""
        try:
            self.excel_repo.append_record("GenerationRuns", run_data)
        except Exception as e:
            # We don't want a logging failure to crash the app, but it should be recorded
            # Since this is a local app, printing to stdout is a fallback.
            print(f"Failed to log GenerationRun: {e}")

    def _update_generation_run(self, generation_id: str, run_data: dict):
        try:
            self.excel_repo.update_record("GenerationRuns", generation_id, run_data)
        except Exception as e:
            print(f"Failed to update GenerationRun: {e}")

    def generate_structured(
        self,
        generation_type: str,
        prompt: str,
        schema_model: Type[T],
        system_prompt: Optional[str] = None,
        prompt_version: str = "v1.0",
        metadata: Optional[dict] = None
    ) -> T:
        """
        Orchestrates a structured AI generation with retries, validation, and logging.
        """
        generation_id = str(uuid.uuid4())
        self.last_generation_id = generation_id
        context = GenerationContext(
            generation_id=generation_id,
            generation_type=generation_type,
            model=settings.AI_MODEL,
            prompt_version=prompt_version,
            metadata=metadata
        )
        
        # Initial Log: RUNNING
        started_at = datetime.now()
        run_record = {
            "generation_id": generation_id,
            "generation_type": generation_type,
            "model": settings.AI_MODEL,
            "prompt_version": prompt_version,
            "started_at": started_at,
            "status": GenerationStatus.RUNNING,
            "metadata": json.dumps(metadata or {}),
        }
        self._log_generation_run(run_record)
        
        attempts = 0
        last_error = None
        
        while attempts <= self.max_retries:
            attempts += 1
            attempt_start_time = time.time()
            try:
                # 1. Call AI Provider
                response: AIResponse = self.provider.generate_structured(
                    prompt=prompt,
                    context=context,
                    schema_model=schema_model,
                    system_prompt=system_prompt
                )
                
                # Calculate timing
                duration_ms = int((time.time() - attempt_start_time) * 1000)
                
                # 2. Validate Structured JSON
                try:
                    parsed_json = json.loads(response.content)
                    validated_data = schema_model(**parsed_json)
                except json.JSONDecodeError as e:
                    raise AIStructuredOutputError(f"AI response is not valid JSON: {str(e)}")
                except ValidationError as e:
                    raise AIStructuredOutputError(f"AI response failed schema validation: {str(e)}")
                
                # 3. Success: Log and Return
                self._update_generation_run(generation_id, {
                    "completed_at": datetime.now(),
                    "status": GenerationStatus.COMPLETED,
                    "input_tokens": response.input_tokens,
                    "output_tokens": response.output_tokens,
                    "duration_ms": duration_ms
                })
                
                return validated_data
                
            except AIConfigurationError as e:
                # Permanent error, do not retry
                self._update_generation_run(generation_id, {
                    "completed_at": datetime.now(),
                    "status": GenerationStatus.FAILED,
                    "error": str(e)
                })
                raise
            except (AIProviderError, AIStructuredOutputError) as e:
                last_error = e
                # Transient/Parse error, can retry
                continue
            except Exception as e:
                # Unknown permanent error
                self._update_generation_run(generation_id, {
                    "completed_at": datetime.now(),
                    "status": GenerationStatus.FAILED,
                    "error": str(e)
                })
                raise e
                
        # If loop finishes without returning, retries are exhausted
        duration_ms = int((time.time() - started_at.timestamp()) * 1000)
        error_msg = f"Failed after {attempts} attempts. Last error: {str(last_error)}"
        
        self._update_generation_run(generation_id, {
            "completed_at": datetime.now(),
            "status": GenerationStatus.FAILED,
            "duration_ms": duration_ms,
            "error": error_msg
        })
        
        raise AIRetryExhaustedError(error_msg)
