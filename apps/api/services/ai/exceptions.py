class AIProviderError(Exception):
    """Base exception for all AI provider errors."""
    pass

class AIStructuredOutputError(AIProviderError):
    """Raised when the AI fails to produce valid structured output."""
    pass

class AITimeoutError(AIProviderError):
    """Raised when the AI request times out."""
    pass

class AIConfigurationError(AIProviderError):
    """Raised when there is a configuration error (e.g. missing API key)."""
    pass

class AIRetryExhaustedError(AIProviderError):
    """Raised when all retry attempts have failed."""
    pass
