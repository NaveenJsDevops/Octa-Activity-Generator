import json
import os
import sqlite3
import uuid
from datetime import date, datetime
from enum import Enum
from threading import RLock
from typing import Any, Dict, List, Optional, TypeVar

import pandas as pd
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
)

T = TypeVar("T", bound=BaseModel)

WORKBOOK_MAPPING = {
    "Intelligences": ("master", "Octa_Master.xlsx", Intelligence, "intelligence_id"),
    "Skills": ("master", "Octa_Master.xlsx", Skill, "skill_id"),
    "SubSkills": ("master", "Octa_Master.xlsx", SubSkill, "sub_skill_id"),
    "TopicFamilies": ("master", "Octa_Master.xlsx", TopicFamily, "topic_family_id"),
    "ActivityTypes": ("master", "Octa_Master.xlsx", ActivityType, "activity_type_id"),
    "Topics": ("topics", "Octa_Topics.xlsx", Topic, "topic_id"),
    "TopicSkills": ("topics", "Octa_Topics.xlsx", TopicSkill, None),
    "TopicKeywords": ("topics", "Octa_Topics.xlsx", TopicKeyword, None),
    "TopicSources": ("topics", "Octa_Topics.xlsx", TopicSource, "source_id"),
    "TopicReviewHistory": ("topics", "Octa_Topics.xlsx", TopicReviewHistory, "review_id"),
    "ActivityConcepts": ("activities", "Octa_Activities.xlsx", ActivityConcept, "concept_id"),
    "Activities": ("activities", "Octa_Activities.xlsx", Activity, "activity_id"),
    "ActivitySkills": ("activities", "Octa_Activities.xlsx", ActivitySkill, None),
    "ActivityVersions": ("activities", "Octa_Activities.xlsx", ActivityVersion, "version_id"),
    "QualityChecks": ("activities", "Octa_Activities.xlsx", QualityCheck, "quality_check_id"),
    "GenerationRuns": ("ai", "Octa_AI_Logs.xlsx", GenerationRun, "generation_id"),
}


