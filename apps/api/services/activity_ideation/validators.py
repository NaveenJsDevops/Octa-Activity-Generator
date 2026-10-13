from typing import List, Optional, Tuple, Dict, Any
from apps.api.models.domain import Skill, SubSkill, ActivityType
from apps.api.models.activity_ideation import AIActivityConcept
import re

def _normalize_name(name: str) -> str:
    """Normalize string for robust matching."""
    name = re.sub(r'[^a-zA-Z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip().lower()

class MasterDataValidator:
    def __init__(
        self,
        skills: List[Dict[str, Any]],
        sub_skills: List[Dict[str, Any]],
        activity_types: List[Dict[str, Any]]
    ):
        self.skills = { _normalize_name(s["name"]): s for s in skills }
        self.sub_skills = { _normalize_name(s["name"]): s for s in sub_skills }
        self.activity_types = { _normalize_name(a["name"]): a for a in activity_types }
        
    def validate_activity_concept(self, concept: AIActivityConcept) -> Tuple[bool, Optional[str], Optional[Dict[str, str]]]:
        """
        Validates the AI candidate concept.
        Returns:
        (is_valid, rejection_reason, resolved_ids_dict)
        """
        # Validate required fields length
        if not concept.activity_title or len(concept.activity_title) < 3:
            return False, "Title is missing or too short", None
        if not concept.activity_concept or len(concept.activity_concept) < 10:
            return False, "Concept description is too short", None
        if not concept.learner_task or len(concept.learner_task) < 10:
            return False, "Learner task is too short", None
        if not concept.expected_output or len(concept.expected_output) < 5:
            return False, "Expected output is too short", None

        resolved_ids = {}

        # Validate Activity Type
        at_norm = _normalize_name(concept.activity_type)
        if at_norm not in self.activity_types:
            return False, f"Unknown activity type: '{concept.activity_type}'", None
        resolved_ids["activity_type_id"] = self.activity_types[at_norm]["activity_type_id"]

        # Skill mappings are optional when the topic has no supported mapping.
        if concept.primary_skill or concept.primary_sub_skill:
            if not concept.primary_skill or not concept.primary_sub_skill:
                return False, "Primary skill and sub-skill must be provided together", None

            sk_norm = _normalize_name(concept.primary_skill)
            if sk_norm not in self.skills:
                return False, f"Unknown primary skill: '{concept.primary_skill}'", None
            resolved_ids["primary_skill_id"] = self.skills[sk_norm]["skill_id"]

            ssk_norm = _normalize_name(concept.primary_sub_skill)
            if ssk_norm not in self.sub_skills:
                return False, f"Unknown primary sub-skill: '{concept.primary_sub_skill}'", None
            resolved_ids["primary_sub_skill_id"] = self.sub_skills[ssk_norm]["sub_skill_id"]

            if self.sub_skills[ssk_norm]["skill_id"] != resolved_ids["primary_skill_id"]:
                return False, f"Sub-skill '{concept.primary_sub_skill}' does not belong to skill '{concept.primary_skill}'", None
            
        return True, None, resolved_ids
