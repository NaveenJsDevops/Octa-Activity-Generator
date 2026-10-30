from apps.api.core.config import settings
from apps.api.repositories.excel import ExcelRepository
from apps.api.scripts.init_master_data import DEFAULT_TOPIC_FAMILIES, initialize


def test_initialize_seeds_master_data_idempotently(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATA_DIR", str(tmp_path))

    initialize()
    initialize()

    repo = ExcelRepository(str(tmp_path))
    families = repo.read_sheet("TopicFamilies")
    family_ids = [family["topic_family_id"] for family in families]

    assert set(family_ids) == {
        family["topic_family_id"] for family in DEFAULT_TOPIC_FAMILIES
    }
    assert len(family_ids) == len(set(family_ids))

    activity_types = repo.read_sheet("ActivityTypes")
    assert len(activity_types) >= 1
    assert any(a["name"] == "Worksheet" for a in activity_types)

    skills = repo.read_sheet("Skills")
    assert len(skills) >= 1

    sub_skills = repo.read_sheet("SubSkills")
    assert len(sub_skills) >= 1
