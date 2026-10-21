from apps.api.core.config import settings
from apps.api.repositories.excel import ExcelRepository
from apps.api.scripts.init_master_data import DEFAULT_TOPIC_FAMILIES, initialize


def test_initialize_seeds_topic_families_idempotently(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "DATA_DIR", str(tmp_path))

    initialize()
    initialize()

    families = ExcelRepository(str(tmp_path)).read_sheet("TopicFamilies")
    family_ids = [family["topic_family_id"] for family in families]

    assert set(family_ids) == {
        family["topic_family_id"] for family in DEFAULT_TOPIC_FAMILIES
    }
    assert len(family_ids) == len(set(family_ids))
