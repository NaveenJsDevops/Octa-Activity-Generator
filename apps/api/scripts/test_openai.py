import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from apps.api.services.ai.providers.openai_provider import OpenAIProvider
from apps.api.services.ai.models import GenerationContext
from pydantic import BaseModel

class ConnectivityTestResponse(BaseModel):
    message: str
    status: str

async def run_test():
    try:
        provider = OpenAIProvider()
        print("Testing real OpenAI connection...")
        response = provider.generate_structured(
            prompt="Respond with a JSON object where message is 'Hello world' and status is 'success'.",
            context=None,
            schema_model=ConnectivityTestResponse
        )
        
        print("API Key Accepted.")
        print(f"Tokens used: {response.input_tokens} in, {response.output_tokens} out")
        print(f"Content: {response.content}")
        
    except Exception as e:
        print(f"Connection Failed: {type(e).__name__} - {str(e)}")

if __name__ == "__main__":
    asyncio.run(run_test())
