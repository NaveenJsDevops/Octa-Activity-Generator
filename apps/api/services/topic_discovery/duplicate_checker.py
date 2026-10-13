import re
from typing import List, Optional, Set
from apps.api.models.domain import Topic
from apps.api.models.topic_discovery import DuplicateCheckResult, TopicCandidate

class DuplicateChecker:
    def __init__(self, existing_topics: List[Topic]):
        self.existing_topics = existing_topics
        # Build normalized map of existing topics
        self.existing_map = {
            self._normalize(t.topic): t for t in self.existing_topics
        }
        
    def _normalize(self, text: str) -> str:
        if not text:
            return ""
        text = text.lower()
        text = re.sub(r'[^a-z0-9]', ' ', text)
        return ' '.join(text.split())
        
    def _get_lexical_set(self, text: str) -> Set[str]:
        # Exclude common stop words for basic lexical check
        stop_words = {"a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
        words = self._normalize(text).split()
        return {w for w in words if w not in stop_words and len(w) > 2}
        
    def _jaccard_similarity(self, set1: Set[str], set2: Set[str]) -> float:
        if not set1 and not set2:
            return 1.0
        if not set1 or not set2:
            return 0.0
        intersection = set1.intersection(set2)
        union = set1.union(set2)
        return len(intersection) / len(union)

    def check_candidate(self, candidate: TopicCandidate, accepted_topics: List[Topic]) -> DuplicateCheckResult:
        cand_norm = self._normalize(candidate.topic)
        cand_lex = self._get_lexical_set(candidate.topic)
        
        # 1. Exact Match against existing topics
        if cand_norm in self.existing_map:
            return DuplicateCheckResult(
                is_duplicate=True,
                matched_topic_id=self.existing_map[cand_norm].topic_id,
                similarity_type="EXACT",
                reason=f"Exact match with existing topic '{self.existing_map[cand_norm].topic}'"
            )
            
        # 2. Exact Match against newly accepted candidates
        for accepted in accepted_topics:
            if cand_norm == self._normalize(accepted.topic):
                return DuplicateCheckResult(
                    is_duplicate=True,
                    similarity_type="EXACT_CANDIDATE",
                    reason=f"Exact match with newly generated candidate '{accepted.topic}'"
                )

        # 3. Lexical Similarity against existing topics
        for existing in self.existing_topics:
            ext_lex = self._get_lexical_set(existing.topic)
            if self._jaccard_similarity(cand_lex, ext_lex) > 0.6:
                return DuplicateCheckResult(
                    is_duplicate=True,
                    matched_topic_id=existing.topic_id,
                    similarity_type="LEXICAL",
                    reason=f"High lexical similarity with existing topic '{existing.topic}'"
                )

        # 4. Lexical Similarity against accepted candidates
        for accepted in accepted_topics:
            acc_lex = self._get_lexical_set(accepted.topic)
            if self._jaccard_similarity(cand_lex, acc_lex) > 0.6:
                return DuplicateCheckResult(
                    is_duplicate=True,
                    similarity_type="LEXICAL_CANDIDATE",
                    reason=f"High lexical similarity with newly generated candidate '{accepted.topic}'"
                )

        return DuplicateCheckResult(is_duplicate=False)
