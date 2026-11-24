"""
FirestoreRepository: Enterprise-grade Cloud Firestore repository for Octa AI Activity Platform.
Provides direct Cloud Firestore persistence, in-memory caching for sub-millisecond query performance,
and strict Pydantic model and relational reference validation.
"""
import copy
from datetime import date, datetime
from enum import Enum
import json
import logging
import os
from threading import RLock
from typing import Any, Dict, List, Optional, Set, Tuple, TypeVar

from pydantic import BaseModel, ValidationError

from apps.api.models.domain import (
    Activity,
    ActivityConcept,
    ActivitySkill,
    ActivityType,
    ActivityVersion,
    GenerationRun,
    Intelligence,
    QualityCheck,
    Skill,
    SubSkill,
    Topic,
    TopicFamily,
    TopicKeyword,
    TopicReviewHistory,
    TopicSkill,
    TopicSource,
    TopicVersion,
)
from apps.api.core.config import settings
from apps.api.core.firestore import firestore_manager

logger = logging.getLogger("octa.repository")
T = TypeVar("T", bound=BaseModel)

COLLECTION_MAPPING: Dict[str, Tuple[str, type[BaseModel], Optional[str]]] = {
    "Intelligences": ("intelligences", Intelligence, "intelligence_id"),
    "Skills": ("skills", Skill, "skill_id"),
    "SubSkills": ("sub_skills", SubSkill, "sub_skill_id"),
    "TopicFamilies": ("topic_families", TopicFamily, "topic_family_id"),
    "ActivityTypes": ("activity_types", ActivityType, "activity_type_id"),
    "Topics": ("topics", Topic, "topic_id"),
    "TopicSkills": ("topic_skills", TopicSkill, None),
    "TopicKeywords": ("topic_keywords", TopicKeyword, None),
    "TopicSources": ("topic_sources", TopicSource, "source_id"),
    "TopicReviewHistory": ("topic_review_history", TopicReviewHistory, "review_id"),
    "TopicVersions": ("topic_versions", TopicVersion, "version_id"),
    "ActivityConcepts": ("activity_concepts", ActivityConcept, "concept_id"),
    "Activities": ("activities", Activity, "activity_id"),
    "ActivitySkills": ("activity_skills", ActivitySkill, None),
    "ActivityVersions": ("activity_versions", ActivityVersion, "version_id"),
    "QualityChecks": ("quality_checks", QualityCheck, "quality_check_id"),
    "GenerationRuns": ("generation_runs", GenerationRun, "generation_id"),
}

# Compatibility alias
WORKBOOK_MAPPING = COLLECTION_MAPPING


