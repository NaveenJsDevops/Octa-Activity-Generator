from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Dict
from pathlib import Path
import os

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = PROJECT_ROOT / "apps" / "api" / ".env"

GEMINI_MODEL = "gemini-3.1-flash-lite"


class Settings(BaseSettings):
    ENVIRONMENT: str = "development"
    BACKEND_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    
    AI_PROVIDER: str = "gemini"
    AI_MODEL: str = GEMINI_MODEL
    AI_TEMPERATURE: float = 0.7
    AI_MAX_OUTPUT_TOKENS: int = 8192
    AI_MAX_RETRIES: int = 3
    AI_TIMEOUT_SECONDS: int = 30
    
    # Provider-specific keys
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    
    # Fallback keys (for backwards compatibility)
    AI_API_KEY: str = ""
    AI_BASE_URL: str = ""
    
    ALLOWED_USERS: str = ""
    
    DATA_DIR: str = "data"
    STORAGE_DIR: str = "storage"
    
    model_config = SettingsConfigDict(env_file=str(ENV_PATH), env_file_encoding='utf-8', extra='ignore')

    @property
    def parsed_users(self) -> Dict[str, str]:
        users = {}
        for user_str in self.ALLOWED_USERS.split(","):
            if ":" in user_str:
                username, password = user_str.split(":", 1)
                users[username.strip()] = password.strip()
        return users

settings = Settings()
settings.AI_PROVIDER = "gemini"
settings.AI_MODEL = GEMINI_MODEL
