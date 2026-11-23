import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from apps.api.repositories.firestore import FirestoreRepository
from apps.api.models.domain import Topic, TopicStatus, TopicReviewHistory, TopicSkill, TopicKeyword, Skill, SubSkill
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
            # Remove it from the in-memory cache as well
            self.topics = [t for t in self.topics if t.topic_id != topic_id]
            self._log_history(topic_id, "DELETE", topic.status, topic.status)
            return True, "Topic deleted successfully"
        except ValueError as e:
            return False, str(e)
