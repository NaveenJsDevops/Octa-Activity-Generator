import re
from typing import List, Optional, Tuple, Dict
from apps.api.models.domain import Skill, SubSkill

VALID_INTELLIGENCES = [
    "Artistic",
    "Arithmetic",
    "Communication",
    "Cognitive",
    "Creative",
    "Emotional",
    "Environmental",
    "Social",
]

class SkillResolver:
    """
    Resolves, validates, and normalizes AI-suggested intelligence, skill, and sub-skill names
    strictly against the official master data catalogue.
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
        text = text.lower()
        text = re.sub(r'[^a-z0-9]', ' ', text)
        return ' '.join(text.split())

    def resolve_intelligence(self, suggested: Optional[str]) -> Optional[str]:
        """Validates that suggested intelligence is strictly one of the 8 official Intelligences."""
        if not suggested or not suggested.strip():
            return None
        norm = self._normalize(suggested)
        for valid in VALID_INTELLIGENCES:
            valid_norm = self._normalize(valid)
            if valid_norm == norm or valid_norm in norm or norm in valid_norm:
                return valid
        return None

    def resolve_skill_names(self, suggested_names: List[str]) -> List[str]:
        """Resolves suggested names to canonical master data skill names."""
        resolved = []
        for name in suggested_names:
            norm = self._normalize(name)
            if norm in self.skill_map:
                canon = self.skill_map[norm].name
                if canon not in resolved:
                    resolved.append(canon)
            else:
                # Check substring match
                for k, s in self.skill_map.items():
                    if k in norm or norm in k:
                        if s.name not in resolved:
                            resolved.append(s.name)
                        break
        return resolved

    def resolve_sub_skill_names(self, suggested_names: List[str]) -> List[str]:
        """Resolves suggested names to canonical master data sub-skill names."""
        resolved = []
        for name in suggested_names:
            norm = self._normalize(name)
            if norm in self.sub_skill_map:
                canon = self.sub_skill_map[norm].name
                if canon not in resolved:
                    resolved.append(canon)
            else:
                for k, ss in self.sub_skill_map.items():
                    if k in norm or norm in k:
                        if ss.name not in resolved:
                            resolved.append(ss.name)
                        break
        return resolved

    def resolve_skills(self, suggested_names: List[str]) -> List[Skill]:
        """Returns the list of matching existing Skill domain objects."""
        resolved = []
        for name in suggested_names:
            norm = self._normalize(name)
            if norm in self.skill_map:
                resolved.append(self.skill_map[norm])
        return resolved

    def resolve_sub_skills(self, suggested_names: List[str]) -> List[SubSkill]:
        """Returns the list of matching existing SubSkill domain objects."""
        resolved = []
        for name in suggested_names:
            norm = self._normalize(name)
            if norm in self.sub_skill_map:
                resolved.append(self.sub_skill_map[norm])
        return resolved

    def infer_for_topic(
        self,
        topic_title: str,
        topic_family_name: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        description: Optional[str] = None,
    ) -> Tuple[str, List[str], List[str]]:
        """
        Infers canonical master data Intelligence, Skills, and Sub-skills for any topic
        based on its title, topic family, keywords, and description.
        """
        text = f"{topic_title} {topic_family_name or ''} {' '.join(keywords or [])} {description or ''}".lower()

        if any(w in text for w in ["nature", "environment", "monsoon", "ecosystem", "terrarium", "plant", "climate", "conservation", "biodiversity", "eco", "waste", "recycle"]):
            intel = "Environmental"
            skills = ["Eco-Awareness", "Observation"]
            sub_skills = ["Understanding Ecosystems", "Comparing Content & Context"]
        elif any(w in text for w in ["art", "craft", "drawing", "painting", "sculpt", "design", "creative art", "origami", "craftsmanship"]):
            intel = "Artistic"
            skills = ["Artistic Expression", "Craftsmanship"]
            sub_skills = ["Exploring Visual Art Techniques", "Analyzing Elements of Artwork"]
        elif any(w in text for w in ["math", "number", "calculate", "budget", "finance", "data", "chart", "graph", "arithmetic", "fraction"]):
            intel = "Arithmetic"
            skills = ["Mathematical Thinking & Calculations", "Data Analysis"]
            sub_skills = ["Problem Solving with Numbers", "Graphing and Charting"]
        elif any(w in text for w in ["story", "writing", "speak", "speech", "poem", "dialogue", "listen", "language", "communication", "essay"]):
            intel = "Communication"
            skills = ["Verbal Expression", "Written Expression"]
            sub_skills = ["Structuring a Story", "Organizing Information for Clarity"]
        elif any(w in text for w in ["emotion", "feeling", "mindful", "stress", "calm", "self", "confidence", "motivation", "awareness"]):
            intel = "Emotional"
            skills = ["Self-Awareness", "Mindfulness"]
            sub_skills = ["Reflecting on Personal Experiences", "Present Moment Awareness"]
        elif any(w in text for w in ["team", "community", "collaborate", "leader", "friend", "social", "society", "empathy", "culture"]):
            intel = "Social"
            skills = ["Collaboration", "Empathy"]
            sub_skills = ["Teamwork Strategies", "Perspective-Taking"]
        elif any(w in text for w in ["innovate", "invent", "imagine", "prototype", "fantasy", "creative"]):
            intel = "Creative"
            skills = ["Experimentation", "Imagination"]
            sub_skills = ["Hypothesis Testing", "World-Building"]
        else:
            intel = "Cognitive"
            skills = ["Critical Thinking", "Observation"]
            sub_skills = ["Analysis", "Pattern Recognition"]

        # Validate inferred values against available master data
        valid_intel = self.resolve_intelligence(intel) or "Cognitive"
        valid_skills = self.resolve_skill_names(skills) or skills
        valid_sub_skills = self.resolve_sub_skill_names(sub_skills) or sub_skills

        return valid_intel, valid_skills, valid_sub_skills
