import pytest
from datetime import datetime
from apps.api.core.config import settings
from apps.api.services.ai.providers.openai_provider import OpenAIProvider
from apps.api.services.ai.exceptions import AIConfigurationError
from apps.api.services.ai.prompts.registry import PromptRegistry, PromptTemplate

def test_configuration_validation():
    # Store old key
    old_key = settings.OPENAI_API_KEY
    
    settings.OPENAI_API_KEY = ""
    provider = OpenAIProvider()
    with pytest.raises(AIConfigurationError, match="not configured"):
        provider.generate_unstructured("Test", None)
        
    # Restore
    settings.OPENAI_API_KEY = old_key

def test_prompt_version_lookup():
    registry = PromptRegistry()
    template = PromptTemplate(
        prompt_name="topic_discovery",
        version="1.0",
        user_prompt_template="Generate topics about {subject}",
        created_at=datetime.now()
    )
    
    registry.register_prompt(template)
    
    found = registry.get_prompt("topic_discovery", "1.0")
    assert found is not None
    assert found.user_prompt_template == "Generate topics about {subject}"
    
    not_found = registry.get_prompt("topic_discovery", "2.0")
    assert not_found is None
