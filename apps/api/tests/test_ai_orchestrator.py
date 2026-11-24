import json
import pytest
import os
import tempfile
import shutil
from typing import Optional, Type, Any
from pydantic import BaseModel

from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.services.ai.provider import AIProvider
from apps.api.services.ai.models import GenerationContext, AIResponse
from apps.api.services.ai.exceptions import (
    AIStructuredOutputError, AIRetryExhaustedError, AITimeoutError, AIProviderError
)
from apps.api.models.enums import GenerationStatus
from apps.api.core.config import settings

class MockSchema(BaseModel):
    title: str
    score: int

class MockAIProvider(AIProvider):
    def __init__(self):
        self.response_content = "{}"
        self.call_count = 0
        self.error_to_raise = None
        
    def generate_unstructured(
        self, prompt: str, context: GenerationContext, system_prompt: Optional[str] = None
    ) -> AIResponse:
        self.call_count += 1
        if self.error_to_raise:
            raise self.error_to_raise
        return AIResponse(content=self.response_content)

    def generate_structured(
        self, prompt: str, context: GenerationContext, schema_model: Type[Any], system_prompt: Optional[str] = None
    ) -> AIResponse:
        self.call_count += 1
        if self.error_to_raise:
            raise self.error_to_raise
        return AIResponse(content=self.response_content, input_tokens=10, output_tokens=20)


@pytest.fixture
def temp_data_dir():
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture
def repo(temp_data_dir):
    r = FirestoreRepository(temp_data_dir)
    r.initialize_database()
    return r

@pytest.fixture
def orchestrator(repo):
    # Temporarily bypass the API key check
    old_key = settings.AI_API_KEY
    settings.AI_API_KEY = "dummy-key-for-tests"
    try:
        orch = AIOrchestrator(repo)
        orch.provider = MockAIProvider() # Inject mock
        # Set max retries to a low number for faster tests
        orch.max_retries = 2
        return orch
    finally:
        settings.AI_API_KEY = old_key

def test_structured_response_validation_and_persistence(orchestrator, repo):
    """Test successful generation, schema validation, and logging."""
    orchestrator.provider.response_content = '{"title": "Space", "score": 100}'
    
    result = orchestrator.generate_structured(
        generation_type="TEST",
        prompt="Test prompt",
        schema_model=MockSchema,
        metadata={"topic_id": "TOP-001"},
    )
    
    # 1. Pydantic validation successful
    assert isinstance(result, MockSchema)
    assert result.title == "Space"
    assert result.score == 100
    
    # 2. Generation ID created and logged in Persistence
    logs = repo.read_sheet("GenerationRuns")
    assert len(logs) == 1
    log = logs[0]
    
    assert log["generation_id"] is not None
    assert log["generation_type"] == "TEST"
    assert log["status"] == GenerationStatus.COMPLETED
    assert log["input_tokens"] == 10
    assert log["output_tokens"] == 20
    assert json.loads(log["metadata"]) == {"topic_id": "TOP-001"}

def test_malformed_json_handling_and_retry(orchestrator, repo):
    """Test that malformed JSON triggers retries and eventual failure."""
    orchestrator.provider.response_content = "This is not json"
    
    with pytest.raises(AIRetryExhaustedError):
        orchestrator.generate_structured(
            generation_type="TEST",
            prompt="Test",
            schema_model=MockSchema
        )
        
    # Provider was called max_retries + 1 (initial + 2 retries = 3 total)
    assert orchestrator.provider.call_count == 3
    
    # Log should show FAILED
    logs = repo.read_sheet("GenerationRuns")
    assert logs[0]["status"] == GenerationStatus.FAILED
    assert "not valid JSON" in logs[0]["error"]

def test_schema_validation_failure_and_retry(orchestrator, repo):
    """Test that missing required fields triggers retries and failure."""
    orchestrator.provider.response_content = '{"title": "Space"}' # missing score
    
    with pytest.raises(AIRetryExhaustedError):
        orchestrator.generate_structured(
            generation_type="TEST",
            prompt="Test",
            schema_model=MockSchema
        )
        
    assert orchestrator.provider.call_count == 3
    logs = repo.read_sheet("GenerationRuns")
    assert "schema validation" in logs[0]["error"]

def test_timeout_handling_and_retry(orchestrator, repo):
    orchestrator.provider.error_to_raise = AITimeoutError("Simulated timeout")
    
    with pytest.raises(AIRetryExhaustedError):
        orchestrator.generate_structured(
            generation_type="TEST",
            prompt="Test",
            schema_model=MockSchema
        )
        
    assert orchestrator.provider.call_count == 3
    logs = repo.read_sheet("GenerationRuns")
    assert "timeout" in logs[0]["error"].lower()

def test_markdown_fence_cleaning():
    from apps.api.services.ai.providers.gemini_provider import _clean_markdown_fence
    
    # 1. Plain json
    assert _clean_markdown_fence('{"key": "value"}') == '{"key": "value"}'
    
    # 2. Markdown with json tag
    wrapped = "```json\n{\"key\": \"value\"}\n```"
    assert _clean_markdown_fence(wrapped) == '{"key": "value"}'
    
    # 3. Leading/trailing whitespace and newlines
    whitespace_wrapped = "\n  ```json\n  {\"key\": \"value\"}\n  ``` \n"
    assert _clean_markdown_fence(whitespace_wrapped) == '{"key": "value"}'
    
    # 4. Empty or None
    assert _clean_markdown_fence("") == "{}"

def test_provider_fallback_on_rate_limit(orchestrator, repo):
    """Simulate primary provider rate limit (429) falling back to a secondary provider."""
    # Primary raises 429
    orchestrator.provider.error_to_raise = AIProviderError("429 Too Many Requests: quota exceeded")
    
    # Configure mock fallback provider
    fallback_provider = MockAIProvider()
    fallback_provider.response_content = '{"title": "Fallback Astronomy", "score": 95}'
    
    # Inject fallback provider
    orchestrator._get_fallback_providers = lambda: [("fallback_secondary", fallback_provider)]
    
    result = orchestrator.generate_structured(
        generation_type="TEST_FALLBACK",
        prompt="Tell me about stars",
        schema_model=MockSchema,
    )
    
    assert isinstance(result, MockSchema)
    assert result.title == "Fallback Astronomy"
    assert result.score == 95
    assert fallback_provider.call_count == 1

def test_discovery_session_store_ttl_and_capacity():
    from datetime import datetime, timedelta
    from apps.api.services.topic_discovery.session_store import SessionStore, MAX_SESSIONS
    
    # 1. Create session
    sess = SessionStore.create_session("req", ["cand1"], "gen-1")
    assert SessionStore.get_session(sess.session_id) is not None
    
    # 2. Expire session by setting created_at > 24 hours ago
    sess.created_at = datetime.now() - timedelta(hours=25)
    assert SessionStore.get_session(sess.session_id) is None
    
    # 3. Capacity pruning
    for i in range(MAX_SESSIONS + 10):
        SessionStore.create_session("req", [f"cand-{i}"], f"gen-{i}")
    
    assert len(SessionStore._sessions) <= MAX_SESSIONS
