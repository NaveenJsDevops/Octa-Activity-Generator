import json
from datetime import datetime
from typing import List, Optional, Dict, Any

from apps.api.repositories.firestore import FirestoreRepository
from apps.api.services.ai.orchestrator import AIOrchestrator
from apps.api.services.ai.prompts.registry import PromptRegistry, PromptTemplate
from apps.api.models.domain import Topic, TopicSkill, TopicKeyword, Intelligence, Skill, SubSkill
from apps.api.core.topic_families import TOPIC_FAMILY_NAMES
from apps.api.models.enums import TopicStatus, RelationshipType
from apps.api.models.topic_discovery import (
    TopicDiscoveryRequest, TopicCandidate, TopicDiscoveryOutput, 
    TopicDiscoveryResult, RejectedCandidate, DuplicateCheckResult
)

from .keyword_builder import KeywordBuilder
from .skill_resolver import SkillResolver
from .duplicate_checker import DuplicateChecker
from .validator import TopicValidator
from .web_research import WebResearcher
from .session_store import SessionStore

class TopicDiscoveryService:
    def __init__(
        self, 
        repo: FirestoreRepository, 
        orchestrator: AIOrchestrator,
        prompt_registry: PromptRegistry
    ):
        self.repo = repo
        self.orchestrator = orchestrator
        self.prompt_registry = prompt_registry
        
        self.keyword_builder = KeywordBuilder()
        self.validator = TopicValidator()
        self.researcher = WebResearcher()
        
    def _generate_topic_id(self) -> str:
        topics = self.repo.read_sheet("Topics")
        if not topics:
            return "TOP-000001"
        
        max_id = 0
        for t in topics:
            tid = t.get("topic_id", "")
            if tid.startswith("TOP-"):
                try:
                    num = int(tid.split("-")[1])
                    if num > max_id:
                        max_id = num
                except ValueError:
                    pass
        return f"TOP-{(max_id + 1):06d}"

    def discover_topics(self, request: TopicDiscoveryRequest, generated_by: str = "system") -> Dict[str, Any]:
        """Performs web research and AI generation to yield temporary candidates."""
        topic_family_name = "Any"
        if request.topic_family_id:
            topic_family_name = TOPIC_FAMILY_NAMES.get(request.topic_family_id, "")
            if not topic_family_name:
                raise ValueError(f"topic_family_id {request.topic_family_id} does not exist")

        # Resolve master data names for user-selected parameters
        intelligences = self.repo.read_sheet("Intelligences")
        skills = self.repo.read_sheet("Skills")
        sub_skills = self.repo.read_sheet("SubSkills")

        intel_name = request.intelligence_name
        if not intel_name and request.intelligence_id:
            intel_name = next((i["name"] for i in intelligences if i.get("intelligence_id") == request.intelligence_id), None)

        skill_name = request.skill_name
        if not skill_name and request.skill_id:
            skill_name = next((s["name"] for s in skills if s.get("skill_id") == request.skill_id), None)

        sub_skill_name = request.sub_skill_name
        if not sub_skill_name and request.sub_skill_id:
            sub_skill_name = next((ss["name"] for ss in sub_skills if ss.get("sub_skill_id") == request.sub_skill_id), None)

        # Build educational focus guidance based on user selections
        focus_lines = []
        if intel_name:
            focus_lines.append(f"Target Intelligence: {intel_name}")
        if skill_name:
            focus_lines.append(f"Target Skill: {skill_name}")
        if sub_skill_name:
            focus_lines.append(f"Target Sub-skill: {sub_skill_name}")

        if focus_lines:
            educational_focus = (
                "User-Selected Focus Parameters (Incorporate into topic discovery):\n"
                + "\n".join(f"- {line}" for line in focus_lines)
                + "\nAlign the topic ideas to cultivate these user-selected parameters, while also providing AI-recommended suggested intelligence, skills, and sub-skills."
            )
        else:
            educational_focus = (
                "User-Selected Focus Parameters: None (Open Discovery). Discover rich, engaging topics across various domains and recommend suggested intelligence, skills, and sub-skills for each."
            )

        keyword_context = self.keyword_builder.build_context(
            request,
            intelligence_name=intel_name,
            skill_name=skill_name,
            sub_skill_name=sub_skill_name
        )
        
        # Web Research
        search_results = self.researcher.search(request.keywords, max_results=3)
        web_research_context = json.dumps(search_results, indent=2) if search_results else "No web results found."
        
        prompt_tmpl = self.prompt_registry.get_prompt("topic_discovery", "v1.1")
        if not prompt_tmpl:
            raise ValueError("Topic discovery prompt v1.1 not found in registry")
            
        prompt_text = prompt_tmpl.user_prompt_template.format(
            age_min=request.age_min,
            age_max=request.age_max,
            target_class=request.target_class or "N/A",
            country_context=request.country_context or "Global",
            topic_family_name=topic_family_name,
            requested_count=request.requested_count,
            keyword_context=json.dumps(keyword_context),
            web_research_context=web_research_context,
            educational_focus=educational_focus
        )
        
        ai_output: TopicDiscoveryOutput = self.orchestrator.generate_structured(
            generation_type="TOPIC_DISCOVERY",
            prompt=prompt_text,
            schema_model=TopicDiscoveryOutput,
            system_prompt=prompt_tmpl.system_prompt,
            prompt_version=prompt_tmpl.version
        )

        # Attach user selection parameters separately to every candidate
        for c in ai_output.topics:
            c.user_selected_intelligence = intel_name
            c.user_selected_skills = [skill_name] if skill_name else []
            c.user_selected_sub_skills = [sub_skill_name] if sub_skill_name else []
        
        gen_runs = self.repo.read_sheet("GenerationRuns")
        generation_id = gen_runs[-1]["generation_id"] if gen_runs else "UNKNOWN"
        
        # Create session
        session = SessionStore.create_session(request, ai_output.topics, generation_id)
        
        return {
            "session_id": session.session_id,
            "candidates": [c.model_dump() for c in ai_output.topics],
            "research_sources": search_results,
            "user_selections": {
                "intelligence_id": request.intelligence_id,
                "intelligence_name": intel_name,
                "skill_id": request.skill_id,
                "skill_name": skill_name,
                "sub_skill_id": request.sub_skill_id,
                "sub_skill_name": sub_skill_name,
            }
        }
        
    def keep_candidate(self, session_id: str, index: int, generated_by: str = "system") -> Dict[str, Any]:
        """Validates and persists a candidate from the session."""
        session = SessionStore.get_session(session_id)
        if not session:
            raise ValueError("Invalid or expired session ID")
            
        if index < 0 or index >= len(session.candidates):
            raise ValueError("Invalid candidate index")
            
        candidate = session.candidates[index]
        request = session.request
        
        existing_topics = [Topic(**t) for t in self.repo.read_sheet("Topics")]
        duplicate_checker = DuplicateChecker(existing_topics)
        
        is_valid, reason = self.validator.validate(candidate, request)
        if not is_valid:
            raise ValueError(f"Candidate invalid: {reason}")
            
        dup_check = duplicate_checker.check_candidate(candidate, existing_topics)
        if dup_check.is_duplicate:
            raise ValueError(f"Candidate is duplicate: {dup_check.reason}")
            
        new_topic_id = self._generate_topic_id()
        now = datetime.now()

        # Resolve user selected names from request if not already on candidate
        intelligences = self.repo.read_sheet("Intelligences")
        skills = self.repo.read_sheet("Skills")
        sub_skills = self.repo.read_sheet("SubSkills")

        u_intel = candidate.user_selected_intelligence or request.intelligence_name
        if not u_intel and request.intelligence_id:
            u_intel = next((i["name"] for i in intelligences if i.get("intelligence_id") == request.intelligence_id), None)

        u_skills = list(candidate.user_selected_skills or [])
        if not u_skills and request.skill_name:
            u_skills.append(request.skill_name)
        elif not u_skills and request.skill_id:
            s_name = next((s["name"] for s in skills if s.get("skill_id") == request.skill_id), None)
            if s_name:
                u_skills.append(s_name)

        u_sub_skills = list(candidate.user_selected_sub_skills or [])
        if not u_sub_skills and request.sub_skill_name:
            u_sub_skills.append(request.sub_skill_name)
        elif not u_sub_skills and request.sub_skill_id:
            ss_name = next((ss["name"] for ss in sub_skills if ss.get("sub_skill_id") == request.sub_skill_id), None)
            if ss_name:
                u_sub_skills.append(ss_name)
        
        topic = Topic(
            topic_id=new_topic_id,
            topic=candidate.topic,
            short_description=candidate.short_description,
            topic_family_id=request.topic_family_id,
            age_min=request.age_min,
            age_max=request.age_max,
            target_class=request.target_class,
            country_context=request.country_context,
            full_description=candidate.full_description,
            activity_potential=candidate.activity_potential.upper().strip(),
            age_suitability=candidate.age_suitability,
            status=TopicStatus.DRAFT,
            created_at=now,
            updated_at=now,
            created_by=generated_by,
            generation_id=session.generation_id,
            user_selected_intelligence=u_intel,
            user_selected_skills=u_skills,
            user_selected_sub_skills=u_sub_skills,
            suggested_intelligence=candidate.suggested_intelligence,
            suggested_skills=candidate.suggested_skills or [],
            suggested_sub_skills=candidate.suggested_sub_skills or []
        )
        
        self.repo.append_record("Topics", topic.model_dump(mode='json'))

        for kw in candidate.keywords:
            tkw = TopicKeyword(
                topic_id=new_topic_id,
                keyword=kw,
                source="AI_GENERATED"
            )
            self.repo.append_record("TopicKeywords", tkw.model_dump(mode='json'))

        # 1. User-selected primary skill link
        primary_skill_id = getattr(request, 'skill_id', None)
        if primary_skill_id:
            sub_id = getattr(request, 'sub_skill_id', None)
            if not sub_id:
                matching = next((ss["sub_skill_id"] for ss in sub_skills if ss.get("skill_id") == primary_skill_id), None)
                sub_id = matching
            if sub_id:
                tskill = TopicSkill(
                    topic_id=new_topic_id,
                    skill_id=primary_skill_id,
                    sub_skill_id=sub_id,
                    relationship_type=RelationshipType.PRIMARY
                )
                self.repo.append_record("TopicSkills", tskill.model_dump(mode='json'))

        # 2. AI-suggested secondary skill links if matched in master data
        if candidate.suggested_skills:
            resolver = SkillResolver(
                [Skill(**s) for s in skills],
                [SubSkill(**ss) for ss in sub_skills]
            )
            resolved_s = resolver.resolve_skills(candidate.suggested_skills)
            for r_skill in resolved_s:
                if r_skill.skill_id == primary_skill_id:
                    continue
                # Find matching sub-skill for this skill
                matched_sub = next((ss["sub_skill_id"] for ss in sub_skills if ss.get("skill_id") == r_skill.skill_id), None)
                if matched_sub:
                    tskill = TopicSkill(
                        topic_id=new_topic_id,
                        skill_id=r_skill.skill_id,
                        sub_skill_id=matched_sub,
                        relationship_type=RelationshipType.SECONDARY
                    )
                    self.repo.append_record("TopicSkills", tskill.model_dump(mode='json'))
            
        return {"status": "success", "topic": topic.model_dump()}

    def reject_candidate(self, session_id: str, index: int) -> Dict[str, Any]:
        """Rejects a candidate (does not persist)."""
        session = SessionStore.get_session(session_id)
        if not session:
            raise ValueError("Invalid or expired session ID")
            
        if index < 0 or index >= len(session.candidates):
            raise ValueError("Invalid candidate index")
            
        return {"status": "success", "message": "Candidate rejected"}

    def keep_all(self, session_id: str, generated_by: str = "system") -> Dict[str, Any]:
        """Attempts to keep all valid, non-duplicate candidates in a session."""
        session = SessionStore.get_session(session_id)
        if not session:
            raise ValueError("Invalid or expired session ID")
            
        results = []
        for index in range(len(session.candidates)):
            try:
                res = self.keep_candidate(session_id, index, generated_by)
                results.append({"index": index, "status": "kept", "topic_id": res["topic"]["topic_id"]})
            except ValueError as e:
                results.append({"index": index, "status": "rejected", "reason": str(e)})
                
        return {"results": results}
