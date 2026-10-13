from apps.api.models.topic_discovery import TopicDiscoveryRequest
from typing import Dict, Any

class KeywordBuilder:
    """
    Builds keyword context for the AI prompt based on the request.
    This abstraction allows future phases to pull from a DB of rotating keywords.
    """
    
    def build_context(
        self, 
        request: TopicDiscoveryRequest
    ) -> Dict[str, Any]:
        
        # Simulated rotating keywords (can be loaded from Excel in the future)
        rotating_keywords = []
        if request.age_min <= 5:
            rotating_keywords.extend(["Play", "Colors", "Shapes"])
        elif request.age_min >= 10:
            rotating_keywords.extend(["Analysis", "Experiment", "Real-world"])
            
        learner_context = []
        if request.country_context:
            learner_context.append(request.country_context)
            
        user_keywords = getattr(request, 'keywords', [])
        
        return {
            "core_keywords": [],
            "rotating_keywords": rotating_keywords,
            "user_keywords": user_keywords,
            "learner_context": learner_context
        }
