from apps.api.core.topic_families import DEFAULT_TOPIC_FAMILIES
from apps.api.repositories.excel import ExcelRepository


def ensure_default_topic_families(repo: ExcelRepository) -> None:
    existing_family_ids = {
        family["topic_family_id"] for family in repo.read_sheet("TopicFamilies")
    }
    for family in DEFAULT_TOPIC_FAMILIES:
        if family["topic_family_id"] not in existing_family_ids:
            repo.append_record("TopicFamilies", family)
