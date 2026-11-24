import copy
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from apps.api.models.activity_ideation import (
    ActivityConceptEditRequest,
    ActivityConceptResponse,
    ActivityEditRequest,
    ActivityIdeationAIResponse,
    ActivityIdeationRequest,
    ActivityIdeationResult,
)
from apps.api.models.domain import (
    Activity,
    ActivityConcept,
    ActivitySkill,
    ActivityStatus,
    RelationshipType,
    TopicStatus,
    PreActivity,
    MainActivity,
    PostActivity,
)
from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.ai.orchestrator import AIOrchestrator
from .duplicate_checker import DuplicateChecker
from .review_session_store import ActivityReviewSession, ActivityReviewSessionStore
from .validators import MasterDataValidator

ELIGIBLE_TOPIC_STATUSES = {TopicStatus.APPROVED.value, TopicStatus.SELECTED.value}


class ActivityIdeationService:
    def __init__(self, repo: FirestoreRepository, ai_orchestrator: AIOrchestrator):
        self.repo = repo
        self.ai = ai_orchestrator
        self.activity_types = self.repo.read_sheet("ActivityTypes")
        if not self.activity_types:
            from apps.api.services.master_data import ensure_default_activity_types
            ensure_default_activity_types(self.repo)
            self.activity_types = self.repo.read_sheet("ActivityTypes")
        self.skills = self.repo.read_sheet("Skills")
        self.sub_skills = self.repo.read_sheet("SubSkills")
        if not self.skills or not self.sub_skills:
            from apps.api.services.master_data import ensure_default_skills_and_intelligences
            ensure_default_skills_and_intelligences(self.repo)
            self.skills = self.repo.read_sheet("Skills")
            self.sub_skills = self.repo.read_sheet("SubSkills")
        self.validator = MasterDataValidator(
            skills=self.skills,
            sub_skills=self.sub_skills,
            activity_types=self.activity_types,
        )

    def _get_topic(self, topic_id: str) -> Optional[Dict[str, Any]]:
        return next(
            (topic for topic in self.repo.read_sheet("Topics") if topic["topic_id"] == topic_id),
            None,
        )

    def _get_topic_context(self, topic_id: str) -> Dict[str, Any]:
        from apps.api.services.topic_review.service import TopicReviewService

        return TopicReviewService(self.repo).get_topic_detail(topic_id)

    def get_eligible_topics(self, search: Optional[str] = None) -> List[dict]:
        from apps.api.services.topic_review.service import TopicReviewService

        topic_service = TopicReviewService(self.repo)
        query = (search or "").strip().lower()
        eligible = []
        for topic in self.repo.read_sheet("Topics"):
            if topic["status"] not in ELIGIBLE_TOPIC_STATUSES:
                continue
            if query and query not in " ".join(
                str(value or "")
                for value in (
                    topic["topic"],
                    topic.get("short_description"),
                    topic.get("full_description"),
                    topic.get("country_context"),
                )
            ).lower():
                continue
            detail = topic_service.get_topic_detail(topic["topic_id"])
            if detail:
                eligible.append(detail)

        def _topic_sort_key(item: dict):
            top = item.get("topic")
            dt = getattr(top, "created_at", None) if top else None
            if isinstance(top, dict):
                dt = top.get("created_at")
            if not dt:
                return datetime.min
            if isinstance(dt, str):
                try:
                    return datetime.fromisoformat(dt.replace("Z", "+00:00"))
                except Exception:
                    return datetime.min
            return dt

        eligible.sort(key=_topic_sort_key, reverse=True)
        return eligible

    def _duplicate_checker(self, exclude_activity_id: Optional[str] = None) -> DuplicateChecker:
        concepts = [
            ActivityConcept(**record)
            for record in self.repo.read_sheet("ActivityConcepts")
            if record.get("concept_id") != exclude_activity_id
        ]
        activities = [
            record
            for record in self.repo.read_sheet("Activities")
            if record.get("concept_id") != exclude_activity_id
        ]
        return DuplicateChecker(concepts, activities)

    def _validate_candidate(
        self,
        candidate,
        topic_context: dict,
        duplicate_checker: DuplicateChecker,
        generation_id: Optional[str],
    ) -> tuple[Optional[dict], Optional[str]]:
        is_valid, reason, resolved_ids = self.validator.validate_activity_concept(candidate)
        if not is_valid:
            return None, reason

        if duplicate_checker.is_duplicate(
            candidate.activity_title,
            candidate.activity_concept,
            candidate.learner_task,
            candidate.expected_output,
        ):
            return None, "Too similar to a saved activity or another concept in this batch"

        topic_skill_pairs = {
            (skill["skill_id"], skill["sub_skill_id"])
            for skill in topic_context["skills"]
        }
        primary_skill_id = resolved_ids.get("primary_skill_id")
        primary_sub_skill_id = resolved_ids.get("primary_sub_skill_id")
        if primary_skill_id and topic_skill_pairs and (primary_skill_id, primary_sub_skill_id) not in topic_skill_pairs:
            return None, "Primary skill mapping is not supported by the selected topic"

        mappings = topic_context.get("mappings") or {}
        user_sel = mappings.get("user_selected") or {}
        sugg = mappings.get("suggested") or {}
        top = topic_context["topic"]

        concept = {
            "concept_id": f"ACT-CON-{uuid.uuid4().hex[:8].upper()}",
            "topic_id": top.topic_id,
            "topic_title": top.topic,
            "topic_family_name": topic_context.get("topic_family_name"),
            "country_context": getattr(top, "country_context", None),
            "keywords": topic_context.get("keywords") or [],
            "mappings": mappings,
            "user_selected_intelligence": user_sel.get("intelligence") or getattr(top, "user_selected_intelligence", None),
            "user_selected_skills": user_sel.get("skills") or getattr(top, "user_selected_skills", []) or [],
            "user_selected_sub_skills": user_sel.get("sub_skills") or getattr(top, "user_selected_sub_skills", []) or [],
            "suggested_intelligence": sugg.get("intelligence") or getattr(top, "suggested_intelligence", None),
            "suggested_skills": sugg.get("skills") or getattr(top, "suggested_skills", []) or [],
            "suggested_sub_skills": sugg.get("sub_skills") or getattr(top, "suggested_sub_skills", []) or [],
            "activity_title": candidate.activity_title.strip(),
            "activity_type_id": resolved_ids["activity_type_id"],
            "activity_concept": candidate.activity_concept.strip(),
            "learner_task": candidate.learner_task.strip(),
            "expected_output": candidate.expected_output.strip(),
            "primary_skill_id": primary_skill_id,
            "primary_sub_skill_id": primary_sub_skill_id,
            "why_engaging": candidate.why_it_is_engaging,
            "status": "TEMPORARY",
            "created_at": datetime.now().isoformat(),
            "generation_id": generation_id,
            "learning_objective": candidate.learning_objective,
            "materials": candidate.materials,
            "instructions": candidate.instructions,
            "assessment_criteria": candidate.assessment_criteria,
            "estimated_duration": candidate.estimated_duration,
            "difficulty_level": candidate.difficulty_level,
            "age_min": top.age_min,
            "age_max": top.age_max,
            "target_class": top.target_class,
            "activity_name": candidate.activity_name.strip(),
            "activity_duration": candidate.activity_duration.strip(),
            "pre_activity": candidate.pre_activity.model_dump(mode="json"),
            "main_activity": candidate.main_activity.model_dump(mode="json"),
            "post_activity": candidate.post_activity.model_dump(mode="json"),
        }
        duplicate_checker.add_to_batch(
            f"{concept['activity_title']} {concept['activity_concept']} "
            f"{concept['learner_task']} {concept['expected_output']}"
        )
        return concept, None

    def _build_prompt(self, topic_context: dict, requested_count: int) -> tuple[str, str]:
        topic = topic_context["topic"]
        mapped_skills = "\n".join(
            f"- {skill['skill_name']} > {skill['sub_skill_name']}"
            for skill in topic_context["skills"]
        ) or "No topic-specific skill mapping is available. Leave primary skill fields null."
        activity_types = "\n".join(f"- {item['name']}" for item in self.activity_types)
        if not activity_types:
            raise HTTPException(status_code=409, detail="No valid activity types are configured")

        system_prompt = (
            "You are an expert OCTAKIDZ curriculum designer. Return only JSON matching the supplied "
            "schema. Every activity must follow the OCTAKIDZ Pre-Activity, Main Activity, and Post-Activity "
            "sections in that order. Use simple, child-friendly language, practical specific directions, "
            "and make the pre-activity prepare for the main activity and the post-activity extend its "
            "learning. Parent's Note is mandatory. Include Parent's Guide when adult supervision or "
            "special guidance is needed, especially for outdoor activities or tools; otherwise use null. "
            "Pre-Activity Engagement may contain zero to three useful warm-ups. Do not leave required "
            "template fields blank or substitute generic learning-objective/material/task fields for them. "
            "Avoid repetitive or generic text and never ask children to do unsafe tasks. Do not invent "
            "skill IDs, skills, sub-skills, or activity types; use only supplied values."
        )
        mappings = topic_context.get("mappings") or {}
        user_sel = mappings.get("user_selected") or {}
        sugg = mappings.get("suggested") or {}
        target_intel = user_sel.get("intelligence") or sugg.get("intelligence") or getattr(topic, "user_selected_intelligence", None) or getattr(topic, "suggested_intelligence", None) or "Multidisciplinary"
        target_skills = user_sel.get("skills") or sugg.get("skills") or getattr(topic, "user_selected_skills", None) or getattr(topic, "suggested_skills", None) or []
        target_sub_skills = user_sel.get("sub_skills") or sugg.get("sub_skills") or getattr(topic, "user_selected_sub_skills", None) or getattr(topic, "suggested_sub_skills", None) or []

        prompt = f"""
Generate exactly {requested_count} distinct complete OCTAKIDZ activities for this approved topic.

Topic: {topic.topic}
Short description: {topic.short_description or ""}
Full description: {topic.full_description or ""}
Age range: {topic.age_min}-{topic.age_max}
Class/grade range: {topic.target_class or "Not specified"}
Country/context: {topic.country_context or "Not specified"}
Topic family: {topic_context["topic_family_name"]}
Keywords: {", ".join(topic_context["keywords"])}

Carried-forward Intelligence & Skill Parameters:
- Target Intelligence: {target_intel}
- Target Focus Skills: {", ".join(target_skills) if target_skills else "Practical observation & creative inquiry"}
- Target Focus Sub-skills: {", ".join(target_sub_skills) if target_sub_skills else "Application & synthesis"}

Supported topic skill mappings:
{mapped_skills}

Valid activity types:
{activity_types}

Each activity must contain:
- activity_name: catchy, simple title.
- activity_duration: approximate main-activity duration (for example, "25 minutes").
- pre_activity: activity_description; mandatory parents_note explaining assistance needed;
  parents_guide as step-by-step adult guidance only when required, otherwise null;
  pre_activity_engagement (0-3 warm-up prompts); why_how_is_this_important; lets_get_started.
- main_activity: activity_step_task_title; scenario_real_life_connection (string or null);
  in_depth_description_and_process (at least three ordered, child-friendly actionable steps;
  include a clear structured table in the step text when the activity truly needs one);
  reflection_questions (at least two questions).
- post_activity: whats_next; extend_the_learning (at least one follow-up task);
  how_to_improvise_or_level_up; post_activity_summary.

Also provide activity_type using one supplied type, estimated_duration as matching minutes
(5-180), primary_skill/primary_sub_skill (null unless the exact supported topic mapping applies),
and optional learning_objective, materials, assessment_criteria, and difficulty_level as separate
educational metadata. Do not put these metadata in place of any template content.
"""
        return system_prompt, prompt

    def _generate_candidates(
        self,
        topic_context: dict,
        requested_count: int,
        duplicate_checker: DuplicateChecker,
    ) -> tuple[List[dict], List[dict], int]:
        system_prompt, prompt = self._build_prompt(topic_context, requested_count)
        response: ActivityIdeationAIResponse = self.ai.generate_structured(
            generation_type="activity_ideation",
            prompt=prompt,
            schema_model=ActivityIdeationAIResponse,
            system_prompt=system_prompt,
            prompt_version="v3.0",
            metadata={
                "topic_id": topic_context["topic"].topic_id,
                "requested_count": requested_count,
            },
        )
        generation_id = getattr(self.ai, "last_generation_id", None)

        concepts = []
        rejected_candidates = []
        duplicate_count = 0
        for index, candidate in enumerate(response.activities):
            if index >= requested_count:
                rejected_candidates.append({
                    "candidate": candidate.model_dump(mode="json"),
                    "reason": "AI returned more candidates than requested",
                })
                continue
            concept, reason = self._validate_candidate(
                candidate,
                topic_context,
                duplicate_checker,
                generation_id,
            )
            if concept:
                concepts.append(concept)
            else:
                if reason and reason.startswith("Too similar"):
                    duplicate_count += 1
                rejected_candidates.append({
                    "candidate": candidate.model_dump(mode="json"),
                    "reason": reason or "Activity validation failed",
                })
        return concepts, rejected_candidates, duplicate_count

    def _require_eligible_topic(self, topic_id: str) -> tuple[dict, dict]:
        topic = self._get_topic(topic_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        if topic["status"] not in ELIGIBLE_TOPIC_STATUSES:
            raise HTTPException(
                status_code=409,
                detail=f"Topic must be APPROVED or SELECTED, currently {topic['status']}",
            )
        context = self._get_topic_context(topic_id)
        if not context:
            raise HTTPException(status_code=404, detail="Topic details not found")
        return topic, context

    def _format_concept(self, concept: dict) -> ActivityConceptResponse:
        return ActivityConceptResponse(**concept)

    def _format_session(self, session: ActivityReviewSession) -> ActivityIdeationResult:
        concepts = list(session.concepts.values())
        return ActivityIdeationResult(
            topic_id=session.topic_id,
            session_id=session.session_id,
            generated_count=session.generated_count,
            accepted_count=len(concepts),
            duplicate_count=session.duplicate_count,
            rejected_count=session.rejected_count,
            concepts=[self._format_concept(concept) for concept in concepts],
            rejected_candidates=session.rejected_candidates,
        )

    def generate_concepts(self, request: ActivityIdeationRequest) -> ActivityIdeationResult:
        _, topic_context = self._require_eligible_topic(request.topic_id)
        duplicate_checker = self._duplicate_checker()
        concepts, rejected, duplicate_count = self._generate_candidates(
            topic_context,
            request.requested_count,
            duplicate_checker,
        )
        session = ActivityReviewSessionStore.create(
            request.topic_id,
            {
                "concepts": concepts,
                "generated_count": len(concepts) + len(rejected),
                "duplicate_count": duplicate_count,
                "rejected_count": len(rejected) - duplicate_count,
                "rejected_candidates": rejected,
            },
        )
        try:
            from apps.api.core.firestore import firestore_manager
            for c in concepts:
                firestore_manager.save_record("ActivityConcepts", c)
        except Exception:
            pass
        return self._format_session(session)

    def get_review_session(self, session_id: str) -> ActivityIdeationResult:
        session = ActivityReviewSessionStore.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Activity review session not found")
        return self._format_session(session)

    def _get_temporary_concept(
        self, session_id: str, concept_id: str
    ) -> tuple[ActivityReviewSession, dict]:
        session = ActivityReviewSessionStore.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Activity review session not found")
        concept = session.concepts.get(concept_id)
        if not concept:
            raise HTTPException(status_code=404, detail="Temporary activity concept not found")
        if concept["status"] != "TEMPORARY":
            raise HTTPException(
                status_code=409,
                detail=f"Cannot modify a concept in {concept['status']} state",
            )
        return session, concept

    def edit_temporary_concept(
        self,
        session_id: str,
        concept_id: str,
        request: ActivityConceptEditRequest,
    ) -> ActivityConceptResponse:
        session, concept = self._get_temporary_concept(session_id, concept_id)
        updates = request.model_dump(exclude_unset=True)
        if not updates:
            raise HTTPException(status_code=400, detail="At least one editable field is required")
        concept.update(updates)
        if "activity_name" in updates:
            concept["activity_title"] = concept["activity_name"]
        if "pre_activity" in updates:
            concept["activity_concept"] = concept["pre_activity"]["activity_description"]
            concept["why_engaging"] = concept["pre_activity"]["why_how_is_this_important"]
        if "main_activity" in updates:
            concept["learner_task"] = concept["main_activity"]["activity_step_task_title"]
            concept["instructions"] = concept["main_activity"]["in_depth_description_and_process"]
        if "post_activity" in updates:
            concept["expected_output"] = concept["post_activity"]["post_activity_summary"]
        return self._format_concept(concept)

    def regenerate_concept(
        self,
        session_id: str,
        concept_id: str,
    ) -> ActivityConceptResponse:
        session, previous = self._get_temporary_concept(session_id, concept_id)
        _, topic_context = self._require_eligible_topic(session.topic_id)
        checker = self._duplicate_checker(exclude_activity_id=concept_id)
        checker.add_to_batch(
            f"{previous['activity_title']} {previous['activity_concept']} "
            f"{previous['learner_task']} {previous['expected_output']}"
        )
        for other in session.concepts.values():
            if other["concept_id"] != concept_id and other["status"] == "TEMPORARY":
                checker.add_to_batch(
                    f"{other['activity_title']} {other['activity_concept']} "
                    f"{other['learner_task']} {other['expected_output']}"
                )
        concepts, rejected, _ = self._generate_candidates(topic_context, 1, checker)
        if not concepts:
            reason = rejected[0]["reason"] if rejected else "The generated activity could not be validated"
            raise HTTPException(status_code=422, detail=reason)
        replacement = concepts[0]
        replacement["concept_id"] = concept_id
        replacement["created_at"] = previous["created_at"]
        session.concepts[concept_id] = replacement
        return self._format_concept(replacement)

    def regenerate_concept_section(
        self,
        session_id: str,
        concept_id: str,
        section: str,
    ) -> ActivityConceptResponse:
        session, concept = self._get_temporary_concept(session_id, concept_id)
        _, topic_context = self._require_eligible_topic(session.topic_id)
        topic = topic_context["topic"]

        activity_name = concept.get("activity_name") or concept.get("activity_title") or topic.topic
        activity_duration = concept.get("activity_duration") or "30 minutes"

        mappings = topic_context.get("mappings") or {}
        user_sel = mappings.get("user_selected") or {}
        sugg = mappings.get("suggested") or {}
        target_intel = user_sel.get("intelligence") or sugg.get("intelligence") or getattr(topic, "user_selected_intelligence", None) or getattr(topic, "suggested_intelligence", None) or "Multidisciplinary"
        target_skills = user_sel.get("skills") or sugg.get("skills") or getattr(topic, "user_selected_skills", None) or getattr(topic, "suggested_skills", None) or []
        target_sub_skills = user_sel.get("sub_skills") or sugg.get("sub_skills") or getattr(topic, "user_selected_sub_skills", None) or getattr(topic, "suggested_sub_skills", None) or []

        common_context = f"""
Approved Topic: {topic.topic}
Age range: {topic.age_min}-{topic.age_max} years
Target class: {topic.target_class or "Not specified"}
Country/context: {topic.country_context or "Not specified"}
Topic family: {topic_context["topic_family_name"]}
Keywords: {", ".join(topic_context["keywords"])}
Educational Focus:
- Target Intelligence: {target_intel}
- Target Skills: {", ".join(target_skills) if target_skills else "Practical inquiry"}
- Target Sub-skills: {", ".join(target_sub_skills) if target_sub_skills else "Application & synthesis"}

Activity Name: {activity_name}
Activity Duration: {activity_duration}
"""

        if section == "pre_activity":
            system_prompt = (
                "You are an expert OCTAKIDZ curriculum designer. Return only JSON matching the PreActivity schema. "
                "Use simple, child-friendly language. Parent's Note is mandatory explaining assistance needed. "
                "Include Parent's Guide only if special safety/supervision is required (otherwise null). "
                "Pre-Activity Engagement must contain 0 to 3 warm-up prompts. "
                "Pre-activity must prepare learners for the activity."
            )
            prompt = f"""
{common_context}

Regenerate a fresh, high-quality, creative PRE-ACTIVITY section for this activity:
- activity_description: engaging overview of what the learner will do.
- parents_note: practical note for parents/mentors on assistance.
- parents_guide: step-by-step guidance only when adult supervision/tools are needed, else null.
- pre_activity_engagement: list of 0-3 quick questions or warm-up mini-tasks.
- why_how_is_this_important: child-friendly explanation of why this topic matters.
- lets_get_started: motivating call-to-action prompt.
"""
            res: PreActivity = self.ai.generate_structured(
                generation_type="activity_section_regeneration",
                prompt=prompt,
                schema_model=PreActivity,
                system_prompt=system_prompt,
                prompt_version="v3.0",
                metadata={"topic_id": topic.topic_id, "section": section, "concept_id": concept_id},
            )
            concept["pre_activity"] = res.model_dump()
            concept["activity_concept"] = res.activity_description
            concept["why_engaging"] = res.why_how_is_this_important

        elif section == "main_activity":
            pre_summary = concept.get("pre_activity", {}).get("activity_description", "")
            system_prompt = (
                "You are an expert OCTAKIDZ curriculum designer. Return only JSON matching the MainActivity schema. "
                "Provide at least three ordered, child-friendly actionable steps in in_depth_description_and_process. "
                "Provide at least two thoughtful reflection questions."
            )
            prompt = f"""
{common_context}
Pre-activity Context: {pre_summary}

Regenerate a fresh, step-by-step, engaging MAIN ACTIVITY section for this activity:
- activity_step_task_title: clear title for the core activity task.
- scenario_real_life_connection: optional real-world situation/connection, or null.
- in_depth_description_and_process: at least 3 detailed, clear steps guiding the learner through execution.
- reflection_questions: at least 2 questions encouraging critical thinking and self-reflection.
"""
            res: MainActivity = self.ai.generate_structured(
                generation_type="activity_section_regeneration",
                prompt=prompt,
                schema_model=MainActivity,
                system_prompt=system_prompt,
                prompt_version="v3.0",
                metadata={"topic_id": topic.topic_id, "section": section, "concept_id": concept_id},
            )
            concept["main_activity"] = res.model_dump()
            concept["learner_task"] = res.activity_step_task_title
            concept["instructions"] = res.in_depth_description_and_process

        elif section == "post_activity":
            main_steps = "\n".join(concept.get("main_activity", {}).get("in_depth_description_and_process", []))
            system_prompt = (
                "You are an expert OCTAKIDZ curriculum designer. Return only JSON matching the PostActivity schema. "
                "Provide at least one follow-up task in extend_the_learning. "
                "Include how to improvise or level up, and a concise post-activity summary."
            )
            prompt = f"""
{common_context}
Main Activity Steps Completed:
{main_steps}

Regenerate a fresh POST-ACTIVITY section extending the learning for this activity:
- whats_next: exciting ideas on what the child can do next.
- extend_the_learning: at least 1 extension task or challenge.
- how_to_improvise_or_level_up: practical ways to increase difficulty or try alternatives with household items.
- post_activity_summary: clear summary of what was accomplished and learned.
"""
            res: PostActivity = self.ai.generate_structured(
                generation_type="activity_section_regeneration",
                prompt=prompt,
                schema_model=PostActivity,
                system_prompt=system_prompt,
                prompt_version="v3.0",
                metadata={"topic_id": topic.topic_id, "section": section, "concept_id": concept_id},
            )
            concept["post_activity"] = res.model_dump()
            concept["expected_output"] = res.post_activity_summary

        else:
            raise HTTPException(status_code=400, detail=f"Invalid section: {section}")

        return self._format_concept(concept)

    def approve_concept(
        self,
        session_id: str,
        concept_id: str,
    ) -> ActivityConceptResponse:
        session = ActivityReviewSessionStore.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Activity review session not found")
        concept = session.concepts.get(concept_id)
        if not concept:
            raise HTTPException(status_code=404, detail="Temporary activity concept not found")
        if concept["status"] == ActivityStatus.APPROVED.value:
            if any(
                record["concept_id"] == concept_id
                for record in self.repo.read_sheet("Activities")
            ):
                return self._format_concept(concept)
        if concept["status"] != "TEMPORARY":
            raise HTTPException(
                status_code=409,
                detail=f"Cannot approve a concept in {concept['status']} state",
            )
        self._require_eligible_topic(session.topic_id)
        existing = next(
            (
                record
                for record in self.repo.read_sheet("Activities")
                if record["concept_id"] == concept_id
            ),
            None,
        )
        if not existing:
            activity_id = f"ACT-{uuid.uuid4().hex[:8].upper()}"
            now = datetime.now().isoformat()
            activity = {
                "activity_id": activity_id,
                "concept_id": concept_id,
                "topic_id": concept["topic_id"],
                "title": concept["activity_name"],
                "description": concept["pre_activity"]["activity_description"],
                "instructions": "\n".join(
                    f"{index + 1}. {step}"
                    for index, step in enumerate(
                        concept["main_activity"]["in_depth_description_and_process"]
                    )
                ) or concept["main_activity"]["activity_step_task_title"],
                "expected_output": concept["post_activity"]["post_activity_summary"],
                "age_min": concept["age_min"],
                "age_max": concept["age_max"],
                "estimated_duration": concept["estimated_duration"],
                "status": ActivityStatus.APPROVED.value,
                "created_at": now,
                "updated_at": now,
                "learning_objective": concept.get("learning_objective"),
                "target_class": concept.get("target_class"),
                "materials": json.dumps(concept.get("materials", [])),
                "assessment_criteria": concept.get("assessment_criteria"),
                "difficulty_level": concept.get("difficulty_level"),
                "activity_type_id": concept["activity_type_id"],
                "generation_id": concept.get("generation_id"),
                "activity_name": concept["activity_name"],
                "activity_duration": concept["activity_duration"],
                "pre_activity": concept["pre_activity"],
                "main_activity": concept["main_activity"],
                "post_activity": concept["post_activity"],
                "topic_family_name": concept.get("topic_family_name"),
                "country_context": concept.get("country_context"),
                "keywords": concept.get("keywords", []),
                "user_selected_intelligence": concept.get("user_selected_intelligence"),
                "user_selected_skills": concept.get("user_selected_skills", []),
                "user_selected_sub_skills": concept.get("user_selected_sub_skills", []),
                "suggested_intelligence": concept.get("suggested_intelligence"),
                "suggested_skills": concept.get("suggested_skills", []),
                "suggested_sub_skills": concept.get("suggested_sub_skills", []),
            }
            approved_concept = {
                "concept_id": concept_id,
                "topic_id": concept["topic_id"],
                "activity_title": concept["activity_title"],
                "activity_type_id": concept["activity_type_id"],
                "activity_concept": concept["activity_concept"],
                "learner_task": concept["learner_task"],
                "expected_output": concept["expected_output"],
                "primary_skill_id": concept.get("primary_skill_id"),
                "primary_sub_skill_id": concept.get("primary_sub_skill_id"),
                "why_engaging": concept.get("why_engaging"),
                "status": ActivityStatus.APPROVED.value,
                "created_at": concept["created_at"],
                "generation_id": concept.get("generation_id"),
                "learning_objective": concept.get("learning_objective"),
                "materials": concept.get("materials", []),
                "instructions": concept.get("instructions", []),
                "assessment_criteria": concept.get("assessment_criteria"),
                "estimated_duration": concept.get("estimated_duration"),
                "difficulty_level": concept.get("difficulty_level"),
                "age_min": concept.get("age_min"),
                "age_max": concept.get("age_max"),
                "target_class": concept.get("target_class"),
                "activity_name": concept["activity_name"],
                "activity_duration": concept["activity_duration"],
                "pre_activity": concept["pre_activity"],
                "main_activity": concept["main_activity"],
                "post_activity": concept["post_activity"],
                "topic_family_name": concept.get("topic_family_name"),
                "country_context": concept.get("country_context"),
                "keywords": concept.get("keywords", []),
                "user_selected_intelligence": concept.get("user_selected_intelligence"),
                "user_selected_skills": concept.get("user_selected_skills", []),
                "user_selected_sub_skills": concept.get("user_selected_sub_skills", []),
                "suggested_intelligence": concept.get("suggested_intelligence"),
                "suggested_skills": concept.get("suggested_skills", []),
                "suggested_sub_skills": concept.get("suggested_sub_skills", []),
            }
            entries = [
                ("ActivityConcepts", approved_concept),
                ("Activities", activity),
            ]
            if concept.get("primary_skill_id") and concept.get("primary_sub_skill_id"):
                entries.append(
                    (
                        "ActivitySkills",
                        {
                            "activity_id": activity_id,
                            "skill_id": concept["primary_skill_id"],
                            "sub_skill_id": concept["primary_sub_skill_id"],
                            "relationship_type": RelationshipType.PRIMARY.value,
                        },
                    )
                )
            try:
                self.repo.append_records_atomic(entries)
            except ValueError:
                if not any(
                    record["concept_id"] == concept_id
                    for record in self.repo.read_sheet("Activities")
                ):
                    raise

        concept["status"] = ActivityStatus.APPROVED.value
        return self._format_concept(concept)

    def reject_concept(
        self,
        session_id: str,
        concept_id: str,
    ) -> ActivityConceptResponse:
        _, concept = self._get_temporary_concept(session_id, concept_id)
        concept["status"] = ActivityStatus.REJECTED.value
        try:
            from apps.api.core.firestore import firestore_manager
            firestore_manager.update_record("ActivityConcepts", concept_id, {"status": ActivityStatus.REJECTED.value})
        except Exception:
            pass
        return self._format_concept(concept)

    def get_concepts(self, topic_id: str, status: Optional[str] = None) -> List[ActivityConceptResponse]:
        concepts = self.repo.read_sheet("ActivityConcepts")
        filtered = [concept for concept in concepts if concept["topic_id"] == topic_id]
        if status:
            filtered = [concept for concept in filtered if concept["status"] == status.upper()]
        return [ActivityConceptResponse(**concept) for concept in filtered]

    def select_concept(self, concept_id: str) -> ActivityConceptResponse:
        concepts = self.repo.read_sheet("ActivityConcepts")
        concept = next((item for item in concepts if item["concept_id"] == concept_id), None)
        if not concept:
            raise HTTPException(status_code=404, detail="Concept not found")

        if any(
            item["topic_id"] == concept["topic_id"]
            and item["status"] == ActivityStatus.SELECTED.value
            and item["concept_id"] != concept_id
            for item in concepts
        ):
            raise HTTPException(status_code=400, detail="Another concept is already selected for this topic.")
        if concept["status"] != ActivityStatus.DRAFT.value:
            raise HTTPException(status_code=400, detail=f"Cannot select concept in {concept['status']} state.")

        updated = self.repo.update_record(
            "ActivityConcepts",
            concept_id,
            {"status": ActivityStatus.SELECTED.value},
        )
        return ActivityConceptResponse(**updated)

    def list_activities(self, search: Optional[str] = None, topic_id: Optional[str] = None) -> List[dict]:
        query = (search or "").strip().lower()
        topics = {topic["topic_id"]: topic for topic in self.repo.read_sheet("Topics")}
        topic_families = {f["topic_family_id"]: f["name"] for f in self.repo.read_sheet("TopicFamilies")}
        topic_keywords = self.repo.read_sheet("TopicKeywords")
        skills = {skill["skill_id"]: skill for skill in self.skills}
        sub_skills = {sub["sub_skill_id"]: sub for sub in self.sub_skills}
        activity_skills = self.repo.read_sheet("ActivitySkills")
        results = []
        for activity in self.repo.read_sheet("Activities"):
            if activity["status"] != ActivityStatus.APPROVED.value:
                continue
            if topic_id and activity["topic_id"] != topic_id:
                continue
            topic = topics.get(activity["topic_id"], {})
            if query and query not in (
                f"{activity['title']} {activity['description']} {topic.get('topic', '')}"
            ).lower():
                continue
            mapped_skills = []
            for mapping in activity_skills:
                if mapping["activity_id"] == activity["activity_id"]:
                    skill = skills.get(mapping["skill_id"], {})
                    sub_skill = sub_skills.get(mapping["sub_skill_id"], {})
                    mapped_skills.append({
                        "skill_id": mapping["skill_id"],
                        "skill_name": skill.get("name"),
                        "sub_skill_id": mapping["sub_skill_id"],
                        "sub_skill_name": sub_skill.get("name"),
                    })

            topic_fam_name = topic.get("topic_family_name") or topic_families.get(topic.get("topic_family_id"), "General")
            country_ctx = activity.get("country_context") or topic.get("country_context")
            kws = activity.get("keywords") or [k["keyword"] for k in topic_keywords if k.get("topic_id") == topic.get("topic_id")]

            u_intel = activity.get("user_selected_intelligence") or topic.get("user_selected_intelligence")
            u_skills = activity.get("user_selected_skills") or topic.get("user_selected_skills") or []
            u_sub = activity.get("user_selected_sub_skills") or topic.get("user_selected_sub_skills") or []

            s_intel = activity.get("suggested_intelligence") or topic.get("suggested_intelligence")
            s_skills = activity.get("suggested_skills") or topic.get("suggested_skills") or []
            s_sub = activity.get("suggested_sub_skills") or topic.get("suggested_sub_skills") or []

            mappings = {
                "user_selected": {
                    "intelligence": u_intel,
                    "skills": u_skills,
                    "sub_skills": u_sub,
                },
                "suggested": {
                    "intelligence": s_intel,
                    "skills": s_skills,
                    "sub_skills": s_sub,
                }
            }

            results.append({
                "activity": activity,
                "topic_title": topic.get("topic", "Unknown topic"),
                "topic_family_name": topic_fam_name,
                "country_context": country_ctx,
                "keywords": kws,
                "mappings": mappings,
                "skills": mapped_skills,
            })

        # Ensure latest approved activities show on top (newest created_at first)
        def _activity_sort_key(item: dict):
            act = item.get("activity", {})
            created = act.get("created_at")
            if not created:
                return (datetime.min, act.get("activity_id", ""))
            if isinstance(created, str):
                try:
                    created = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except Exception:
                    created = datetime.min
            return (created, act.get("activity_id", ""))

        results.sort(key=_activity_sort_key, reverse=True)
        return results

    def get_activity(self, activity_id: str) -> dict:
        activity = next(
            (
                record
                for record in self.repo.read_sheet("Activities")
                if record["activity_id"] == activity_id
                and record["status"] == ActivityStatus.APPROVED.value
            ),
            None,
        )
        if not activity:
            raise HTTPException(status_code=404, detail="Approved activity not found")
        item = next(
            (
                entry
                for entry in self.list_activities()
                if entry["activity"]["activity_id"] == activity_id
            ),
            None,
        )
        return item

    def edit_activity(self, activity_id: str, req: ActivityEditRequest, username: str = "editor") -> dict:
        activities = self.repo.read_sheet("Activities")
        activity = next((a for a in activities if a["activity_id"] == activity_id), None)
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found")

        old_activity = copy.deepcopy(activity)
        update_data = req.model_dump(exclude_unset=True)

        # Sync title and activity_name
        if "activity_name" in update_data and update_data["activity_name"]:
            update_data["title"] = update_data["activity_name"]
        elif "title" in update_data and update_data["title"]:
            update_data["activity_name"] = update_data["title"]

        # Parse JSON sections if provided as dicts or Pydantic models
        for sec in ("pre_activity", "main_activity", "post_activity"):
            if sec in update_data and update_data[sec] is not None:
                val = update_data[sec]
                if hasattr(val, "model_dump"):
                    update_data[sec] = val.model_dump()
                elif isinstance(val, str):
                    try:
                        update_data[sec] = json.loads(val)
                    except Exception:
                        pass

        # Update description, instructions, expected_output from sections if present
        if "pre_activity" in update_data and isinstance(update_data["pre_activity"], dict):
            pre_desc = update_data["pre_activity"].get("activity_description")
            if pre_desc:
                update_data["description"] = pre_desc

        if "main_activity" in update_data and isinstance(update_data["main_activity"], dict):
            steps = update_data["main_activity"].get("in_depth_description_and_process", [])
            if steps and isinstance(steps, list):
                update_data["instructions"] = "\n".join(f"{i+1}. {s}" for i, s in enumerate(steps))

        if "post_activity" in update_data and isinstance(update_data["post_activity"], dict):
            post_sum = update_data["post_activity"].get("post_activity_summary")
            if post_sum:
                update_data["expected_output"] = post_sum

        update_data["updated_at"] = datetime.now().isoformat()

        # Compute diffs
        diffs = []
        for key, new_val in update_data.items():
            if key in ("updated_at", "created_at"):
                continue
            old_val = old_activity.get(key)
            if old_val != new_val:
                diffs.append({
                    "field": key,
                    "old_value": json.dumps(old_val) if isinstance(old_val, (dict, list)) else str(old_val or ""),
                    "new_value": json.dumps(new_val) if isinstance(new_val, (dict, list)) else str(new_val or "")
                })

        # Check existing versions
        existing_versions = [v for v in self.repo.read_sheet("ActivityVersions") if v.get("activity_id") == activity_id]
        if not existing_versions:
            # Baseline version 1
            v1_data = {
                "version_id": f"ACT-VER-{uuid.uuid4().hex[:8].upper()}",
                "activity_id": activity_id,
                "version_number": 1,
                "content": json.dumps(old_activity),
                "change_summary": "Initial baseline version",
                "changes": json.dumps([]),
                "created_at": old_activity.get("created_at") or datetime.now().isoformat(),
                "created_by": "system"
            }
            self.repo.append_record("ActivityVersions", v1_data)
            existing_versions = [v1_data]

        # Update record in repo
        self.repo.update_record("Activities", activity_id, update_data)

        # Record new version
        changed_fields = [d["field"].replace("_", " ").title() for d in diffs]
        summary = f"Updated {', '.join(changed_fields[:3])}" if changed_fields else "Updated activity parameters"
        if len(changed_fields) > 3:
            summary += f" and {len(changed_fields) - 3} more fields"

        new_v_num = len(existing_versions) + 1
        merged_act = {**old_activity, **update_data}
        new_ver_data = {
            "version_id": f"ACT-VER-{uuid.uuid4().hex[:8].upper()}",
            "activity_id": activity_id,
            "version_number": new_v_num,
            "content": json.dumps(merged_act),
            "change_summary": summary,
            "changes": json.dumps(diffs),
            "created_at": datetime.now().isoformat(),
            "created_by": username or "editor"
        }
        self.repo.append_record("ActivityVersions", new_ver_data)

        return self.get_activity(activity_id)

    def delete_activity(self, activity_id: str) -> bool:
        self.repo.delete_record("Activities", activity_id)
        self.repo.delete_records_by("ActivitySkills", {"activity_id": activity_id})
        self.repo.delete_records_by("ActivityVersions", {"activity_id": activity_id})
        return True

    def get_activity_versions(self, activity_id: str) -> List[Dict[str, Any]]:
        raw_versions = [v for v in self.repo.read_sheet("ActivityVersions") if v.get("activity_id") == activity_id]
        if not raw_versions:
            activity = next((a for a in self.repo.read_sheet("Activities") if a["activity_id"] == activity_id), None)
            if activity:
                v1_data = {
                    "version_id": f"ACT-VER-{uuid.uuid4().hex[:8].upper()}",
                    "activity_id": activity_id,
                    "version_number": 1,
                    "content": json.dumps(activity),
                    "change_summary": "Initial baseline version",
                    "changes": json.dumps([]),
                    "created_at": activity.get("created_at") or datetime.now().isoformat(),
                    "created_by": "system"
                }
                self.repo.append_record("ActivityVersions", v1_data)
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
                "entity_id": v["activity_id"],
                "version_number": v["version_number"],
                "change_summary": v.get("change_summary") or f"Version {v['version_number']}",
                "changes": changes,
                "created_at": str(created_str),
                "created_by": v.get("created_by") or "editor",
                "content": content
            })

        result.sort(key=lambda x: x["version_number"], reverse=True)
        return result

    def restore_activity_version(self, activity_id: str, version_id: str, username: str = "editor") -> dict:
        versions = [v for v in self.repo.read_sheet("ActivityVersions") if v.get("activity_id") == activity_id]
        target_ver = next((v for v in versions if v.get("version_id") == version_id), None)
        if not target_ver:
            raise HTTPException(status_code=404, detail="Version record not found")

        try:
            content_dict = json.loads(target_ver["content"]) if isinstance(target_ver["content"], str) else target_ver["content"]
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to parse version snapshot: {e}")

        # Protect core identity fields
        restore_payload = {k: v for k, v in content_dict.items() if k not in ("activity_id", "created_at")}
        restore_payload["updated_at"] = datetime.now().isoformat()
        self.repo.update_record("Activities", activity_id, restore_payload)

        new_ver_num = len(versions) + 1
        new_ver_data = {
            "version_id": f"ACT-VER-{uuid.uuid4().hex[:8].upper()}",
            "activity_id": activity_id,
            "version_number": new_ver_num,
            "content": json.dumps({**content_dict, **restore_payload}),
            "change_summary": f"Restored from version {target_ver.get('version_number')}",
            "changes": json.dumps([{"field": "snapshot", "old_value": "Previous State", "new_value": f"Restored v{target_ver.get('version_number')}"}]),
            "created_at": datetime.now().isoformat(),
            "created_by": username or "editor"
        }
        self.repo.append_record("ActivityVersions", new_ver_data)
        return self.get_activity(activity_id)

    def delete_temporary_concept(self, session_id: str, concept_id: str) -> bool:
        session = ActivityReviewSessionStore.get(session_id)
        if session and concept_id in session.concepts:
            del session.concepts[concept_id]
        # Also clean from ActivityConcepts if present
        try:
            self.repo.delete_record("ActivityConcepts", concept_id)
        except Exception:
            pass
        return True
