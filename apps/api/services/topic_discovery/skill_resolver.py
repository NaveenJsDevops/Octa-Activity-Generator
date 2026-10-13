import re
from typing import List, Optional, Tuple, Dict
from apps.api.models.domain import Skill, SubSkill

class SkillResolver:
    """
    Resolves AI-suggested skill and sub-skill names against existing master data.
    """
    def __init__(self, existing_skills: List[Skill], existing_sub_skills: List[SubSkill]):
        self.skills = existing_skills
        self.sub_skills = existing_sub_skills
        
        # Build normalization maps
        self.skill_map = {self._normalize(s.name): s for s in self.skills}
        self.sub_skill_map = {self._normalize(s.name): s for s in self.sub_skills}

    def _normalize(self, text: str) -> str:
        if not text:
            return ""
        # Lowercase, replace non-alphanumeric with spaces, collapse spaces, strip
        text = text.lower()
        text = re.sub(r'[^a-z0-9]', ' ', text)
        return ' '.join(text.split())

    def resolve_skills(self, suggested_names: List[str]) -> List[Skill]:
        """Returns the list of matching existing Skills."""
        resolved = []
        for name in suggested_names:
            norm = self._normalize(name)
            if norm in self.skill_map:
                resolved.append(self.skill_map[norm])
        return resolved

    def resolve_sub_skills(self, suggested_names: List[str]) -> List[SubSkill]:
        """Returns the list of matching existing SubSkills."""
        resolved = []
        for name in suggested_names:
            norm = self._normalize(name)
            if norm in self.sub_skill_map:
                resolved.append(self.sub_skill_map[norm])
        return resolved
