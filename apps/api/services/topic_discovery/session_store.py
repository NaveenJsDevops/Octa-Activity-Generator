import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from threading import RLock

SESSION_TTL_HOURS = 24
MAX_SESSIONS = 100

class DiscoverySession:
    def __init__(self, request: Any, candidates: List[Any], generation_id: str):
        self.session_id = str(uuid.uuid4())
        self.request = request
        self.candidates = candidates
        self.generation_id = generation_id
        self.created_at = datetime.now()
        self.last_accessed_at = datetime.now()

class SessionStore:
    _sessions: Dict[str, DiscoverySession] = {}
    _lock: RLock = RLock()

    @classmethod
    def _prune_expired_and_excess(cls):
        """Evicts sessions older than 24h or in excess of MAX_SESSIONS."""
        now = datetime.now()
        ttl_cutoff = now - timedelta(hours=SESSION_TTL_HOURS)

        # 1. Prune expired
        expired_keys = [
            sid for sid, sess in cls._sessions.items()
            if sess.created_at < ttl_cutoff
        ]
        for sid in expired_keys:
            del cls._sessions[sid]

        # 2. Prune excess beyond MAX_SESSIONS (oldest first)
        if len(cls._sessions) > MAX_SESSIONS:
            sorted_by_accessed = sorted(
                cls._sessions.items(),
                key=lambda item: item[1].last_accessed_at
            )
            excess_count = len(cls._sessions) - MAX_SESSIONS
            for i in range(excess_count):
                sid_to_remove = sorted_by_accessed[i][0]
                if sid_to_remove in cls._sessions:
                    del cls._sessions[sid_to_remove]

    @classmethod
    def create_session(cls, request: Any, candidates: List[Any], generation_id: str) -> DiscoverySession:
        with cls._lock:
            session = DiscoverySession(request, candidates, generation_id)
            cls._sessions[session.session_id] = session
            cls._prune_expired_and_excess()
            return session

    @classmethod
    def get_session(cls, session_id: str) -> Optional[DiscoverySession]:
        with cls._lock:
            cls._prune_expired_and_excess()
            session = cls._sessions.get(session_id)
            if session:
                session.last_accessed_at = datetime.now()
            return session

    @classmethod
    def remove_session(cls, session_id: str):
        with cls._lock:
            if session_id in cls._sessions:
                del cls._sessions[session_id]
