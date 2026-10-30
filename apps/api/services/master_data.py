from apps.api.core.topic_families import DEFAULT_TOPIC_FAMILIES
from apps.api.core.master_data_defaults import (
    DEFAULT_ACTIVITY_TYPES,
    DEFAULT_INTELLIGENCES,
    DEFAULT_SKILLS,
    DEFAULT_SUBSKILLS,
)
from apps.api.repositories.excel import ExcelRepository


def ensure_default_topic_families(repo: ExcelRepository) -> None:
    existing_family_ids = {
        family["topic_family_id"] for family in repo.read_sheet("TopicFamilies")
    }
    for family in DEFAULT_TOPIC_FAMILIES:
        if family["topic_family_id"] not in existing_family_ids:
            repo.append_record("TopicFamilies", family)


def ensure_default_activity_types(repo: ExcelRepository) -> None:
    existing_type_ids = {
        item["activity_type_id"] for item in repo.read_sheet("ActivityTypes")
    }
    for activity_type in DEFAULT_ACTIVITY_TYPES:
        if activity_type["activity_type_id"] not in existing_type_ids:
            repo.append_record("ActivityTypes", activity_type)


def ensure_default_skills_and_intelligences(repo: ExcelRepository) -> None:
    existing_intel_ids = {
        item["intelligence_id"] for item in repo.read_sheet("Intelligences")
    }
    for intel in DEFAULT_INTELLIGENCES:
        if intel["intelligence_id"] not in existing_intel_ids:
            repo.append_record("Intelligences", intel)

    existing_skill_ids = {
        item["skill_id"] for item in repo.read_sheet("Skills")
    }
    for skill in DEFAULT_SKILLS:
        if skill["skill_id"] not in existing_skill_ids:
            repo.append_record("Skills", skill)

    existing_sub_skill_ids = {
        item["sub_skill_id"] for item in repo.read_sheet("SubSkills")
    }
    for sub_skill in DEFAULT_SUBSKILLS:
        if sub_skill["sub_skill_id"] not in existing_sub_skill_ids:
            repo.append_record("SubSkills", sub_skill)


def ensure_default_master_data(repo: ExcelRepository) -> None:
    ensure_default_topic_families(repo)
    ensure_default_activity_types(repo)
    ensure_default_skills_and_intelligences(repo)
