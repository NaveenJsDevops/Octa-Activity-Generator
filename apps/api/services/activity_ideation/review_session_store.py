from datetime import datetime, timedelta
from threading import RLock
from typing import Dict, List, Optional
import uuid

SESSION_TTL_HOURS = 24
MAX_SESSIONS = 100


class ActivityReviewSession:
    def __init__(self, topic_id: str, result: dict):
        self.session_id = uuid.uuid4().hex
        self.topic_id = topic_id
        concepts = result["concepts"]
        self.concepts = {concept["concept_id"]: concept for concept in concepts}
        self.generated_count = result["generated_count"]
        self.duplicate_count = result["duplicate_count"]
        self.rejected_count = result["rejected_count"]
        self.rejected_candidates = result["rejected_candidates"]
        self.created_at = datetime.now()
        self.last_accessed_at = datetime.now()


class ActivityReviewSessionStore:
    _sessions: Dict[str, ActivityReviewSession] = {}
    _lock = RLock()

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
    def create(cls, topic_id: str, result: dict) -> ActivityReviewSession:
        with cls._lock:
            session = ActivityReviewSession(topic_id, result)
            cls._sessions[session.session_id] = session
            cls._prune_expired_and_excess()
            return session

    @classmethod
    def get(cls, session_id: str) -> Optional[ActivityReviewSession]:
        with cls._lock:
            cls._prune_expired_and_excess()
            session = cls._sessions.get(session_id)
            if session:
                session.last_accessed_at = datetime.now()
            return session

    @classmethod
    def remove(cls, session_id: str):
        with cls._lock:
            if session_id in cls._sessions:
                del cls._sessions[session_id]
