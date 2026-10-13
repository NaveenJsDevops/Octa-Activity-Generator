from enum import Enum

class TopicStatus(str, Enum):
    DRAFT = "DRAFT"
    REVIEW = "REVIEW"
    APPROVED = "APPROVED"
    SELECTED = "SELECTED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"

class ActivityStatus(str, Enum):
    DRAFT = "DRAFT"
    REVIEW = "REVIEW"
    APPROVED = "APPROVED"
    SELECTED = "SELECTED"
    PUBLISHED = "PUBLISHED"
    REJECTED = "REJECTED"
    ARCHIVED = "ARCHIVED"

class RelationshipType(str, Enum):
    PRIMARY = "PRIMARY"
    SECONDARY = "SECONDARY"

class ActivityPotential(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class GenerationStatus(str, Enum):
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class QualityStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    REVIEW_NEEDED = "REVIEW_NEEDED"
