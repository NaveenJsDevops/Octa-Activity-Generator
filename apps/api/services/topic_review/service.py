import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from apps.api.repositories.excel import ExcelRepository
from apps.api.models.domain import Topic, TopicStatus, TopicReviewHistory, TopicSkill, TopicKeyword
from apps.api.models.topic_review import TopicListFilter, TopicEditRequest

class TopicReviewService:
    def __init__(self, excel_repo: ExcelRepository, user_id: str = "system"):
        self.excel_repo = excel_repo
        self.user_id = user_id
        
        self.topics = [Topic(**t) for t in self.excel_repo.read_sheet("Topics")]
        self.topic_families = self.excel_repo.read_sheet("TopicFamilies")
        self.intelligences = self.excel_repo.read_sheet("Intelligences")
        self.skills = self.excel_repo.read_sheet("Skills")
        self.sub_skills = self.excel_repo.read_sheet("SubSkills")
        self.topic_skills = [TopicSkill(**t) for t in self.excel_repo.read_sheet("TopicSkills")]
        self.topic_keywords = [TopicKeyword(**t) for t in self.excel_repo.read_sheet("TopicKeywords")]

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
        self.excel_repo.append_record("TopicReviewHistory", history.model_dump(mode="json"))

    def _update_topic(self, topic: Topic):
        self.excel_repo.update_record("Topics", topic.topic_id, topic.model_dump(mode="json"))

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
        
        return {
            "topic": topic,
            "topic_family_name": family_name,
            "skills": resolved_skills,
            "keywords": keywords
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
        
        for k, v in update_data.items():
            setattr(topic, k, v)
            
        topic.updated_at = datetime.now()
        self._update_topic(topic)
        self._log_history(topic_id, "EDIT", topic.status, topic.status)
        
        if keywords_update is not None:
            # Delete old keywords
            self.excel_repo.delete_records_by("TopicKeywords", {"topic_id": topic_id})
            # Remove from in-memory cache
            self.topic_keywords = [tk for tk in self.topic_keywords if tk.topic_id != topic_id]
            
            for kw in keywords_update:
                kw_data = {"topic_id": topic_id, "keyword": kw}
                self.excel_repo.append_record("TopicKeywords", kw_data)
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
            self.excel_repo.delete_record("Topics", topic_id)
            # Remove it from the in-memory cache as well
            self.topics = [t for t in self.topics if t.topic_id != topic_id]
            self._log_history(topic_id, "DELETE", topic.status, topic.status)
            return True, "Topic deleted successfully"
        except ValueError as e:
            return False, str(e)