class DatabaseRepository:
    _atomic_write_lock = RLock()

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.master_dir = os.path.join(self.data_dir, "master")
        self.topics_dir = os.path.join(self.data_dir, "topics")
        self.activities_dir = os.path.join(self.data_dir, "activities")
        self.ai_dir = os.path.join(self.data_dir, "ai")
        self.db_path = os.path.join(self.data_dir, "octa.db")

        os.makedirs(self.master_dir, exist_ok=True)
        os.makedirs(self.topics_dir, exist_ok=True)
        os.makedirs(self.activities_dir, exist_ok=True)
        os.makedirs(self.ai_dir, exist_ok=True)

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _get_file_path(self, directory: str, filename: str) -> str:
        return os.path.join(self.data_dir, directory, filename)

    def _json_field_names(self, model_class: type[BaseModel]) -> set[str]:
        if model_class is ActivityConcept:
            return {"materials", "instructions", "pre_activity", "main_activity", "post_activity"}
        if model_class is Activity:
            return {"materials", "pre_activity", "main_activity", "post_activity"}
        if model_class.__name__ == "PreActivity":
            return {"pre_activity_engagement"}
        if model_class.__name__ == "MainActivity":
            return {"in_depth_description_and_process", "reflection_questions"}
        if model_class.__name__ == "PostActivity":
            return {"extend_the_learning"}
        return set()

    def _serialize_value(self, key: str, value: Any, model_class: type[BaseModel]) -> Any:
        if value is None:
            return None
        if isinstance(value, BaseModel):
            return json.dumps(value.model_dump(mode="json"))
        if isinstance(value, (list, tuple, dict, set)):
            return json.dumps(list(value) if isinstance(value, set) else value)
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Enum):
            return value.value
        if isinstance(value, str):
            if key in self._json_field_names(model_class) and value.strip():
                try:
                    json.loads(value)
                except json.JSONDecodeError:
                    return value
            return value
        return value

    def _prepare_record_for_storage(self, record: Dict[str, Any], model_class: type[BaseModel]) -> Dict[str, Any]:
        prepared: Dict[str, Any] = {}
        for key, value in record.items():
            prepared[key] = self._serialize_value(key, value, model_class)
        return prepared

    def _decode_value(self, model_class: type[BaseModel], key: str, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str) and key in self._json_field_names(model_class):
            stripped = value.strip()
            if not stripped:
                return value
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                return value
            return parsed
        return value

    def _decode_row(self, model_class: type[BaseModel], row: sqlite3.Row) -> Dict[str, Any]:
        record: Dict[str, Any] = {}
        for key in row.keys():
            record[key] = self._decode_value(model_class, key, row[key])
        return record

    def _ensure_table(self, sheet_name: str, model_class: type[BaseModel]) -> None:
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")

        _, _, _, id_field = WORKBOOK_MAPPING[sheet_name]
        columns = list(model_class.model_fields.keys())
        column_sql = [f'"{column}" TEXT' for column in columns]
        if id_field:
            column_sql.append(f'PRIMARY KEY ("{id_field}")')

        with self._connect() as conn:
            conn.execute(
                f'CREATE TABLE IF NOT EXISTS "{sheet_name}" ({", ".join(column_sql)})'
            )

    def initialize_workbooks(self):
        """Initialize workbook placeholders and SQLite tables."""
        workbooks: Dict[str, List[tuple[str, type[BaseModel]]]] = {}
        for sheet_name, (directory, filename, model_class, _) in WORKBOOK_MAPPING.items():
            self._ensure_table(sheet_name, model_class)
            workbook_path = self._get_file_path(directory, filename)
            workbooks.setdefault(workbook_path, []).append((sheet_name, model_class))

        for workbook_path, sheet_entries in workbooks.items():
            if os.path.exists(workbook_path):
                with pd.ExcelFile(workbook_path) as xls:
                    existing_sheets = set(xls.sheet_names)
                if existing_sheets.issuperset(sheet_name for sheet_name, _ in sheet_entries):
                    continue
                with pd.ExcelWriter(workbook_path, engine="openpyxl", mode="a", if_sheet_exists="overlay") as writer:
                    for sheet_name, model_class in sheet_entries:
                        if sheet_name not in pd.ExcelFile(workbook_path).sheet_names:
                            columns = list(model_class.model_fields.keys())
                            empty_df = pd.DataFrame(columns=columns)
                            empty_df.to_excel(writer, sheet_name=sheet_name, index=False)
                continue

            with pd.ExcelWriter(workbook_path, engine="openpyxl") as writer:
                for sheet_name, model_class in sheet_entries:
                    columns = list(model_class.model_fields.keys())
                    empty_df = pd.DataFrame(columns=columns)
                    empty_df.to_excel(writer, sheet_name=sheet_name, index=False)

    def validate_references(
        self,
        sheet_name: str,
        data: Dict[str, Any],
        staged_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    ):
        _, _, _, id_field = WORKBOOK_MAPPING[sheet_name]
        staged_records = staged_records or {}

        if "topic_family_id" in data and data["topic_family_id"] is not None and id_field != "topic_family_id":
            families = self.read_sheet("TopicFamilies")
            if not any(f["topic_family_id"] == data["topic_family_id"] for f in families):
                raise ValueError(f"topic_family_id {data['topic_family_id']} does not exist")

        skill_id = data.get("skill_id") or data.get("primary_skill_id")
        if skill_id is not None and id_field != "skill_id":
            skills = self.read_sheet("Skills")
            if not any(s["skill_id"] == skill_id for s in skills):
                raise ValueError(f"skill_id {skill_id} does not exist")

        sub_skill_id = data.get("sub_skill_id") or data.get("primary_sub_skill_id")
        if sub_skill_id is not None and id_field != "sub_skill_id":
            sub_skills = self.read_sheet("SubSkills")
            matching_sub_skill = next((skill for skill in sub_skills if skill["sub_skill_id"] == sub_skill_id), None)
            if not matching_sub_skill:
                raise ValueError(f"sub_skill_id {sub_skill_id} does not exist")
            if skill_id is not None and matching_sub_skill["skill_id"] != skill_id:
                raise ValueError(f"sub_skill_id {sub_skill_id} does not belong to skill_id {skill_id}")

        if data.get("activity_type_id") is not None and id_field != "activity_type_id":
            activity_types = self.read_sheet("ActivityTypes")
            if not any(a["activity_type_id"] == data["activity_type_id"] for a in activity_types):
                raise ValueError(f"activity_type_id {data['activity_type_id']} does not exist")

        if data.get("topic_id") is not None and sheet_name in {"ActivityConcepts", "Activities"}:
            topics = self.read_sheet("Topics")
            if not any(topic["topic_id"] == data["topic_id"] for topic in topics):
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
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")

        _, _, model_class, _ = WORKBOOK_MAPPING[sheet_name]
        self._ensure_table(sheet_name, model_class)

        with self._connect() as conn:
            rows = conn.execute(f'SELECT * FROM "{sheet_name}"').fetchall()

        records: List[Dict[str, Any]] = []
        for row in rows:
            decoded = self._decode_row(model_class, row)
            try:
                validated = model_class(**decoded).model_dump(mode="json")
            except ValidationError as exc:
                raise ValueError(f"Data corruption in {sheet_name}: {exc}") from exc
            records.append(validated)

        return records

    def _insert_record(self, conn: sqlite3.Connection, sheet_name: str, record: Dict[str, Any]) -> None:
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")

        _, _, model_class, id_field = WORKBOOK_MAPPING[sheet_name]
        prepared = self._prepare_record_for_storage(record, model_class)
        columns = list(model_class.model_fields.keys())
        placeholders = ", ".join("?" for _ in columns)
        sql = f'INSERT INTO "{sheet_name}" ({", ".join(f'"{column}"' for column in columns)}) VALUES ({placeholders})'
        values = [prepared.get(column) for column in columns]
        conn.execute(sql, values)

    def append_record(self, sheet_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")

        _, _, model_class, id_field = WORKBOOK_MAPPING[sheet_name]
        try:
            validated = model_class(**data).model_dump(mode="json")
        except ValidationError as exc:
            raise ValueError(f"Validation error: {exc}") from exc

        self.validate_references(sheet_name, validated)

        records = self.read_sheet(sheet_name)
        if id_field and id_field in validated:
            new_id = validated[id_field]
            if any(r.get(id_field) == new_id for r in records):
                raise ValueError(f"Record with {id_field}={new_id} already exists")

        with self._connect() as conn:
            self._insert_record(conn, sheet_name, validated)
            conn.commit()

        return validated

    def update_record(self, sheet_name: str, id_value: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")

        _, _, model_class, id_field = WORKBOOK_MAPPING[sheet_name]
        if not id_field:
            raise ValueError(f"Sheet {sheet_name} does not have a primary ID field defined for updates")

        records = self.read_sheet(sheet_name)
        record_idx = next((idx for idx, record in enumerate(records) if record.get(id_field) == id_value), None)
        if record_idx is None:
            raise ValueError(f"Record with {id_field}={id_value} not found")

        existing_record = records[record_idx]
        merged_data = {**existing_record, **update_data}
        try:
            validated = model_class(**merged_data).model_dump(mode="json")
        except ValidationError as exc:
            raise ValueError(f"Validation error on update: {exc}") from exc

        self.validate_references(sheet_name, validated)

        with self._connect() as conn:
            columns = list(model_class.model_fields.keys())
            assignments = ", ".join(f'"{column}" = ?' for column in columns)
            values = [self._serialize_value(column, validated.get(column), model_class) for column in columns]
            values.append(id_value)
            conn.execute(
                f'UPDATE "{sheet_name}" SET {assignments} WHERE "{id_field}" = ?',
                values,
            )
            conn.commit()

        return validated

    def find_records(self, sheet_name: str, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
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
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")

        _, _, _, id_field = WORKBOOK_MAPPING[sheet_name]
        if not id_field:
            raise ValueError(f"Sheet {sheet_name} does not have a primary ID field defined for deletions")

        with self._connect() as conn:
            cursor = conn.execute(f'DELETE FROM "{sheet_name}" WHERE "{id_field}" = ?', (id_value,))
            conn.commit()
        return cursor.rowcount > 0

    def delete_records_by(self, sheet_name: str, criteria: Dict[str, Any]) -> int:
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")

        records = self.read_sheet(sheet_name)
        initial_count = len(records)
        filtered_records = []
        for record in records:
            match = True
            for key, value in criteria.items():
                if record.get(key) != value:
                    match = False
                    break
            if not match:
                filtered_records.append(record)

        if len(filtered_records) == initial_count:
            return 0

        with self._connect() as conn:
            for key, value in criteria.items():
                if value is None:
                    conn.execute(f'DELETE FROM "{sheet_name}" WHERE "{key}" IS NULL')
                else:
                    conn.execute(f'DELETE FROM "{sheet_name}" WHERE "{key}" = ?', (value,))
            conn.commit()

        return initial_count - len(self.read_sheet(sheet_name))

    def append_records_atomic(self, entries: List[tuple[str, Dict[str, Any]]]) -> List[Dict[str, Any]]:
        with self._atomic_write_lock:
            if not entries:
                return []

            paths = set()
            for sheet_name, _ in entries:
                if sheet_name not in WORKBOOK_MAPPING:
                    raise ValueError(f"Unknown sheet {sheet_name}")
                directory, filename, _, _ = WORKBOOK_MAPPING[sheet_name]
                paths.add(self._get_file_path(directory, filename))
            if len(paths) != 1:
                raise ValueError("Atomic append supports records from one workbook at a time")

            staged: Dict[str, List[Dict[str, Any]]] = {}
            validated_entries: List[tuple[str, Dict[str, Any]]] = []
            for sheet_name, data in entries:
                _, _, model_class, id_field = WORKBOOK_MAPPING[sheet_name]
                try:
                    validated = model_class(**data).model_dump(mode="json")
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

            with self._connect() as conn:
                try:
                    conn.execute("BEGIN IMMEDIATE")
                    for sheet_name, record in validated_entries:
                        self._insert_record(conn, sheet_name, record)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise

            return [record for _, record in validated_entries]
