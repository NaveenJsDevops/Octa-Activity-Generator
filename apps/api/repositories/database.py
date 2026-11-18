"""
Database Repository Module.
Re-exports FirestoreRepository for modern Cloud Firestore persistence.
"""
from apps.api.repositories.firestore import (
    FirestoreRepository,
    DatabaseRepository,
    COLLECTION_MAPPING,
    WORKBOOK_MAPPING,
)

__all__ = [
    "FirestoreRepository",
    "DatabaseRepository",
    "COLLECTION_MAPPING",
    "WORKBOOK_MAPPING",
]
