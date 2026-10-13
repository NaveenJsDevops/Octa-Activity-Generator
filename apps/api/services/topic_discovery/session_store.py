import uuid
from typing import Dict, Any, List
from datetime import datetime

class DiscoverySession:
    def __init__(self, request: Any, candidates: List[Any], generation_id: str):
        self.session_id = str(uuid.uuid4())
        self.request = request
        self.candidates = candidates
        self.generation_id = generation_id
        self.created_at = datetime.now()

_sessions: Dict[str, DiscoverySession] = {}

class SessionStore:
    @staticmethod
    def create_session(request: Any, candidates: List[Any], generation_id: str) -> DiscoverySession:
        session = DiscoverySession(request, candidates, generation_id)
        _sessions[session.session_id] = session
        return session
        
    @staticmethod
    def get_session(session_id: str) -> DiscoverySession:
        return _sessions.get(session_id)
        
    @staticmethod
    def remove_session(session_id: str):
        if session_id in _sessions:
            del _sessions[session_id]
