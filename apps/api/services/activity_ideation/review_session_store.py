from datetime import datetime
from threading import RLock
from typing import Dict, List, Optional
import uuid


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


class ActivityReviewSessionStore:
    _sessions: Dict[str, ActivityReviewSession] = {}
    _lock = RLock()

    @classmethod
    def create(cls, topic_id: str, result: dict) -> ActivityReviewSession:
        session = ActivityReviewSession(topic_id, result)
        with cls._lock:
            cls._sessions[session.session_id] = session
        return session

    @classmethod
    def get(cls, session_id: str) -> Optional[ActivityReviewSession]:
        with cls._lock:
            return cls._sessions.get(session_id)
