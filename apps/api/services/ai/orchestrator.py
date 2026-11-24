import json
import logging
import os
import random
import time
import uuid
from datetime import datetime
from typing import Any, List, Optional, Tuple, Type, TypeVar
from pydantic import BaseModel, ValidationError

from apps.api.core.config import settings
from apps.api.models.enums import GenerationStatus
from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.ai.provider import AIProvider
from apps.api.services.ai.models import GenerationContext, AIResponse
from apps.api.services.ai.exceptions import (
    AIProviderError, AIStructuredOutputError, AIRetryExhaustedError, AIConfigurationError
)

logger = logging.getLogger("octa.ai.orchestrator")
T = TypeVar('T', bound=BaseModel)

class AIOrchestrator:
    def __init__(self, repo: FirestoreRepository):
        self.repo = repo
        self.max_retries = settings.AI_MAX_RETRIES
        self.last_generation_id: Optional[str] = None
        self.provider: AIProvider = self._initialize_provider()
        self.enable_fallback: bool = True
        
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

    def _get_fallback_providers(self) -> List[Tuple[str, AIProvider]]:
        """Returns configured secondary AI providers for seamless fallback without context loss."""
        if not self.enable_fallback:
            return []

        # During automated tests, don't auto-discover live providers unless explicitly mocked
        if os.getenv("PYTEST_CURRENT_TEST") and not getattr(self, "_force_test_fallback", False):
            return []

        fallbacks: List[Tuple[str, AIProvider]] = []
        current = settings.AI_PROVIDER.lower()
        
        candidates = [
            ("gemini", settings.GEMINI_API_KEY),
            ("openai", settings.OPENAI_API_KEY),
            ("anthropic", settings.ANTHROPIC_API_KEY),
        ]
        
        for name, key in candidates:
            if name != current and key and key.strip() and not key.lower().startswith("your_"):
                try:
                    if name == "gemini":
                        from apps.api.services.ai.providers.gemini_provider import GeminiProvider
                        p = GeminiProvider()
                        if p.is_configured:
                            fallbacks.append((name, p))
                    elif name == "openai":
                        from apps.api.services.ai.providers.openai_provider import OpenAIProvider
                        p = OpenAIProvider()
                        if p.is_configured:
                            fallbacks.append((name, p))
                    elif name == "anthropic":
                        from apps.api.services.ai.providers.anthropic_provider import AnthropicProvider
                        p = AnthropicProvider()
                        if p.is_configured:
                            fallbacks.append((name, p))
                except Exception as e:
                    logger.debug(f"Failed to initialize fallback provider {name}: {e}")
        return fallbacks

    def _log_generation_run(self, run_data: dict):
        """Persist generation record through the repository."""
        try:
            self.repo.append_record("GenerationRuns", run_data)
        except Exception as e:
            logger.warning(f"Failed to log GenerationRun: {e}")

    def _update_generation_run(self, generation_id: str, run_data: dict):
        try:
            self.repo.update_record("GenerationRuns", generation_id, run_data)
        except Exception as e:
            logger.warning(f"Failed to update GenerationRun: {e}")

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
        Orchestrates structured AI generation with exponential backoff, validation, 
        automatic provider fallback, and persistent audit logging.
        """
        generation_id = str(uuid.uuid4())
        self.last_generation_id = generation_id
        active_model = settings.AI_MODEL
        context = GenerationContext(
            generation_id=generation_id,
            generation_type=generation_type,
            model=active_model,
            prompt_version=prompt_version,
            metadata=metadata
        )
        
        # Initial Log: RUNNING
        started_at = datetime.now()
        run_record = {
            "generation_id": generation_id,
            "generation_type": generation_type,
            "model": active_model,
            "prompt_version": prompt_version,
            "started_at": started_at,
            "status": GenerationStatus.RUNNING,
            "metadata": json.dumps(metadata or {}),
        }
        self._log_generation_run(run_record)
        
        # Build provider chain: [Primary Provider, ...Fallback Providers]
        providers_to_try: List[Tuple[str, AIProvider]] = [("primary", self.provider)]
        fallback_providers = self._get_fallback_providers()
        providers_to_try.extend(fallback_providers)

        is_test_env = bool(
            os.getenv("PYTEST_CURRENT_TEST") 
            or os.getenv("TESTING") == "1" 
            or self.max_retries <= 1
        )
        
        total_attempts = 0
        last_error = None

        for provider_idx, (provider_label, active_provider) in enumerate(providers_to_try):
            attempts = 0
            while attempts <= self.max_retries:
                attempts += 1
                total_attempts += 1
                attempt_start_time = time.time()

                try:
                    # 1. Call AI Provider
                    response: AIResponse = active_provider.generate_structured(
                        prompt=prompt,
                        context=context,
                        schema_model=schema_model,
                        system_prompt=system_prompt
                    )
                    
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
                    # Permanent configuration error for this provider - switch to next provider if available
                    last_error = e
                    logger.warning(f"Provider {provider_label} configuration error: {e}")
                    break

                except AIStructuredOutputError as e:
                    # Schema or JSON parsing error - retry on the same provider
                    last_error = e
                    if attempts <= self.max_retries:
                        if not is_test_env:
                            delay = min(0.6 * (1.5 ** (attempts - 1)) + random.uniform(0.1, 0.3), 3.0)
                            time.sleep(delay)
                        continue
                    break

                except AIProviderError as e:
                    last_error = e
                    err_msg = str(e).lower()
                    is_rate_limit_or_outage = any(
                        term in err_msg for term in ["429", "quota", "rate limit", "credits", "502", "503", "unavailable", "timeout"]
                    )
                    
                    # If this provider hit rate limits or outage, and we have a fallback provider, switch immediately
                    if is_rate_limit_or_outage and provider_idx < len(providers_to_try) - 1:
                        next_name = providers_to_try[provider_idx + 1][0]
                        logger.warning(
                            f"Provider {provider_label} transient error ({err_msg}). Falling back seamlessly to {next_name}..."
                        )
                        break

                    # If more retries remain on this provider, apply exponential backoff with jitter
                    if attempts <= self.max_retries:
                        if not is_test_env:
                            # Exponential backoff: 0.8s, 1.6s, 3.2s... clamped to 5s + jitter
                            delay = min(0.8 * (1.8 ** (attempts - 1)) + random.uniform(0.1, 0.4), 5.0)
                            time.sleep(delay)
                        continue

                except Exception as e:
                    last_error = e
                    break
        
        # If all providers and retries exhausted
        duration_ms = int((time.time() - started_at.timestamp()) * 1000)
        error_msg = f"Failed after {total_attempts} attempts across {len(providers_to_try)} provider(s). Last error: {str(last_error)}"
        
        self._update_generation_run(generation_id, {
            "completed_at": datetime.now(),
            "status": GenerationStatus.FAILED,
            "duration_ms": duration_ms,
            "error": error_msg
        })
        
        raise AIRetryExhaustedError(error_msg)
