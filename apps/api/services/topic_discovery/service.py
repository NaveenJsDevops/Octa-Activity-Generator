import json
from datetime import datetime
from typing import List, Optional, Dict, Any

from apps.api.repositories.excel import ExcelRepository
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
        excel_repo: ExcelRepository, 
        orchestrator: AIOrchestrator,
        prompt_registry: PromptRegistry
    ):
        self.excel_repo = excel_repo
        self.orchestrator = orchestrator
        self.prompt_registry = prompt_registry
        
        self.keyword_builder = KeywordBuilder()
        self.validator = TopicValidator()
        self.researcher = WebResearcher()
        
    def _generate_topic_id(self) -> str:
        topics = self.excel_repo.read_sheet("Topics")
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

        keyword_context = self.keyword_builder.build_context(request)
        
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
            web_research_context=web_research_context
        )
        
        ai_output: TopicDiscoveryOutput = self.orchestrator.generate_structured(
            generation_type="TOPIC_DISCOVERY",
            prompt=prompt_text,
            schema_model=TopicDiscoveryOutput,
            system_prompt=prompt_tmpl.system_prompt,
            prompt_version=prompt_tmpl.version
        )
        
        gen_runs = self.excel_repo.read_sheet("GenerationRuns")
        generation_id = gen_runs[-1]["generation_id"] if gen_runs else "UNKNOWN"
        
        # Create session
        session = SessionStore.create_session(request, ai_output.topics, generation_id)
        
        return {
            "session_id": session.session_id,
            "candidates": [c.model_dump() for c in ai_output.topics],
            "research_sources": search_results
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
        
        existing_topics = [Topic(**t) for t in self.excel_repo.read_sheet("Topics")]
        duplicate_checker = DuplicateChecker(existing_topics)
        
        is_valid, reason = self.validator.validate(candidate, request)
        if not is_valid:
            raise ValueError(f"Candidate invalid: {reason}")
            
        dup_check = duplicate_checker.check_candidate(candidate, existing_topics)
        if dup_check.is_duplicate:
            raise ValueError(f"Candidate is duplicate: {dup_check.reason}")
            
        new_topic_id = self._generate_topic_id()
        now = datetime.now()
        
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
            generation_id=session.generation_id
        )
        
        self.excel_repo.append_record("Topics", topic.model_dump(mode='json'))

        for kw in candidate.keywords:
            tkw = TopicKeyword(
                topic_id=new_topic_id,
                keyword=kw,
                source="AI_GENERATED"
            )
            self.excel_repo.append_record("TopicKeywords", tkw.model_dump(mode='json'))
            
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