class FirestoreRepository:
    _storage_by_dir: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
    _loaded_dirs: Set[str] = set()
    _lock = RLock()

    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = str(data_dir or "data")
        # Check if running in isolated test mode (production always connects and warms from Firestore)
        is_prod = (
            (os.getenv("ENVIRONMENT") or "").lower() == "production"
            or getattr(settings, "ENVIRONMENT", "").lower() == "production"
        )
        if is_prod:
            self._is_isolated_test = False
        else:
            self._is_isolated_test = bool(
                os.getenv("PYTEST_CURRENT_TEST")
                or os.getenv("TESTING") == "1"
                or (self.data_dir != "data" and not self.data_dir.endswith("/data"))
                or any(part in self.data_dir.lower() for part in ["tmp", "temp", "pytest", "var/folders"])
            )

        with FirestoreRepository._lock:
            if self.data_dir not in FirestoreRepository._storage_by_dir:
                FirestoreRepository._storage_by_dir[self.data_dir] = {name: [] for name in COLLECTION_MAPPING}

            self._storage = FirestoreRepository._storage_by_dir[self.data_dir]

            # In production, initial load is triggered asynchronously by lifespan to prevent port-binding blockage
            if (
                not is_prod
                and not self._is_isolated_test
                and self.data_dir not in FirestoreRepository._loaded_dirs
                and firestore_manager.is_available
            ):
                self._load_from_firestore()
                FirestoreRepository._loaded_dirs.add(self.data_dir)

    ESSENTIAL_COLLECTIONS = [
        "Intelligences",
        "Skills",
        "SubSkills",
        "TopicFamilies",
        "ActivityTypes",
        "Topics",
        "TopicSkills",
        "TopicVersions",
        "Activities",
        "ActivitySkills",
        "ActivityVersions",
    ]

    def _load_from_firestore(self):
        """Loads essential collections from Cloud Firestore into in-memory storage."""
        logger.info("Initializing in-memory cache from Cloud Firestore...")
        for sheet_name in self.ESSENTIAL_COLLECTIONS:
            if sheet_name not in COLLECTION_MAPPING:
                continue
            _, model_class, _ = COLLECTION_MAPPING[sheet_name]
            docs = firestore_manager.fetch_collection(sheet_name)
            valid_records = []
            for doc in docs:
                try:
                    decoded = self._decode_record(model_class, doc)
                    validated = model_class(**decoded).model_dump(mode="json")
                    valid_records.append(validated)
                except Exception as e:
                    logger.debug(f"Skipping corrupt document in {sheet_name}: {e}")
            self._storage[sheet_name] = valid_records
        logger.info("In-memory cache warmed up from Cloud Firestore.")

    def reload_from_firestore(self):
        """Forces a reload of all collections from Cloud Firestore."""
        with FirestoreRepository._lock:
            self._load_from_firestore()

    def initialize_workbooks(self):
        """Initializes collections and storage."""
        with FirestoreRepository._lock:
            for sheet_name in COLLECTION_MAPPING:
                if sheet_name not in self._storage:
                    self._storage[sheet_name] = []

    def initialize_database(self):
        """Alias for modern database initialization."""
        self.initialize_workbooks()

    def _json_field_names(self, model_class: type[BaseModel]) -> Set[str]:
        if model_class is ActivityConcept:
            return {"materials", "instructions", "pre_activity", "main_activity", "post_activity"}
        if model_class is Activity:
            return {"materials", "pre_activity", "main_activity", "post_activity"}
        return set()

    def _decode_record(self, model_class: type[BaseModel], record: Dict[str, Any]) -> Dict[str, Any]:
        json_fields = self._json_field_names(model_class)
        decoded = {}
        for k, v in record.items():
            if isinstance(v, str) and k in json_fields:
                stripped = v.strip()
                if (stripped.startswith("{") and stripped.endswith("}")) or (stripped.startswith("[") and stripped.endswith("]")):
                    try:
                        decoded[k] = json.loads(stripped)
                        continue
                    except Exception:
                        pass
            decoded[k] = v
        return decoded

    def validate_references(
        self,
        sheet_name: str,
        data: Dict[str, Any],
        staged_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    ):
        if sheet_name not in COLLECTION_MAPPING:
            raise ValueError(f"Unknown collection {sheet_name}")

        _, _, id_field = COLLECTION_MAPPING[sheet_name]
        staged_records = staged_records or {}

        if "topic_family_id" in data and data["topic_family_id"] is not None and id_field != "topic_family_id":
            families = self.read_sheet("TopicFamilies")
            staged_families = staged_records.get("TopicFamilies", [])
            if not any(f["topic_family_id"] == data["topic_family_id"] for f in families + staged_families):
                raise ValueError(f"topic_family_id {data['topic_family_id']} does not exist")

        skill_id = data.get("skill_id") or data.get("primary_skill_id")
        if skill_id is not None and id_field != "skill_id":
            skills = self.read_sheet("Skills")
            staged_skills = staged_records.get("Skills", [])
            if not any(s["skill_id"] == skill_id for s in skills + staged_skills):
                raise ValueError(f"skill_id {skill_id} does not exist")

        sub_skill_id = data.get("sub_skill_id") or data.get("primary_sub_skill_id")
        if sub_skill_id is not None and id_field != "sub_skill_id":
            sub_skills = self.read_sheet("SubSkills")
            staged_sub_skills = staged_records.get("SubSkills", [])
            all_sub_skills = sub_skills + staged_sub_skills
            matching_sub_skill = next((skill for skill in all_sub_skills if skill["sub_skill_id"] == sub_skill_id), None)
            if not matching_sub_skill:
                raise ValueError(f"sub_skill_id {sub_skill_id} does not exist")
            if skill_id is not None and matching_sub_skill["skill_id"] != skill_id:
                raise ValueError(f"sub_skill_id {sub_skill_id} does not belong to skill_id {skill_id}")

        if data.get("activity_type_id") is not None and id_field != "activity_type_id":
            activity_types = self.read_sheet("ActivityTypes")
            staged_types = staged_records.get("ActivityTypes", [])
            if not any(a["activity_type_id"] == data["activity_type_id"] for a in activity_types + staged_types):
                raise ValueError(f"activity_type_id {data['activity_type_id']} does not exist")

        if data.get("topic_id") is not None and sheet_name in {"ActivityConcepts", "Activities"}:
            topics = self.read_sheet("Topics")
            staged_topics = staged_records.get("Topics", [])
            if not any(topic["topic_id"] == data["topic_id"] for topic in topics + staged_topics):
                raise ValueError(f"topic_id {data['topic_id']} does not exist")

        if sheet_name == "Activities":
            concept_ids = {concept["concept_id"] for concept in self.read_sheet("ActivityConcepts")}
            concept_ids.update(concept["concept_id"] for concept in staged_records.get("ActivityConcepts", []))
            if data.get("concept_id") not in concept_ids:
                raise ValueError(f"concept_id {data.get('concept_id')} does not exist")

        if sheet_name == "ActivitySkills":
            activity_ids = {activity["activity_id"] for activity in self.read_sheet("Activities")}
            activity_ids.update(activity["activity_id"] for activity in staged_records.get("Activities", []))
            if data.get("activity_id") not in activity_ids:
                raise ValueError(f"activity_id {data.get('activity_id')} does not exist")

    def read_sheet(self, sheet_name: str) -> List[Dict[str, Any]]:
        """Reads all records from the collection."""
        if sheet_name not in COLLECTION_MAPPING:
            raise ValueError(f"Unknown collection {sheet_name}")

        with FirestoreRepository._lock:
            records = self._storage.get(sheet_name, [])
            return copy.deepcopy(records)

    def read_collection(self, collection_name: str) -> List[Dict[str, Any]]:
        """Alias for read_sheet."""
        return self.read_sheet(collection_name)

    def append_record(self, sheet_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Validates, stores in memory, and persists to Cloud Firestore."""
        if sheet_name not in COLLECTION_MAPPING:
            raise ValueError(f"Unknown collection {sheet_name}")

        _, model_class, id_field = COLLECTION_MAPPING[sheet_name]
        try:
            decoded = self._decode_record(model_class, data)
            validated = model_class(**decoded).model_dump(mode="json")
        except ValidationError as exc:
            raise ValueError(f"Validation error: {exc}") from exc

        self.validate_references(sheet_name, validated)

        with FirestoreRepository._lock:
            records = self._storage.setdefault(sheet_name, [])
            if id_field and id_field in validated:
                new_id = validated[id_field]
                if any(r.get(id_field) == new_id for r in records):
                    raise ValueError(f"Record with {id_field}={new_id} already exists")

            records.append(copy.deepcopy(validated))

        # Persist to Cloud Firestore if not in isolated test mode
        if not self._is_isolated_test and firestore_manager.is_available:
            try:
                firestore_manager.save_record(sheet_name, validated)
            except Exception as e:
                logger.error(f"Failed to persist {sheet_name} to Firestore: {e}")

        return validated

    def update_record(self, sheet_name: str, id_value: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Updates record in memory and in Cloud Firestore."""
        if sheet_name not in COLLECTION_MAPPING:
            raise ValueError(f"Unknown collection {sheet_name}")

        _, model_class, id_field = COLLECTION_MAPPING[sheet_name]
        if not id_field:
            raise ValueError(f"Collection {sheet_name} does not have a primary ID field defined for updates")

        with FirestoreRepository._lock:
            records = self._storage.get(sheet_name, [])
            record_idx = next((idx for idx, record in enumerate(records) if record.get(id_field) == id_value), None)
            if record_idx is None:
                raise ValueError(f"Record with {id_field}={id_value} not found")

            existing_record = records[record_idx]
            merged_data = {**existing_record, **update_data}
            try:
                decoded = self._decode_record(model_class, merged_data)
                validated = model_class(**decoded).model_dump(mode="json")
            except ValidationError as exc:
                raise ValueError(f"Validation error on update: {exc}") from exc

            self.validate_references(sheet_name, validated)
            records[record_idx] = copy.deepcopy(validated)

        # Update in Cloud Firestore if not in isolated test mode
        if not self._is_isolated_test and firestore_manager.is_available:
            try:
                firestore_manager.update_record(sheet_name, id_value, validated)
            except Exception as e:
                logger.error(f"Failed to update {sheet_name} in Firestore: {e}")

        return validated

    def find_records(self, sheet_name: str, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Filters records matching criteria."""
        records = self.read_sheet(sheet_name)
        results = []
        for record in records:
            matches = True
            for key, value in criteria.items():
                if record.get(key) != value:
                    matches = False
                    break
            if matches:
                results.append(record)
        return results

    def delete_record(self, sheet_name: str, id_value: str) -> bool:
        """Deletes record by primary ID."""
        if sheet_name not in COLLECTION_MAPPING:
            raise ValueError(f"Unknown collection {sheet_name}")

        _, _, id_field = COLLECTION_MAPPING[sheet_name]
        if not id_field:
            raise ValueError(f"Collection {sheet_name} does not have a primary ID field defined for deletions")

        found = False
        with FirestoreRepository._lock:
            records = self._storage.get(sheet_name, [])
            new_records = [r for r in records if r.get(id_field) != id_value]
            if len(new_records) < len(records):
                found = True
                self._storage[sheet_name] = new_records

        if found and not self._is_isolated_test and firestore_manager.is_available:
            try:
                firestore_manager.delete_record(sheet_name, id_value)
            except Exception as e:
                logger.error(f"Failed to delete {sheet_name}/{id_value} in Firestore: {e}")

        return found

    def delete_records_by(self, sheet_name: str, criteria: Dict[str, Any]) -> int:
        """Deletes all records matching criteria."""
        if sheet_name not in COLLECTION_MAPPING:
            raise ValueError(f"Unknown collection {sheet_name}")

        deleted_count = 0
        with FirestoreRepository._lock:
            records = self._storage.get(sheet_name, [])
            retained = []
            for record in records:
                matches = True
                for key, value in criteria.items():
                    if record.get(key) != value:
                        matches = False
                        break
                if matches:
                    deleted_count += 1
                else:
                    retained.append(record)
            self._storage[sheet_name] = retained

        if deleted_count > 0 and not self._is_isolated_test and firestore_manager.is_available:
            try:
                firestore_manager.delete_records_by(sheet_name, criteria)
            except Exception as e:
                logger.error(f"Failed to delete records in Firestore: {e}")

        return deleted_count

    def append_records_atomic(self, entries: List[Tuple[str, Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Atomically validates and appends multiple records across collections."""
        with FirestoreRepository._lock:
            if not entries:
                return []

            staged: Dict[str, List[Dict[str, Any]]] = {}
            validated_entries: List[Tuple[str, Dict[str, Any]]] = []

            for sheet_name, data in entries:
                if sheet_name not in COLLECTION_MAPPING:
                    raise ValueError(f"Unknown collection {sheet_name}")

                _, model_class, id_field = COLLECTION_MAPPING[sheet_name]
                try:
                    decoded = self._decode_record(model_class, data)
                    validated = model_class(**decoded).model_dump(mode="json")
                except ValidationError as exc:
                    raise ValueError(f"Validation error: {exc}") from exc

                self.validate_references(sheet_name, validated, staged)

                if sheet_name == "Activities":
                    existing_concept_ids = {record["concept_id"] for record in self.read_sheet("Activities")}
                    staged_concept_ids = {record["concept_id"] for record in staged.get("Activities", [])}
                    if validated["concept_id"] in existing_concept_ids | staged_concept_ids:
                        raise ValueError(f"Activity for concept_id={validated['concept_id']} already exists")

                if id_field:
                    existing_ids = {record.get(id_field) for record in self.read_sheet(sheet_name)}
                    staged_ids = {record.get(id_field) for record in staged.get(sheet_name, [])}
                    new_id = validated.get(id_field)
                    if new_id in existing_ids or new_id in staged_ids:
                        raise ValueError(f"Record with {id_field}={new_id} already exists")

                staged.setdefault(sheet_name, []).append(validated)
                validated_entries.append((sheet_name, validated))

            # If Cloud Firestore is connected and not in isolated test, commit to Firestore first
            if not self._is_isolated_test and firestore_manager.is_available:
                try:
                    firestore_manager.save_records_batch(validated_entries, async_mode=False)
                except Exception as e:
                    logger.error(f"Failed to batch commit to Firestore: {e}")
                    raise RuntimeError(f"Cloud Firestore persistence failed, transaction aborted: {e}") from e

            # Once Firestore succeeds (or in test mode), commit all validated entries to in-memory storage
            for sheet_name, record in validated_entries:
                self._storage.setdefault(sheet_name, []).append(copy.deepcopy(record))

        return [record for _, record in validated_entries]


# Aliases for backward compatibility
DatabaseRepository = FirestoreRepository

__all__ = ["FirestoreRepository", "DatabaseRepository", "COLLECTION_MAPPING", "WORKBOOK_MAPPING"]
