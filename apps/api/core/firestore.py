import json
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("octa.firestore")

# Map repository sheet names to Firestore collection names and primary ID fields
COLLECTION_MAPPINGS: Dict[str, Tuple[str, Optional[str]]] = {
    "Intelligences": ("intelligences", "intelligence_id"),
    "Skills": ("skills", "skill_id"),
    "SubSkills": ("sub_skills", "sub_skill_id"),
    "TopicFamilies": ("topic_families", "topic_family_id"),
    "ActivityTypes": ("activity_types", "activity_type_id"),
    "Topics": ("topics", "topic_id"),
    "TopicSkills": ("topic_skills", None),
    "TopicKeywords": ("topic_keywords", None),
    "TopicSources": ("topic_sources", "source_id"),
    "TopicReviewHistory": ("topic_review_history", "review_id"),
    "ActivityConcepts": ("activity_concepts", "concept_id"),
    "Activities": ("activities", "activity_id"),
    "ActivitySkills": ("activity_skills", None),
    "ActivityVersions": ("activity_versions", "version_id"),
    "QualityChecks": ("quality_checks", "quality_check_id"),
    "GenerationRuns": ("generation_runs", "generation_id"),
}


class FirestoreManager:
    _instance: Optional["FirestoreManager"] = None
    _executor: ThreadPoolExecutor = ThreadPoolExecutor(max_workers=4)

    def __init__(self, key_path: Optional[str] = None):
        self.db = None
        self.project_id: Optional[str] = None
        self._initialized = False
        self._initialize(key_path)

    @classmethod
    def get_instance(cls) -> "FirestoreManager":
        if cls._instance is None:
            cls._instance = FirestoreManager()
        return cls._instance

    def _find_key_file(self, explicit_path: Optional[str] = None) -> Optional[str]:
        candidates = []
        if explicit_path:
            candidates.append(explicit_path)

        env_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
        if env_path:
            candidates.append(env_path)

        # Standard locations in repo
        candidates.extend([
            os.path.abspath("data/firebase-key.json"),
            os.path.abspath("apps/api/data/firebase-key.json"),
            os.path.join(os.path.dirname(__file__), "../data/firebase-key.json"),
            os.path.join(os.path.dirname(__file__), "../../data/firebase-key.json"),
        ])

        for path in candidates:
            if path and os.path.isfile(path):
                return os.path.abspath(path)
        return None

    def _initialize(self, key_path: Optional[str] = None):
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore

            cred = None
            # 1. Check raw JSON env variable (ideal for Render and cloud deployments)
            raw_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
            if raw_json and raw_json.strip():
                try:
                    cred_dict = json.loads(raw_json.strip())
                    cred = credentials.Certificate(cred_dict)
                    logger.info("Initializing Firebase Admin with FIREBASE_CREDENTIALS_JSON environment variable.")
                except Exception as e:
                    logger.warning(f"Failed to parse FIREBASE_CREDENTIALS_JSON: {e}")

            # 2. Check file candidates
            if cred is None:
                found_key = self._find_key_file(key_path)
                if not found_key:
                    logger.info("Firebase key file not found. Cloud Firestore integration will remain dormant.")
                    return
                cred = credentials.Certificate(found_key)
                logger.info(f"Initializing Firebase Admin with key file: {found_key}")

            try:
                try:
                    app = firebase_admin.get_app()
                except ValueError:
                    app = firebase_admin.initialize_app(cred)
                self.project_id = app.project_id
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase Admin app: {e}")
                return

            self.db = firestore.client()
            self._initialized = True
            logger.info(f"Cloud Firestore connected successfully for project '{self.project_id}'.")
        except ImportError:
            logger.warning("firebase_admin package is not installed. Firestore integration disabled.")
        except Exception as e:
            logger.error(f"Error connecting to Cloud Firestore: {e}")

    @property
    def is_available(self) -> bool:
        return self._initialized and self.db is not None

    def get_doc_id(self, sheet_name: str, record: Dict[str, Any]) -> str:
        _, id_field = COLLECTION_MAPPINGS.get(sheet_name, (None, None))
        if id_field and record.get(id_field):
            return str(record[id_field])

        if sheet_name == "TopicSkills":
            t_id = record.get("topic_id", "unknown")
            s_id = record.get("skill_id", "unknown")
            sub_id = record.get("sub_skill_id", "unknown")
            return f"{t_id}__{s_id}__{sub_id}"

        if sheet_name == "TopicKeywords":
            t_id = record.get("topic_id", "unknown")
            kw = str(record.get("keyword", "unknown")).replace("/", "_").replace(".", "_")
            return f"{t_id}__{kw}"

        if sheet_name == "ActivitySkills":
            a_id = record.get("activity_id", "unknown")
            s_id = record.get("skill_id", "unknown")
            sub_id = record.get("sub_skill_id", "unknown")
            return f"{a_id}__{s_id}__{sub_id}"

        return str(uuid.uuid4())

    def _sanitize_for_firestore(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, dict):
            return {k: self._sanitize_for_firestore(v) for k, v in value.items()}
        if isinstance(value, (list, tuple, set)):
            return [self._sanitize_for_firestore(item) for item in value]
        if isinstance(value, str):
            trimmed = value.strip()
            if (trimmed.startswith("{") and trimmed.endswith("}")) or (trimmed.startswith("[") and trimmed.endswith("]")):
                try:
                    parsed = json.loads(trimmed)
                    return self._sanitize_for_firestore(parsed)
                except Exception:
                    return value
            return value
        return value

    def prepare_data(self, record: Dict[str, Any]) -> Dict[str, Any]:
        return {k: self._sanitize_for_firestore(v) for k, v in record.items()}

    def save_record(self, sheet_name: str, record: Dict[str, Any], async_mode: bool = True):
        if not self.is_available or sheet_name not in COLLECTION_MAPPINGS:
            return

        collection_name, _ = COLLECTION_MAPPINGS[sheet_name]
        doc_id = self.get_doc_id(sheet_name, record)
        data = self.prepare_data(record)

        def _write():
            try:
                self.db.collection(collection_name).document(doc_id).set(data, merge=True)
            except Exception as e:
                logger.error(f"Failed to write to Firestore collection {collection_name}/{doc_id}: {e}")

        if async_mode:
            self._executor.submit(_write)
        else:
            _write()

    def update_record(self, sheet_name: str, id_value: str, update_data: Dict[str, Any], async_mode: bool = True):
        if not self.is_available or sheet_name not in COLLECTION_MAPPINGS:
            return

        collection_name, _ = COLLECTION_MAPPINGS[sheet_name]
        data = self.prepare_data(update_data)

        def _update():
            try:
                self.db.collection(collection_name).document(str(id_value)).set(data, merge=True)
            except Exception as e:
                logger.error(f"Failed to update Firestore document {collection_name}/{id_value}: {e}")

        if async_mode:
            self._executor.submit(_update)
        else:
            _update()

    def delete_record(self, sheet_name: str, id_value: str, async_mode: bool = True):
        if not self.is_available or sheet_name not in COLLECTION_MAPPINGS:
            return

        collection_name, _ = COLLECTION_MAPPINGS[sheet_name]

        def _delete():
            try:
                self.db.collection(collection_name).document(str(id_value)).delete()
            except Exception as e:
                logger.error(f"Failed to delete Firestore document {collection_name}/{id_value}: {e}")

        if async_mode:
            self._executor.submit(_delete)
        else:
            _delete()

    def delete_records_by(self, sheet_name: str, criteria: Dict[str, Any], async_mode: bool = True):
        if not self.is_available or sheet_name not in COLLECTION_MAPPINGS:
            return

        collection_name, _ = COLLECTION_MAPPINGS[sheet_name]

        def _delete_query():
            try:
                query = self.db.collection(collection_name)
                for k, v in criteria.items():
                    query = query.where(k, "==", v)
                docs = query.stream()
                batch = self.db.batch()
                count = 0
                for doc in docs:
                    batch.delete(doc.reference)
                    count += 1
                    if count % 400 == 0:
                        batch.commit()
                        batch = self.db.batch()
                if count % 400 != 0:
                    batch.commit()
            except Exception as e:
                logger.error(f"Failed to delete Firestore docs from {collection_name} by criteria {criteria}: {e}")

        if async_mode:
            self._executor.submit(_delete_query)
        else:
            _delete_query()

    def save_records_batch(self, entries: List[Tuple[str, Dict[str, Any]]], async_mode: bool = True):
        if not self.is_available or not entries:
            return

        prepared_entries = []
        for sheet_name, record in entries:
            if sheet_name in COLLECTION_MAPPINGS:
                coll_name, _ = COLLECTION_MAPPINGS[sheet_name]
                doc_id = self.get_doc_id(sheet_name, record)
                data = self.prepare_data(record)
                prepared_entries.append((coll_name, doc_id, data))

        def _batch_write():
            try:
                batch = self.db.batch()
                count = 0
                for coll_name, doc_id, data in prepared_entries:
                    ref = self.db.collection(coll_name).document(doc_id)
                    batch.set(ref, data, merge=True)
                    count += 1
                    if count % 400 == 0:
                        batch.commit()
                        batch = self.db.batch()
                if count % 400 != 0:
                    batch.commit()
            except Exception as e:
                logger.error(f"Failed to batch write {len(prepared_entries)} entries to Firestore: {e}")

        if async_mode:
            self._executor.submit(_batch_write)
        else:
            _batch_write()

    def fetch_collection(self, sheet_name: str) -> List[Dict[str, Any]]:
        """Fetches all documents from a Firestore collection."""
        if not self.is_available or sheet_name not in COLLECTION_MAPPINGS:
            return []

        collection_name, _ = COLLECTION_MAPPINGS[sheet_name]
        try:
            docs = self.db.collection(collection_name).stream()
            results = []
            for doc in docs:
                data = doc.to_dict()
                results.append(data)
            return results
        except Exception as e:
            logger.error(f"Failed to fetch Firestore collection {collection_name}: {e}")
            return []

    def sync_all_to_firestore(self, repo, synchronous: bool = False):
        """Pushes all existing data from repository into Cloud Firestore."""
        if not self.is_available:
            return

        def _sync_worker():
            logger.info("Starting complete sync of repository data to Cloud Firestore...")
            for sheet_name, (collection_name, _) in COLLECTION_MAPPINGS.items():
                try:
                    records = repo.read_sheet(sheet_name)
                    if not records:
                        continue
                    # Check if collection already has documents in Firestore to avoid quota exhaustion
                    existing = list(self.db.collection(collection_name).limit(1).stream())
                    if existing:
                        continue

                    batch = self.db.batch()
                    count = 0
                    for record in records:
                        doc_id = self.get_doc_id(sheet_name, record)
                        data = self.prepare_data(record)
                        doc_ref = self.db.collection(collection_name).document(doc_id)
                        batch.set(doc_ref, data, merge=True)
                        count += 1
                        if count % 400 == 0:
                            batch.commit()
                            batch = self.db.batch()
                    if count % 400 != 0:
                        batch.commit()
                    logger.info(f"Synced {count} records to Firestore collection '{collection_name}'")
                except Exception as e:
                    logger.error(f"Error syncing {sheet_name} to Firestore: {e}")
            logger.info("Finished sync of repository data to Cloud Firestore.")

        if synchronous:
            _sync_worker()
        else:
            self._executor.submit(_sync_worker)


firestore_manager = FirestoreManager.get_instance()
