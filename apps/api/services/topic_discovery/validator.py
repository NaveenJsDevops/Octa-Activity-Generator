from typing import Tuple, Optional
from apps.api.models.topic_discovery import TopicCandidate, TopicDiscoveryRequest

class TopicValidator:
    """
    Validates AI-generated topic candidates against strict business rules.
    """
    
    # Controlled vocabulary for activity potential
    VALID_ACTIVITY_POTENTIAL = {"HIGH", "MEDIUM", "LOW"}
    
    def validate(
        self, 
        candidate: TopicCandidate, 
        request: TopicDiscoveryRequest
    ) -> Tuple[bool, Optional[str]]:
        """Returns (is_valid, error_reason)"""
        
        # 1. Required content
        if not candidate.topic or len(candidate.topic.strip()) < 3:
            return False, "Topic title is missing or too short."
        if not candidate.short_description or len(candidate.short_description.strip()) < 10:
            return False, "Short description is missing or insufficient."
        if not candidate.full_description or len(candidate.full_description.strip()) < 10:
            return False, "Full description is missing or insufficient."
            
        # 2. Activity Potential
        pot = candidate.activity_potential.upper().strip()
            
        if pot not in self.VALID_ACTIVITY_POTENTIAL:
            return False, (
                f"Candidate:\n{candidate.topic}\n\n"
                f"Reason:\nInvalid activity potential\n\n"
                f"Received:\n{candidate.activity_potential}\n\n"
                f"Expected:\nHIGH / MEDIUM / LOW"
            )
            
        return True, None
