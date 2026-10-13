from typing import List
from apps.api.models.domain import ActivityConcept
from .diversity_checker import ActivityDiversityChecker

class DuplicateChecker:
    def __init__(self, existing_concepts: List[ActivityConcept], existing_activities: List[dict] | None = None):
        self.existing_texts = [
            f"{c.activity_title} {c.activity_concept} {c.learner_task} {c.expected_output}"
            for c in existing_concepts
        ]
        self.existing_texts.extend(
            f"{activity['title']} {activity['description']} {activity['instructions']} {activity['expected_output']}"
            for activity in existing_activities or []
        )
        self.diversity_checker = ActivityDiversityChecker(threshold=0.45)
        
    def add_to_batch(self, concept_text: str):
        self.existing_texts.append(concept_text)
        
    def is_duplicate(self, title: str, concept: str, task: str, output: str) -> bool:
        # Check against existing texts and current batch
        combined_text = f"{title} {concept} {task} {output}"
        
        # Simple exact title match (normalization could be added)
        # Note: Title exact match is strong evidence
        # but we also do the diversity check
        return self.diversity_checker.is_too_similar(combined_text, self.existing_texts)
