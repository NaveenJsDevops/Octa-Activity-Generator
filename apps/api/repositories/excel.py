import os
import uuid
import json
import pandas as pd
from threading import RLock
from typing import List, Dict, Any, Optional, Type, TypeVar, Literal
from pydantic import BaseModel, ValidationError

from apps.api.models.domain import (
    Intelligence, Skill, SubSkill, TopicFamily, ActivityType,
    Topic, TopicSkill, TopicKeyword, TopicSource,
    ActivityConcept, Activity, ActivitySkill, ActivityVersion, QualityCheck,
    GenerationRun, TopicReviewHistory
)

T = TypeVar('T', bound=BaseModel)

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

class ExcelRepository:
    _atomic_write_lock = RLock()

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        
        self.master_dir = os.path.join(self.data_dir, "master")
        self.topics_dir = os.path.join(self.data_dir, "topics")
        self.activities_dir = os.path.join(self.data_dir, "activities")
        self.ai_dir = os.path.join(self.data_dir, "ai")
        
        os.makedirs(self.master_dir, exist_ok=True)
        os.makedirs(self.topics_dir, exist_ok=True)
        os.makedirs(self.activities_dir, exist_ok=True)
        os.makedirs(self.ai_dir, exist_ok=True)

    def _get_file_path(self, directory: str, filename: str) -> str:
        return os.path.join(self.data_dir, directory, filename)

    def initialize_workbooks(self):
        """Initialize workbooks and sheets if they do not exist."""
        workbooks = {}
        # Group by workbook
        for sheet_name, (directory, filename, model_class, _) in WORKBOOK_MAPPING.items():
            path = self._get_file_path(directory, filename)
            if path not in workbooks:
                workbooks[path] = []
            workbooks[path].append((sheet_name, model_class))
            
        for path, sheets in workbooks.items():
            if not os.path.exists(path):
                with pd.ExcelWriter(path, engine='openpyxl') as writer:
                    for sheet_name, model_class in sheets:
                        columns = list(model_class.model_fields.keys())
                        df = pd.DataFrame(columns=columns)
                        df.to_excel(writer, sheet_name=sheet_name, index=False)
            else:
                # Add missing sheets if necessary
                xls = pd.ExcelFile(path)
                existing_sheets = xls.sheet_names
                with pd.ExcelWriter(path, engine='openpyxl', mode='a', if_sheet_exists='overlay') as writer:
                    for sheet_name, model_class in sheets:
                        if sheet_name not in existing_sheets:
                            columns = list(model_class.model_fields.keys())
                            df = pd.DataFrame(columns=columns)
                            df.to_excel(writer, sheet_name=sheet_name, index=False)

    def read_sheet(self, sheet_name: str) -> List[Dict[str, Any]]:
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")
            
        directory, filename, model_class, _ = WORKBOOK_MAPPING[sheet_name]
        path = self._get_file_path(directory, filename)
        
        if not os.path.exists(path):
            return []
            
        try:
            df = pd.read_excel(path, sheet_name=sheet_name)
            
            # Handle NaN values explicitly
            df = df.where(pd.notnull(df), None)
            
            records = df.to_dict(orient="records")
            import math
            # Parse via Pydantic to ensure typing
            validated_records = []
            for record in records:
                try:
                    # Clean up NaNs from pandas before pydantic validation
                    clean_record = {}
                    for k, v in record.items():
                        if v is None:
                            continue
                        if isinstance(v, float) and math.isnan(v):
                            continue
                        clean_record[k] = v
                        
                    validated = model_class(**clean_record)
                    # output python types but convert enums and dates to primitives if needed,
                    # or just return model_dump
                    validated_records.append(validated.model_dump(mode='json'))
                except ValidationError as e:
                    # Skip or log? We should probably raise or return raw based on usecase.
                    # For a strict system, raise.
                    raise ValueError(f"Data corruption in {sheet_name}: {str(e)}")
            return validated_records
            
        except ValueError as e:
            # If sheet doesn't exist
            if "not found" in str(e).lower() or "no sheet" in str(e).lower():
                return []
            raise
            
    def _write_sheet(self, sheet_name: str, records: List[Dict[str, Any]]):
        directory, filename, model_class, _ = WORKBOOK_MAPPING[sheet_name]
        path = self._get_file_path(directory, filename)
        
        columns = list(model_class.model_fields.keys())
        rows_for_excel = []
        for record in records:
            excel_record = dict(record)
            for list_field in ("materials", "instructions"):
                if isinstance(excel_record.get(list_field), list):
                    excel_record[list_field] = json.dumps(excel_record[list_field])
            for section_field in ("pre_activity", "main_activity", "post_activity"):
                section = excel_record.get(section_field)
                if isinstance(section, BaseModel):
                    section = section.model_dump(mode="json")
                if isinstance(section, dict):
                    excel_record[section_field] = json.dumps(section)
            rows_for_excel.append(excel_record)
        df = pd.DataFrame(rows_for_excel, columns=columns)
        
        # Safe write: write to temp file first, then replace
        temp_path = path + ".tmp.xlsx"
        
        if os.path.exists(path):
            # preserve other sheets
            with pd.ExcelWriter(temp_path, engine='openpyxl') as writer:
                # Read all sheets from existing
                xls = pd.ExcelFile(path)
                for existing_sheet in xls.sheet_names:
                    if existing_sheet == sheet_name:
                        df.to_excel(writer, sheet_name=sheet_name, index=False)
                    else:
                        existing_df = pd.read_excel(path, sheet_name=existing_sheet)
                        existing_df.to_excel(writer, sheet_name=existing_sheet, index=False)
                
                # If the sheet didn't exist in the file but we're writing to it
                if sheet_name not in xls.sheet_names:
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
        else:
            with pd.ExcelWriter(temp_path, engine='openpyxl') as writer:
                df.to_excel(writer, sheet_name=sheet_name, index=False)
                
        os.replace(temp_path, path)

    def validate_references(
        self,
        sheet_name: str,
        data: Dict[str, Any],
        staged_records: Optional[Dict[str, List[Dict[str, Any]]]] = None,
    ):
        """Validate application-level foreign keys."""
        _, _, _, id_field = WORKBOOK_MAPPING[sheet_name]
        staged_records = staged_records or {}
        
        # Check topic_family_id
        if "topic_family_id" in data and data["topic_family_id"] is not None and id_field != "topic_family_id":
            families = self.read_sheet("TopicFamilies")
            if not any(f["topic_family_id"] == data["topic_family_id"] for f in families):
                raise ValueError(f"topic_family_id {data['topic_family_id']} does not exist")
                
        # Check skill_id
        skill_id = data.get("skill_id") or data.get("primary_skill_id")
        if skill_id is not None and id_field != "skill_id":
            skills = self.read_sheet("Skills")
            if not any(s["skill_id"] == skill_id for s in skills):
                raise ValueError(f"skill_id {skill_id} does not exist")
                
        # Check sub_skill_id
        sub_skill_id = data.get("sub_skill_id") or data.get("primary_sub_skill_id")
        if sub_skill_id is not None and id_field != "sub_skill_id":
            sub_skills = self.read_sheet("SubSkills")
            matching_sub_skill = next(
                (skill for skill in sub_skills if skill["sub_skill_id"] == sub_skill_id),
                None,
            )
            if not matching_sub_skill:
                raise ValueError(f"sub_skill_id {sub_skill_id} does not exist")
            if skill_id is not None and matching_sub_skill["skill_id"] != skill_id:
                raise ValueError(f"sub_skill_id {sub_skill_id} does not belong to skill_id {skill_id}")
                
        # Check activity_type_id
        if data.get("activity_type_id") is not None and id_field != "activity_type_id":
            activity_types = self.read_sheet("ActivityTypes")
            if not any(a["activity_type_id"] == data["activity_type_id"] for a in activity_types):
                raise ValueError(f"activity_type_id {data['activity_type_id']} does not exist")

        if data.get("topic_id") is not None and sheet_name in {"ActivityConcepts", "Activities"}:
            topics = self.read_sheet("Topics")
            if not any(topic["topic_id"] == data["topic_id"] for topic in topics):
                raise ValueError(f"topic_id {data['topic_id']} does not exist")

        if sheet_name == "Activities":
            concept_ids = {
                concept["concept_id"] for concept in self.read_sheet("ActivityConcepts")
            }
            concept_ids.update(
                concept["concept_id"] for concept in staged_records.get("ActivityConcepts", [])
            )
            if data.get("concept_id") not in concept_ids:
                raise ValueError(f"concept_id {data.get('concept_id')} does not exist")

        if sheet_name == "ActivitySkills":
            activity_ids = {
                activity["activity_id"] for activity in self.read_sheet("Activities")
            }
            activity_ids.update(
                activity["activity_id"] for activity in staged_records.get("Activities", [])
            )
            if data.get("activity_id") not in activity_ids:
                raise ValueError(f"activity_id {data.get('activity_id')} does not exist")

    def append_records_atomic(self, entries: List[tuple[str, Dict[str, Any]]]) -> List[Dict[str, Any]]:
        with self._atomic_write_lock:
            return self._append_records_atomic(entries)

    def _append_records_atomic(self, entries: List[tuple[str, Dict[str, Any]]]) -> List[Dict[str, Any]]:
        """Validate and append related records with a single workbook replacement."""
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
        validated_entries: List[tuple[str, Dict[str, Any], Optional[str]]] = []
        for sheet_name, data in entries:
            if sheet_name not in WORKBOOK_MAPPING:
                raise ValueError(f"Unknown sheet {sheet_name}")
            _, _, model_class, id_field = WORKBOOK_MAPPING[sheet_name]
            try:
                validated = model_class(**data).model_dump(mode="json")
            except ValidationError as exc:
                raise ValueError(f"Validation error: {exc}") from exc

            self.validate_references(sheet_name, validated, staged)
            if sheet_name == "Activities":
                existing_concept_ids = {
                    record["concept_id"] for record in self.read_sheet("Activities")
                }
                staged_concept_ids = {
                    record["concept_id"] for record in staged.get("Activities", [])
                }
                if validated["concept_id"] in existing_concept_ids | staged_concept_ids:
                    raise ValueError(f"Activity for concept_id={validated['concept_id']} already exists")
            if id_field:
                existing_ids = {
                    record.get(id_field) for record in self.read_sheet(sheet_name)
                }
                staged_ids = {
                    record.get(id_field) for record in staged.get(sheet_name, [])
                }
                new_id = validated.get(id_field)
                if new_id in existing_ids or new_id in staged_ids:
                    raise ValueError(f"Record with {id_field}={new_id} already exists")

            staged.setdefault(sheet_name, []).append(validated)
            validated_entries.append((sheet_name, validated, id_field))

        workbook_path = next(iter(paths))
        workbook_sheets = {
            name: model_class
            for name, (directory, filename, model_class, _) in WORKBOOK_MAPPING.items()
            if self._get_file_path(directory, filename) == workbook_path
        }
        sheet_frames = {}
        if os.path.exists(workbook_path):
            workbook = pd.ExcelFile(workbook_path)
            for sheet_name in workbook.sheet_names:
                sheet_frames[sheet_name] = pd.read_excel(workbook_path, sheet_name=sheet_name)
        for sheet_name, additions in staged.items():
            columns = list(WORKBOOK_MAPPING[sheet_name][2].model_fields.keys())
            existing_frame = sheet_frames.get(sheet_name, pd.DataFrame(columns=columns))
            rows_for_excel = additions
            if sheet_name in {"Activities", "ActivityConcepts"}:
                rows_for_excel = []
                for record in additions:
                    excel_record = dict(record)
                    for list_field in ("materials", "instructions"):
                        if isinstance(excel_record.get(list_field), list):
                            excel_record[list_field] = json.dumps(excel_record[list_field])
                    for section_field in ("pre_activity", "main_activity", "post_activity"):
                        section = excel_record.get(section_field)
                        if isinstance(section, dict):
                            excel_record[section_field] = json.dumps(section)
                    rows_for_excel.append(excel_record)
            addition_frame = pd.DataFrame(rows_for_excel, columns=columns)
            sheet_frames[sheet_name] = pd.concat([existing_frame, addition_frame], ignore_index=True)
        for sheet_name, model_class in workbook_sheets.items():
            sheet_frames.setdefault(sheet_name, pd.DataFrame(columns=list(model_class.model_fields.keys())))

        temp_path = f"{workbook_path}.{uuid.uuid4().hex}.tmp.xlsx"
        try:
            with pd.ExcelWriter(temp_path, engine="openpyxl") as writer:
                for sheet_name, frame in sheet_frames.items():
                    frame.to_excel(writer, sheet_name=sheet_name, index=False)
            os.replace(temp_path, workbook_path)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        return [record for _, record, _ in validated_entries]

    def append_record(self, sheet_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Append a new record, validating it first."""
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")
            
        _, _, model_class, id_field = WORKBOOK_MAPPING[sheet_name]
        
        # 1. Validate Pydantic model (handles required fields, types, enums)
        try:
            validated_model = model_class(**data)
            validated_data = validated_model.model_dump(mode='json')
        except ValidationError as e:
            raise ValueError(f"Validation error: {str(e)}")
            
        # 2. Validate foreign keys
        self.validate_references(sheet_name, validated_data)
        
        # 3. Check for unique ID
        records = self.read_sheet(sheet_name)
        if id_field and id_field in validated_data:
            new_id = validated_data[id_field]
            if any(r.get(id_field) == new_id for r in records):
                raise ValueError(f"Record with {id_field}={new_id} already exists")
                
        # 4. Append and write
        records.append(validated_data)
        self._write_sheet(sheet_name, records)
        
        return validated_data

    def update_record(self, sheet_name: str, id_value: str, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing record."""
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")
            
        _, _, model_class, id_field = WORKBOOK_MAPPING[sheet_name]
        
        if not id_field:
            raise ValueError(f"Sheet {sheet_name} does not have a primary ID field defined for updates")
            
        records = self.read_sheet(sheet_name)
        
        record_idx = next((i for i, r in enumerate(records) if r.get(id_field) == id_value), None)
        if record_idx is None:
            raise ValueError(f"Record with {id_field}={id_value} not found")
            
        existing_record = records[record_idx]
        merged_data = {**existing_record, **update_data}
        
        # Validate merged record
        try:
            validated_model = model_class(**merged_data)
            validated_data = validated_model.model_dump(mode='json')
        except ValidationError as e:
            raise ValueError(f"Validation error on update: {str(e)}")
            
        self.validate_references(sheet_name, validated_data)
        
        records[record_idx] = validated_data
        self._write_sheet(sheet_name, records)
        
        return validated_data

    def find_records(self, sheet_name: str, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Find records matching criteria."""
        records = self.read_sheet(sheet_name)
        
        results = []
        for record in records:
            match = True
            for k, v in criteria.items():
                if record.get(k) != v:
                    match = False
                    break
            if match:
                results.append(record)
                
        return results

    def delete_record(self, sheet_name: str, id_value: str) -> bool:
        """Delete an existing record."""
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")
            
        _, _, _, id_field = WORKBOOK_MAPPING[sheet_name]
        
        if not id_field:
            raise ValueError(f"Sheet {sheet_name} does not have a primary ID field defined for deletions")
            
        records = self.read_sheet(sheet_name)
        initial_count = len(records)
        records = [r for r in records if r.get(id_field) != id_value]
        
        if len(records) == initial_count:
            raise ValueError(f"Record with {id_field}={id_value} not found")
            
        self._write_sheet(sheet_name, records)
        return True

    def delete_records_by(self, sheet_name: str, criteria: Dict[str, Any]) -> int:
        """Delete records matching criteria and return count of deleted records."""
        if sheet_name not in WORKBOOK_MAPPING:
            raise ValueError(f"Unknown sheet {sheet_name}")
            
        records = self.read_sheet(sheet_name)
        initial_count = len(records)
        
        filtered_records = []
        for record in records:
            match = True
            for k, v in criteria.items():
                if record.get(k) != v:
                    match = False
                    break
            if not match:
                filtered_records.append(record)
                
        deleted_count = initial_count - len(filtered_records)
        if deleted_count > 0:
            self._write_sheet(sheet_name, filtered_records)
            
        return deleted_count
