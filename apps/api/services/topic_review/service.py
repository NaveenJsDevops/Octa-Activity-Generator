import json
import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any

from apps.api.repositories.firestore import FirestoreRepository
from apps.api.models.domain import Topic, TopicStatus, TopicReviewHistory, TopicVersion, TopicSkill, TopicKeyword, Skill, SubSkill
from apps.api.models.enums import ActivityPotential
from apps.api.models.topic_review import TopicListFilter, TopicEditRequest
from apps.api.services.topic_discovery.skill_resolver import SkillResolver

class TopicReviewService:
    def __init__(self, repo: FirestoreRepository, user_id: str = "system"):
        self.repo = repo
        self.user_id = user_id
        
        self.topics = [Topic(**t) for t in self.repo.read_sheet("Topics")]
        self.topic_families = self.repo.read_sheet("TopicFamilies")
        self.intelligences = self.repo.read_sheet("Intelligences")
        self.skills = self.repo.read_sheet("Skills")
        self.sub_skills = self.repo.read_sheet("SubSkills")
        self.topic_skills = [TopicSkill(**t) for t in self.repo.read_sheet("TopicSkills")]
        self.topic_keywords = [TopicKeyword(**t) for t in self.repo.read_sheet("TopicKeywords")]

    def _get_topic_by_id(self, topic_id: str) -> Optional[Topic]:
        for t in self.topics:
            if t.topic_id == topic_id:
                return t
        # Fallback to reading from repository
        for t_dict in self.repo.read_sheet("Topics"):
            if t_dict.get("topic_id") == topic_id:
                t = Topic(**t_dict)
                self.topics.append(t)
                return t
        return None

    def _log_history(self, topic_id: str, action: str, previous_status: TopicStatus, new_status: TopicStatus, reason: Optional[str] = None):
        history = TopicReviewHistory(
            review_id=str(uuid.uuid4()),
            topic_id=topic_id,
            action=action,
            previous_status=previous_status,
            new_status=new_status,
            reason=reason,
            changed_at=datetime.now(),
            changed_by=self.user_id
        )
        self.repo.append_record("TopicReviewHistory", history.model_dump(mode="json"))

    def _update_topic(self, topic: Topic):
        self.repo.update_record("Topics", topic.topic_id, topic.model_dump(mode="json"))

    def list_topics(self, filters: TopicListFilter) -> List[Topic]:
        filtered = self.topics
        
        if filters.status:
            filtered = [t for t in filtered if t.status == filters.status]
        if filters.topic_family_id:
            filtered = [t for t in filtered if t.topic_family_id == filters.topic_family_id]
        if filters.age_min is not None:
            filtered = [t for t in filtered if t.age_min >= filters.age_min]
        if filters.age_max is not None:
            filtered = [t for t in filtered if t.age_max <= filters.age_max]
            
        if filters.skill_id:
            # Filter topics that map to this skill
            skill_topic_ids = {ts.topic_id for ts in self.topic_skills if ts.skill_id == filters.skill_id}
            filtered = [t for t in filtered if t.topic_id in skill_topic_ids]
            
        if filters.search:
            search_lower = filters.search.lower().strip()
            filtered = [
                t for t in filtered if 
                (t.topic and search_lower in t.topic.lower()) or 
                (t.short_description and search_lower in t.short_description.lower()) or 
                (t.full_description and search_lower in t.full_description.lower())
            ]

        # Ensure latest topics show on top (newest created_at first)
        def _get_sort_key(t: Topic):
            dt = t.created_at or datetime.min
            return (dt, t.topic_id)

        filtered.sort(key=_get_sort_key, reverse=True)
            
        return filtered

    def get_topic_detail(self, topic_id: str) -> Optional[dict]:
        topic = self._get_topic_by_id(topic_id)
        if not topic:
            return None
            
        # Resolve family name
        family_name = next((f["name"] for f in self.topic_families if f["topic_family_id"] == topic.topic_family_id), "Unknown")
        
        # Resolve skills
        related_skills = [ts for ts in self.topic_skills if ts.topic_id == topic_id]
        resolved_skills = []
        for rs in related_skills:
            s = next((sk for sk in self.skills if sk["skill_id"] == rs.skill_id), None)
            s_name = s["name"] if s else "Unknown Skill"
            i_id = s["intelligence_id"] if s else None
            
            i_name = "Unknown Intelligence"
            if i_id:
                i_name = next((i["name"] for i in self.intelligences if i["intelligence_id"] == i_id), "Unknown Intelligence")
                
            ss_name = next((ss["name"] for ss in self.sub_skills if ss["sub_skill_id"] == rs.sub_skill_id), "Unknown SubSkill")
            resolved_skills.append({
                "intelligence_id": i_id,
                "intelligence_name": i_name,
                "skill_id": rs.skill_id,
                "skill_name": s_name,
                "sub_skill_id": rs.sub_skill_id,
                "sub_skill_name": ss_name
            })
            
        keywords = [tk.keyword for tk in self.topic_keywords if tk.topic_id == topic_id]

        # Resolve user-selected and AI-suggested mappings
        user_sel_intel = getattr(topic, "user_selected_intelligence", None)
        user_sel_skills = list(getattr(topic, "user_selected_skills", []) or [])
        user_sel_sub_skills = list(getattr(topic, "user_selected_sub_skills", []) or [])

        sugg_intel = getattr(topic, "suggested_intelligence", None)
        sugg_skills = list(getattr(topic, "suggested_skills", []) or [])
        sugg_sub_skills = list(getattr(topic, "suggested_sub_skills", []) or [])

        # Validate and normalize suggested mappings against master data catalogue
        resolver = SkillResolver(
            [Skill(**s) for s in self.skills],
            [SubSkill(**ss) for ss in self.sub_skills]
        )

        norm_sugg_intel = resolver.resolve_intelligence(sugg_intel)
        norm_sugg_skills = resolver.resolve_skill_names(sugg_skills)
        norm_sugg_sub_skills = resolver.resolve_sub_skill_names(sugg_sub_skills)

        # If any suggested mapping is missing or empty, infer it canonically from topic data
        if not norm_sugg_intel or not norm_sugg_skills or not norm_sugg_sub_skills:
            inf_intel, inf_skills, inf_sub_skills = resolver.infer_for_topic(
                topic_title=topic.topic,
                topic_family_name=family_name,
                keywords=keywords,
                description=topic.full_description or topic.short_description
            )
            if not norm_sugg_intel:
                norm_sugg_intel = inf_intel
            if not norm_sugg_skills:
                norm_sugg_skills = inf_skills
            if not norm_sugg_sub_skills:
                norm_sugg_sub_skills = inf_sub_skills

            # Persist canonical inferred values back onto topic
            topic.suggested_intelligence = norm_sugg_intel
            topic.suggested_skills = norm_sugg_skills
            topic.suggested_sub_skills = norm_sugg_sub_skills
            try:
                self.repo.update_record("Topics", topic_id, {
                    "suggested_intelligence": norm_sugg_intel,
                    "suggested_skills": norm_sugg_skills,
                    "suggested_sub_skills": norm_sugg_sub_skills
                })
            except Exception:
                pass

        sugg_intel = norm_sugg_intel
        sugg_skills = norm_sugg_skills
        sugg_sub_skills = norm_sugg_sub_skills

        # If user_selected was not stored on topic, use primary resolved_skills if present
        if not user_sel_skills and resolved_skills:
            for rs in resolved_skills:
                if rs["skill_name"] not in user_sel_skills:
                    user_sel_skills.append(rs["skill_name"])
                if rs["sub_skill_name"] not in user_sel_sub_skills:
                    user_sel_sub_skills.append(rs["sub_skill_name"])
                if not user_sel_intel and rs["intelligence_name"] != "Unknown Intelligence":
                    user_sel_intel = rs["intelligence_name"]

        return {
            "topic": topic,
            "topic_family_name": family_name,
            "skills": resolved_skills,
            "keywords": keywords,
            "mappings": {
                "user_selected": {
                    "intelligence": user_sel_intel,
                    "skills": user_sel_skills,
                    "sub_skills": user_sel_sub_skills
                },
                "suggested": {
                    "intelligence": sugg_intel,
                    "skills": sugg_skills,
                    "sub_skills": sugg_sub_skills
                }
            }
        }

    def edit_topic(self, topic_id: str, edit_req: TopicEditRequest) -> Tuple[bool, str]:
        topic = self._get_topic_by_id(topic_id)
        if not topic:
            return False, "Topic not found"
            
        # Only certain statuses can be edited. e.g. DRAFT, REVIEW, APPROVED.
        if topic.status in (TopicStatus.REJECTED, TopicStatus.ARCHIVED):
            return False, f"Cannot edit topic in {topic.status} state"

        # Capture old state snapshot for diff & versioning
        old_topic_dict = topic.model_dump(mode="json")
        old_keywords = [tk.keyword for tk in self.topic_keywords if tk.topic_id == topic_id]
            
        # Apply updates
        update_data = edit_req.model_dump(exclude_unset=True)
        keywords_update = update_data.pop("keywords", None)

        # Handle legacy or alternative field mappings
        why_interesting = update_data.pop("why_interesting", None)
        topic_hook = update_data.pop("topic_hook", None)

        if why_interesting is not None:
            topic.why_interesting = why_interesting
            if not update_data.get("full_description"):
                topic.full_description = why_interesting

        if topic_hook is not None:
            topic.topic_hook = topic_hook
            if not update_data.get("short_description"):
                topic.short_description = topic_hook

        # Normalize activity_potential enum if provided as string
        if "activity_potential" in update_data and update_data["activity_potential"] is not None:
            ap_val = update_data["activity_potential"]
            if isinstance(ap_val, str):
                try:
                    update_data["activity_potential"] = ActivityPotential(ap_val.upper())
                except ValueError:
                    pass

        topic_fields = set(Topic.model_fields.keys())
        for k, v in update_data.items():
            if k in topic_fields or hasattr(topic, k):
                setattr(topic, k, v)
            
        topic.updated_at = datetime.now()
        self._update_topic(topic)
        self._log_history(topic_id, "EDIT", topic.status, topic.status)
        
        if keywords_update is not None:
            # Delete old keywords
            self.repo.delete_records_by("TopicKeywords", {"topic_id": topic_id})
            # Remove from in-memory cache
            self.topic_keywords = [tk for tk in self.topic_keywords if tk.topic_id != topic_id]
            
            for kw in keywords_update:
                kw_data = {"topic_id": topic_id, "keyword": kw}
                self.repo.append_record("TopicKeywords", kw_data)
                self.topic_keywords.append(TopicKeyword(**kw_data))

        # --- VERSION TRACKER RECORDING ---
        new_topic_dict = topic.model_dump(mode="json")
        diffs = []
        for key in set(old_topic_dict.keys()).union(new_topic_dict.keys()):
            if key in ("updated_at", "created_at"):
                continue
            old_val = old_topic_dict.get(key)
            new_val = new_topic_dict.get(key)
            if old_val != new_val:
                diffs.append({
                    "field": key,
                    "old_value": str(old_val) if old_val is not None else "None",
                    "new_value": str(new_val) if new_val is not None else "None"
                })

        if keywords_update is not None and set(keywords_update) != set(old_keywords):
            diffs.append({
                "field": "keywords",
                "old_value": ", ".join(old_keywords) if old_keywords else "None",
                "new_value": ", ".join(keywords_update) if keywords_update else "None"
            })

        existing_versions = [v for v in self.repo.read_sheet("TopicVersions") if v.get("topic_id") == topic_id]
        if not existing_versions:
            # Record baseline version 1
            v1_data = {
                "version_id": f"TOP-VER-{uuid.uuid4().hex[:8].upper()}",
                "topic_id": topic_id,
                "version_number": 1,
                "content": json.dumps(old_topic_dict),
                "change_summary": "Initial baseline version",
                "changes": json.dumps([]),
                "created_at": topic.created_at or datetime.now(),
                "created_by": "system"
            }
            self.repo.append_record("TopicVersions", v1_data)
            existing_versions = [v1_data]

        changed_names = [d["field"].replace("_", " ").title() for d in diffs]
        summary = f"Updated {', '.join(changed_names[:3])}" if changed_names else "Updated topic fields"
        if len(changed_names) > 3:
            summary += f" and {len(changed_names) - 3} more fields"

        new_v_num = len(existing_versions) + 1
        new_ver_data = {
            "version_id": f"TOP-VER-{uuid.uuid4().hex[:8].upper()}",
            "topic_id": topic_id,
            "version_number": new_v_num,
            "content": json.dumps(new_topic_dict),
            "change_summary": summary,
            "changes": json.dumps(diffs),
            "created_at": datetime.now(),
            "created_by": self.user_id or "editor"
        }
        self.repo.append_record("TopicVersions", new_ver_data)
            
        return True, "Topic updated successfully"

    def transition_state(self, topic_id: str, action: str, new_status: TopicStatus, expected_current_states: List[TopicStatus], reason: Optional[str] = None) -> Tuple[bool, str]:
        topic = self._get_topic_by_id(topic_id)
        if not topic:
            return False, "Topic not found"
            
        if topic.status not in expected_current_states:
            return False, f"Invalid transition: Cannot {action} a topic in {topic.status.value} state"
            
        previous_status = topic.status
        topic.status = new_status
        topic.updated_at = datetime.now()
        if reason:
            topic.rejection_reason = reason
            
        self._update_topic(topic)
        self._log_history(topic_id, action.upper(), previous_status, new_status, reason)
        
        return True, f"Topic transitioned to {new_status.value}"

    def review_topic(self, topic_id: str) -> Tuple[bool, str]:
        return self.transition_state(topic_id, "review", TopicStatus.REVIEW, [TopicStatus.DRAFT, TopicStatus.REJECTED])

    def approve_topic(self, topic_id: str) -> Tuple[bool, str]:
        topic = self._get_topic_by_id(topic_id)
        if not topic:
            return False, "Topic not found"
        if topic.status == TopicStatus.APPROVED:
            return True, "Topic already approved"
        return self.transition_state(
            topic_id,
            "approve",
            TopicStatus.APPROVED,
            [TopicStatus.DRAFT, TopicStatus.REVIEW, TopicStatus.SELECTED],
        )

    def reject_topic(self, topic_id: str, reason: str) -> Tuple[bool, str]:
        return self.transition_state(topic_id, "reject", TopicStatus.REJECTED, [TopicStatus.DRAFT, TopicStatus.REVIEW], reason=reason)

    def select_topics(self, topic_ids: List[str]) -> Tuple[int, List[str]]:
        success_count = 0
        errors = []
        for tid in topic_ids:
            success, msg = self.transition_state(tid, "select", TopicStatus.SELECTED, [TopicStatus.APPROVED])
            if success:
                success_count += 1
            else:
                errors.append(f"{tid}: {msg}")
        return success_count, errors

    def unselect_topic(self, topic_id: str) -> Tuple[bool, str]:
        return self.transition_state(topic_id, "unselect", TopicStatus.APPROVED, [TopicStatus.SELECTED])

    def delete_topic(self, topic_id: str) -> Tuple[bool, str]:
        topic = self._get_topic_by_id(topic_id)
        if not topic:
            return False, "Topic not found"
            
        try:
            self.repo.delete_record("Topics", topic_id)
            # Remove from in-memory caches and delete related items
            self.topics = [t for t in self.topics if t.topic_id != topic_id]
            self.repo.delete_records_by("TopicKeywords", {"topic_id": topic_id})
            self.topic_keywords = [tk for tk in self.topic_keywords if tk.topic_id != topic_id]
            self.repo.delete_records_by("TopicSkills", {"topic_id": topic_id})
            self.topic_skills = [ts for ts in self.topic_skills if ts.topic_id != topic_id]
            self.repo.delete_records_by("TopicVersions", {"topic_id": topic_id})
            self._log_history(topic_id, "DELETE", topic.status, topic.status)
            return True, "Topic deleted successfully"
        except ValueError as e:
            return False, str(e)

    def get_topic_versions(self, topic_id: str) -> List[Dict[str, Any]]:
        raw_versions = [v for v in self.repo.read_sheet("TopicVersions") if v.get("topic_id") == topic_id]
        if not raw_versions:
            topic = self._get_topic_by_id(topic_id)
            if topic:
                v1_data = {
                    "version_id": f"TOP-VER-{uuid.uuid4().hex[:8].upper()}",
                    "topic_id": topic_id,
                    "version_number": 1,
                    "content": json.dumps(topic.model_dump(mode="json")),
                    "change_summary": "Initial baseline version",
                    "changes": json.dumps([]),
                    "created_at": topic.created_at or datetime.now(),
                    "created_by": "system"
                }
                self.repo.append_record("TopicVersions", v1_data)
                raw_versions = [v1_data]

        result = []
        for v in raw_versions:
            changes = []
            if v.get("changes"):
                try:
                    changes = json.loads(v["changes"]) if isinstance(v["changes"], str) else v["changes"]
                except Exception:
                    changes = []
            content = None
            if v.get("content"):
                try:
                    content = json.loads(v["content"]) if isinstance(v["content"], str) else v["content"]
                except Exception:
                    content = None
            
            created_str = v.get("created_at")
            if isinstance(created_str, datetime):
                created_str = created_str.isoformat()

            result.append({
                "version_id": v.get("version_id") or f"ver-{v.get('version_number')}",
                "entity_id": v["topic_id"],
                "version_number": v["version_number"],
                "change_summary": v.get("change_summary") or f"Version {v['version_number']}",
                "changes": changes,
                "created_at": str(created_str),
                "created_by": v.get("created_by") or "editor",
                "content": content
            })

        result.sort(key=lambda x: x["version_number"], reverse=True)
        return result

    def restore_topic_version(self, topic_id: str, version_id: str) -> Tuple[bool, str]:
        topic = self._get_topic_by_id(topic_id)
        if not topic:
            return False, "Topic not found"
            
        versions = [v for v in self.repo.read_sheet("TopicVersions") if v.get("topic_id") == topic_id]
        target_ver = next((v for v in versions if v.get("version_id") == version_id), None)
        if not target_ver:
            return False, "Version record not found"

        try:
            content_dict = json.loads(target_ver["content"]) if isinstance(target_ver["content"], str) else target_ver["content"]
        except Exception as e:
            return False, f"Failed to parse version snapshot: {e}"

        topic_fields = set(Topic.model_fields.keys())
        for k, v in content_dict.items():
            if k in topic_fields and k not in ("topic_id", "created_at"):
                setattr(topic, k, v)

        topic.updated_at = datetime.now()
        self._update_topic(topic)
        
        new_ver_num = len(versions) + 1
        new_ver_data = {
            "version_id": f"TOP-VER-{uuid.uuid4().hex[:8].upper()}",
            "topic_id": topic_id,
            "version_number": new_ver_num,
            "content": json.dumps(topic.model_dump(mode="json")),
            "change_summary": f"Restored from version {target_ver.get('version_number')}",
            "changes": json.dumps([{"field": "snapshot", "old_value": "Current State", "new_value": f"Restored v{target_ver.get('version_number')}"}]),
            "created_at": datetime.now(),
            "created_by": self.user_id or "editor"
        }
        self.repo.append_record("TopicVersions", new_ver_data)
        self._log_history(topic_id, "RESTORE", topic.status, topic.status, f"Restored v{target_ver.get('version_number')}")
        return True, f"Successfully restored topic to version {target_ver.get('version_number')}"
