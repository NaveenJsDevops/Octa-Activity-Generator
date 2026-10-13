import json
import pytest
import os
import tempfile
import shutil
from typing import Optional, Type, Any
from pydantic import BaseModel

from apps.api.repositories.excel import ExcelRepository
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
def excel_repo(temp_data_dir):
    repo = ExcelRepository(temp_data_dir)
    repo.initialize_workbooks()
    return repo

@pytest.fixture
def orchestrator(excel_repo):
    # Temporarily bypass the API key check
    old_key = settings.AI_API_KEY
    settings.AI_API_KEY = "dummy-key-for-tests"
    try:
        orch = AIOrchestrator(excel_repo)
        orch.provider = MockAIProvider() # Inject mock
        # Set max retries to a low number for faster tests
        orch.max_retries = 2
        return orch
    finally:
        settings.AI_API_KEY = old_key

def test_structured_response_validation_and_persistence(orchestrator, excel_repo):
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
    
    # 2. Generation ID created and logged in Excel (Persistence)
    logs = excel_repo.read_sheet("GenerationRuns")
    assert len(logs) == 1
    log = logs[0]
    
    assert log["generation_id"] is not None
    assert log["generation_type"] == "TEST"
    assert log["status"] == GenerationStatus.COMPLETED
    assert log["input_tokens"] == 10
    assert log["output_tokens"] == 20
    assert json.loads(log["metadata"]) == {"topic_id": "TOP-001"}

def test_malformed_json_handling_and_retry(orchestrator, excel_repo):
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
    logs = excel_repo.read_sheet("GenerationRuns")
    assert logs[0]["status"] == GenerationStatus.FAILED
    assert "not valid JSON" in logs[0]["error"]

def test_schema_validation_failure_and_retry(orchestrator, excel_repo):
    """Test that missing required fields triggers retries and failure."""
    orchestrator.provider.response_content = '{"title": "Space"}' # missing score
    
    with pytest.raises(AIRetryExhaustedError):
        orchestrator.generate_structured(
            generation_type="TEST",
            prompt="Test",
            schema_model=MockSchema
        )
        
    assert orchestrator.provider.call_count == 3
    logs = excel_repo.read_sheet("GenerationRuns")
    assert "schema validation" in logs[0]["error"]

def test_timeout_handling_and_retry(orchestrator, excel_repo):
    orchestrator.provider.error_to_raise = AITimeoutError("Simulated timeout")
    
    with pytest.raises(AIRetryExhaustedError):
        orchestrator.generate_structured(
            generation_type="TEST",
            prompt="Test",
            schema_model=MockSchema
        )
        
    assert orchestrator.provider.call_count == 3
    logs = excel_repo.read_sheet("GenerationRuns")
    assert "timeout" in logs[0]["error"].lower()
