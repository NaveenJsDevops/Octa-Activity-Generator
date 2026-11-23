from apps.api.models.topic_discovery import TopicDiscoveryRequest
from typing import Dict, Any, Optional

class KeywordBuilder:
    """
    Builds keyword context for the AI prompt based on the request.
    This abstraction allows future phases to pull from a DB of rotating keywords.
    """
    
    def build_context(
        self, 
        request: TopicDiscoveryRequest,
        intelligence_name: Optional[str] = None,
        skill_name: Optional[str] = None,
        sub_skill_name: Optional[str] = None
    ) -> Dict[str, Any]:
        
        # Simulated rotating keywords (can be loaded from Cloud Firestore in the future)
        rotating_keywords = []
        if request.age_min <= 5:
            rotating_keywords.extend(["Play", "Colors", "Shapes"])
        elif request.age_min >= 10:
            rotating_keywords.extend(["Analysis", "Experiment", "Real-world"])
            
        learner_context = []
        if request.country_context:
            learner_context.append(request.country_context)
            
        user_keywords = list(getattr(request, 'keywords', []))
        
        # Add intelligence, skill, sub-skill names into keywords if available
        if sub_skill_name and sub_skill_name not in user_keywords:
            user_keywords.append(sub_skill_name)
        elif skill_name and skill_name not in user_keywords:
            user_keywords.append(skill_name)
        elif intelligence_name and intelligence_name not in user_keywords:
            user_keywords.append(intelligence_name)
        
        skill_context = {}
        if getattr(request, 'intelligence_id', None) or intelligence_name:
            skill_context["intelligence_id"] = getattr(request, 'intelligence_id', None)
            skill_context["intelligence_name"] = intelligence_name
        if getattr(request, 'skill_id', None) or skill_name:
            skill_context["skill_id"] = getattr(request, 'skill_id', None)
            skill_context["skill_name"] = skill_name
        if getattr(request, 'sub_skill_id', None) or sub_skill_name:
            skill_context["sub_skill_id"] = getattr(request, 'sub_skill_id', None)
            skill_context["sub_skill_name"] = sub_skill_name

        return {
            "core_keywords": [],
            "rotating_keywords": rotating_keywords,
            "user_keywords": user_keywords,
            "learner_context": learner_context,
            "skill_context": skill_context
        }
