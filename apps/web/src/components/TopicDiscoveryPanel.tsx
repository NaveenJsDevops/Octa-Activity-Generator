/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  Check,
  Globe,
  CheckCircle,
  ArrowRight,
  UserCheck,
  Compass,
  Edit3,
  RotateCcw,
  ExternalLink,
} from "lucide-react";
import {
  discoverTopics,
  keepCandidate,
  rejectCandidate,
  keepAllCandidates,
  editCandidate,
  TopicDiscoveryRequest,
  TopicDiscoveryResult,
} from "@/lib/api/topicDiscovery";
import { API_BASE_URL } from "@/lib/apiBase";
import {
  fetchMasterData,
  DEFAULT_INTELLIGENCES,
  DEFAULT_SKILLS,
  DEFAULT_SUBSKILLS,
  MasterIntelligence,
  MasterSkill,
  MasterSubSkill,
  MasterTopicFamily,
} from "@/lib/apiCache";

const FORM_STORAGE_KEY = "octa_topic_form_state_v1";

interface SavedFormState {
  searchText: string;
  keywords: string[];
  ageMin: number;
  ageMax: number;
  targetClass: string;
  topicFamilyId: string;
  countryContext: string;
  requestedCount: number;
  selectedIntelligenceId: string;
  selectedSkillId: string;
  selectedSubSkillId: string;
}

const TOPIC_FAMILIES: MasterTopicFamily[] = [
  { topic_family_id: "tf-001", name: "Space Exploration" },
  { topic_family_id: "tf-animals-wildlife", name: "Animals & Wildlife" },
  { topic_family_id: "tf-nature-environment", name: "Nature & Environment" },
  { topic_family_id: "tf-science-technology", name: "Science & Technology" },
  { topic_family_id: "tf-arts-creativity", name: "Arts & Creativity" },
  { topic_family_id: "tf-culture-community", name: "Culture & Community" },
  { topic_family_id: "tf-history-geography", name: "History & Geography" },
  { topic_family_id: "tf-health-wellbeing", name: "Health & Wellbeing" },
  { topic_family_id: "tf-food-nutrition", name: "Food & Nutrition" },
  { topic_family_id: "tf-sports-movement", name: "Sports & Movement" },
  { topic_family_id: "tf-math-logic", name: "Math & Logic" },
  { topic_family_id: "tf-language-literacy", name: "Language & Literacy" },
];

const CLASS_OPTIONS = ["Grade 6", "Grade 7", "Grade 8", "Grade 9"];

interface TopicDiscoveryPanelProps {
  onTopicsGenerated: () => void;
  aiConfigured: boolean | null;
}

export default function TopicDiscoveryPanel({ onTopicsGenerated, aiConfigured }: TopicDiscoveryPanelProps) {
  const router = useRouter();

  // Form states
  const [searchText, setSearchText] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState(10);
  const [ageMax, setAgeMax] = useState(12);
  const [targetClass, setTargetClass] = useState<string>("Grade 9");
  const [countryContext, setCountryContext] = useState("India");
  const [requestedCount, setRequestedCount] = useState(1);
  const [topicFamilyId, setTopicFamilyId] = useState("");

  // Master data and cascading selector states
  const [topicFamilies, setTopicFamilies] = useState<MasterTopicFamily[]>(TOPIC_FAMILIES);
  const [intelligences, setIntelligences] = useState<MasterIntelligence[]>(DEFAULT_INTELLIGENCES);
  const [skills, setSkills] = useState<MasterSkill[]>(DEFAULT_SKILLS);
  const [subSkills, setSubSkills] = useState<MasterSubSkill[]>(DEFAULT_SUBSKILLS);

  const [selectedIntelligenceId, setSelectedIntelligenceId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedSubSkillId, setSelectedSubSkillId] = useState("");

  const [isHydrated, setIsHydrated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Session & candidates
  const [session, setSession] = useState<TopicDiscoveryResult | null>(null);
  const [candidateStatuses, setCandidateStatuses] = useState<Record<number, "PENDING" | "KEPT" | "REJECTED" | "ERROR">>({});
  const [candidateErrors, setCandidateErrors] = useState<Record<number, string>>({});
  const [keptTopicMap, setKeptTopicMap] = useState<Record<number, string>>({});
  const [approvingTopicId, setApprovingTopicId] = useState<string | null>(null);

  // In-place editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTopic, setEditTopic] = useState("");
  const [editShortDescription, setEditShortDescription] = useState("");
  const [editFullDescription, setEditFullDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [editedIndices, setEditedIndices] = useState<Record<number, boolean>>({});

  // Web Sources Modal state
  const [isSourcesModalOpen, setIsSourcesModalOpen] = useState(false);

  // 1. Restore form state from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(FORM_STORAGE_KEY);
      if (raw) {
        const data: Partial<SavedFormState> = JSON.parse(raw);
        if (typeof data.searchText === "string") setSearchText(data.searchText);
        if (Array.isArray(data.keywords)) setKeywords(data.keywords);
        if (typeof data.ageMin === "number") setAgeMin(data.ageMin);
        if (typeof data.ageMax === "number") setAgeMax(data.ageMax);
        if (typeof data.targetClass === "string") setTargetClass(data.targetClass);
        if (typeof data.topicFamilyId === "string") setTopicFamilyId(data.topicFamilyId);
        if (typeof data.countryContext === "string") setCountryContext(data.countryContext);
        if (typeof data.requestedCount === "number") setRequestedCount(data.requestedCount);
        if (typeof data.selectedIntelligenceId === "string") setSelectedIntelligenceId(data.selectedIntelligenceId);
        if (typeof data.selectedSkillId === "string") setSelectedSkillId(data.selectedSkillId);
        if (typeof data.selectedSubSkillId === "string") setSelectedSubSkillId(data.selectedSubSkillId);
      }
    } catch (err) {
      console.error("Failed to restore topic form state from sessionStorage:", err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // 2. Persist form state to sessionStorage whenever inputs change (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    try {
      const stateToSave: SavedFormState = {
        searchText,
        keywords,
        ageMin,
        ageMax,
        targetClass,
        topicFamilyId,
        countryContext,
        requestedCount,
        selectedIntelligenceId,
        selectedSkillId,
        selectedSubSkillId,
      };
      sessionStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch (err) {
      console.error("Failed to persist topic form state to sessionStorage:", err);
    }
  }, [
    isHydrated,
    searchText,
    keywords,
    ageMin,
    ageMax,
    targetClass,
    topicFamilyId,
    countryContext,
    requestedCount,
    selectedIntelligenceId,
    selectedSkillId,
    selectedSubSkillId,
  ]);

  // Load master data
  useEffect(() => {
    fetchMasterData()
      .then(data => {
        if (data.intelligences?.length) setIntelligences(data.intelligences);
        if (data.skills?.length) setSkills(data.skills);
        if (data.subSkills?.length) setSubSkills(data.subSkills);
        if (data.topicFamilies?.length) setTopicFamilies(data.topicFamilies);
      })
      .catch(() => {
        // Fallbacks already set
      });
  }, []);

  // Filter skills based on selected intelligence (only show skills for the selected intelligence)
  const filteredSkills = useMemo(() => {
    if (!selectedIntelligenceId) return [];
    return skills.filter(s => s.intelligence_id === selectedIntelligenceId);
  }, [skills, selectedIntelligenceId]);

  // Filter sub-skills based on selected skill or selected intelligence
  const filteredSubSkills = useMemo(() => {
    if (selectedSkillId) {
      return subSkills.filter(ss => ss.skill_id === selectedSkillId);
    }
    if (selectedIntelligenceId) {
      const allowedSkillIds = new Set(
        skills.filter(s => s.intelligence_id === selectedIntelligenceId).map(s => s.skill_id)
      );
      return subSkills.filter(ss => allowedSkillIds.has(ss.skill_id));
    }
    return [];
  }, [subSkills, skills, selectedSkillId, selectedIntelligenceId]);

  const selectedIntelligenceName = useMemo(() => {
    return intelligences.find(i => i.intelligence_id === selectedIntelligenceId)?.name;
  }, [intelligences, selectedIntelligenceId]);

  const selectedSkillName = useMemo(() => {
    return skills.find(s => s.skill_id === selectedSkillId)?.name;
  }, [skills, selectedSkillId]);

  const selectedSubSkillName = useMemo(() => {
    return subSkills.find(ss => ss.sub_skill_id === selectedSubSkillId)?.name;
  }, [subSkills, selectedSubSkillId]);

  const handleIntelligenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newIntelId = e.target.value;
    setSelectedIntelligenceId(newIntelId);
    // Reset child skill and sub-skill when intelligence changes or resets
    setSelectedSkillId("");
    setSelectedSubSkillId("");
  };

  const handleSkillChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    setSelectedSkillId(sId);
    if (sId) {
      const match = skills.find(s => s.skill_id === sId);
      if (match?.intelligence_id && match.intelligence_id !== selectedIntelligenceId) {
        setSelectedIntelligenceId(match.intelligence_id);
      }
      if (selectedSubSkillId) {
        const matchSub = subSkills.find(ss => ss.sub_skill_id === selectedSubSkillId);
        if (matchSub && matchSub.skill_id !== sId) {
          setSelectedSubSkillId("");
        }
      }
    } else {
      setSelectedSubSkillId("");
    }
  };

  const handleSubSkillChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ssId = e.target.value;
    setSelectedSubSkillId(ssId);
    if (ssId) {
      const matchSub = subSkills.find(ss => ss.sub_skill_id === ssId);
      if (matchSub?.skill_id) {
        setSelectedSkillId(matchSub.skill_id);
        const matchSkill = skills.find(s => s.skill_id === matchSub.skill_id);
        if (matchSkill?.intelligence_id) {
          setSelectedIntelligenceId(matchSkill.intelligence_id);
        }
      }
    }
  };

  const clearEducationalSelections = () => {
    setSelectedIntelligenceId("");
    setSelectedSkillId("");
    setSelectedSubSkillId("");
  };

  const handleResetForm = () => {
    setSearchText("");
    setKeywordInput("");
    setKeywords([]);
    setAgeMin(10);
    setAgeMax(12);
    setTargetClass("Grade 9");
    setCountryContext("India");
    setRequestedCount(1);
    setTopicFamilyId("");
    setSelectedIntelligenceId("");
    setSelectedSkillId("");
    setSelectedSubSkillId("");
    setError("");
    try {
      sessionStorage.removeItem(FORM_STORAGE_KEY);
    } catch (err) {
      console.error("Failed to clear form sessionStorage:", err);
    }
  };

  const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = keywordInput.trim().replace(/,$/, "");
      if (val && !keywords.includes(val)) {
        setKeywords([...keywords, val]);
      }
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  const handleGenerate = async () => {
    const effectiveKeywords = keywords.length > 0 ? keywords : (searchText.trim() ? [searchText.trim()] : []);

    if (effectiveKeywords.length === 0) {
      setError("Please describe the kind of activity you're looking for or add keywords.");
      return;
    }

    if (ageMin > ageMax) {
      setError("Maximum age must be greater than or equal to minimum age.");
      return;
    }

    setError("");
    setGenerating(true);
    setSession(null);
    setCandidateStatuses({});
    setCandidateErrors({});
    setKeptTopicMap({});
    setEditingIndex(null);
    setEditedIndices({});

    try {
      const request: TopicDiscoveryRequest = {
        keywords: effectiveKeywords,
        age_min: ageMin,
        age_max: ageMax,
        target_class: targetClass || undefined,
        country_context: countryContext || undefined,
        topic_family_id: topicFamilyId || undefined,
        intelligence_id: selectedIntelligenceId || undefined,
        intelligence_name: selectedIntelligenceName || undefined,
        skill_id: selectedSkillId || undefined,
        skill_name: selectedSkillName || undefined,
        sub_skill_id: selectedSubSkillId || undefined,
        sub_skill_name: selectedSubSkillName || undefined,
        requested_count: requestedCount,
      };

      const res = await discoverTopics(request);
      setSession(res);
      const initialStatuses: Record<number, "PENDING"> = {};
      res.candidates.forEach((_, i) => (initialStatuses[i] = "PENDING"));
      setCandidateStatuses(initialStatuses);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during generation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAndGenerate = async (topicId: string) => {
    setApprovingTopicId(topicId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/topics/${topicId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to approve topic");
      }
      router.push(`/activities?topic_id=${topicId}`);
    } catch (err: any) {
      alert(err.message || "Approval failed");
      setApprovingTopicId(null);
    }
  };

  const handleKeep = async (index: number) => {
    if (!session) return;
    try {
      setCandidateStatuses(prev => ({ ...prev, [index]: "PENDING" }));
      const res = await keepCandidate(session.session_id, index);
      const topicId = res?.topic?.topic_id;
      if (topicId) {
        setKeptTopicMap(prev => ({ ...prev, [index]: topicId }));
      }
      setCandidateStatuses(prev => ({ ...prev, [index]: "KEPT" }));
      setCandidateErrors(prev => ({ ...prev, [index]: "" }));
      onTopicsGenerated();
    } catch (err: any) {
      setCandidateStatuses(prev => ({ ...prev, [index]: "ERROR" }));
      setCandidateErrors(prev => ({ ...prev, [index]: err.message || "Validation/Duplicate error" }));
    }
  };

  const handleKeepAndGenerate = async (index: number) => {
    if (!session) return;
    try {
      setCandidateStatuses(prev => ({ ...prev, [index]: "PENDING" }));
      const res = await keepCandidate(session.session_id, index);
      const topicId = res?.topic?.topic_id;
      if (!topicId) throw new Error("Topic saved but no topic ID was returned");
      setKeptTopicMap(prev => ({ ...prev, [index]: topicId }));
      setCandidateStatuses(prev => ({ ...prev, [index]: "KEPT" }));
      setCandidateErrors(prev => ({ ...prev, [index]: "" }));
      onTopicsGenerated();
      await handleApproveAndGenerate(topicId);
    } catch (err: any) {
      setCandidateStatuses(prev => ({ ...prev, [index]: "ERROR" }));
      setCandidateErrors(prev => ({ ...prev, [index]: err.message || "Validation/Duplicate error" }));
    }
  };

  const handleReject = async (index: number) => {
    if (!session) return;
    try {
      await rejectCandidate(session.session_id, index);
      setCandidateStatuses(prev => ({ ...prev, [index]: "REJECTED" }));
    } catch {
      setCandidateStatuses(prev => ({ ...prev, [index]: "REJECTED" }));
    }
  };

  const handleKeepAll = async () => {
    if (!session) return;
    if (!confirm("Save all valid discovered topics to the Topic Library?")) return;
    try {
      const res = await keepAllCandidates(session.session_id);
      const newStatuses = { ...candidateStatuses };
      const newErrors = { ...candidateErrors };
      const newKeptMap = { ...keptTopicMap };
      res.results.forEach((r: any) => {
        const idx = r.index;
        if (r.status === "kept") {
          newStatuses[idx] = "KEPT";
          newErrors[idx] = "";
          if (r.topic?.topic_id) {
            newKeptMap[idx] = r.topic.topic_id;
          }
        } else {
          newStatuses[idx] = "ERROR";
          newErrors[idx] = r.reason;
        }
      });
      setKeptTopicMap(newKeptMap);
      setCandidateStatuses(newStatuses);
      setCandidateErrors(newErrors);
      onTopicsGenerated();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // In-place candidate editing handlers
  const handleStartEdit = (index: number) => {
    if (!session || !session.candidates[index]) return;
    const c = session.candidates[index];
    setEditingIndex(index);
    setEditTopic(c.topic || "");
    setEditShortDescription(c.short_description || "");
    setEditFullDescription(c.full_description || "");
    setEditError("");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditTopic("");
    setEditShortDescription("");
    setEditFullDescription("");
    setEditError("");
  };

  const handleSaveEdit = async (index: number) => {
    if (!session) return;
    if (!editTopic.trim()) {
      setEditError("Topic title cannot be empty.");
      return;
    }
    if (!editShortDescription.trim()) {
      setEditError("Short description cannot be empty.");
      return;
    }

    setSavingEdit(true);
    setEditError("");
    try {
      await editCandidate(session.session_id, index, {
        topic: editTopic.trim(),
        short_description: editShortDescription.trim(),
        full_description: editFullDescription.trim() || undefined,
      });

      // Update in-place in session state
      const updatedCandidates = [...session.candidates];
      updatedCandidates[index] = {
        ...updatedCandidates[index],
        topic: editTopic.trim(),
        short_description: editShortDescription.trim(),
        full_description: editFullDescription.trim() || updatedCandidates[index].full_description,
      };
      setSession({
        ...session,
        candidates: updatedCandidates,
      });
      setEditedIndices(prev => ({ ...prev, [index]: true }));
      setEditingIndex(null);
    } catch (err: any) {
      setEditError(err.message || "Failed to save edits");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header with Reset Form action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Discover Activity Topics</h1>
          <p className="text-slate-500 mt-1.5 text-[15px]">Describe the kind of activity you want and refine it with a few details.</p>
        </div>
        <button
          onClick={handleResetForm}
          type="button"
          className="self-start sm:self-auto px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
          title="Reset all form fields to default"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Form</span>
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Main form card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        {/* Big search input */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            What kind of activity are you looking for?
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleGenerate()}
              placeholder="e.g. A creative space activity where Grade 6 students design a Mars survival solution"
              disabled={generating}
              className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] transition-all"
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Tip: describe the theme, learner task, or type of experience you want.</p>
        </div>

        {/* Filters row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Keywords */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Keywords</label>
            <div className="min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 border border-slate-200 rounded-xl bg-white focus-within:ring-2 focus-within:ring-[#5B50F5] focus-within:border-[#5B50F5] transition-all">
              <input
                type="text"
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={handleAddKeyword}
                placeholder={keywords.length === 0 ? "Type and press Enter, e.g. space, teamwork" : "Add another..."}
                disabled={generating}
                className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
              />
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map(kw => (
                  <span key={kw} className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#ECEFFE] text-[#5B50F5] text-xs rounded-full font-medium">
                    {kw}
                    <button onClick={() => removeKeyword(kw)} className="hover:text-[#4740d4]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Learner Age */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Learner Age</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                value={ageMin}
                onChange={e => setAgeMin(Number(e.target.value))}
                disabled={generating}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5]"
                placeholder="Min"
              />
              <span className="text-slate-400 text-sm shrink-0">–</span>
              <input
                type="number"
                min="0"
                value={ageMax}
                onChange={e => setAgeMax(Number(e.target.value))}
                disabled={generating}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5]"
                placeholder="Max"
              />
              <span className="text-xs text-slate-400 shrink-0">years</span>
            </div>
          </div>

          {/* Class */}
          <div>
            <label htmlFor="target-class" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Class</label>
            <select
              id="target-class"
              value={targetClass}
              onChange={e => setTargetClass(e.target.value)}
              disabled={generating}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] disabled:bg-slate-50 disabled:text-slate-400"
            >
              {CLASS_OPTIONS.map(classOption => (
                <option key={classOption} value={classOption}>
                  {classOption}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filters row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Topic Family */}
          <div>
            <label htmlFor="topic-family" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Topic Family</label>
            <select
              id="topic-family"
              value={topicFamilyId}
              onChange={e => setTopicFamilyId(e.target.value)}
              disabled={generating}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">Any topic family (optional)</option>
              {topicFamilies.map(family => (
                <option key={family.topic_family_id} value={family.topic_family_id}>
                  {family.name}
                </option>
              ))}
            </select>
          </div>

          {/* Country Context */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Country Context</label>
            <input
              type="text"
              value={countryContext}
              onChange={e => setCountryContext(e.target.value)}
              disabled={generating}
              placeholder="e.g. India, USA"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5]"
            />
          </div>

          {/* Number of Topics */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">Number of Topics</label>
            <input
              type="number"
              min="1"
              max="10"
              value={requestedCount}
              onChange={e => setRequestedCount(Number(e.target.value))}
              disabled={generating}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5]"
            />
          </div>
        </div>

        {/* Filters row 3: Optional Intelligence -> Skill -> Sub Skill */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#5B50F5]" />
              Educational Focus (Optional Selection Parameters)
            </span>
            {(selectedIntelligenceId || selectedSkillId || selectedSubSkillId) && (
              <button
                type="button"
                onClick={clearEducationalSelections}
                className="text-xs font-semibold text-[#5B50F5] hover:text-[#4740d4] hover:underline"
              >
                Clear focus selections
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Intelligence */}
            <div>
              <label htmlFor="intelligence" className="block text-xs font-medium text-slate-500 mb-1">Intelligence</label>
              <select
                id="intelligence"
                value={selectedIntelligenceId}
                onChange={handleIntelligenceChange}
                disabled={generating}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">Any intelligence (optional)</option>
                {intelligences.map(intel => (
                  <option key={intel.intelligence_id} value={intel.intelligence_id}>
                    {intel.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Skill */}
            <div>
              <label htmlFor="skill" className="block text-xs font-medium text-slate-500 mb-1">Skill</label>
              <select
                id="skill"
                value={selectedSkillId}
                onChange={handleSkillChange}
                disabled={generating || !selectedIntelligenceId}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {selectedIntelligenceId
                    ? `Any skill in ${selectedIntelligenceName || "intelligence"} (optional)`
                    : "Select intelligence first"}
                </option>
                {filteredSkills.map(sk => (
                  <option key={sk.skill_id} value={sk.skill_id}>
                    {sk.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub Skill */}
            <div>
              <label htmlFor="sub-skill" className="block text-xs font-medium text-slate-500 mb-1">Sub Skill</label>
              <select
                id="sub-skill"
                value={selectedSubSkillId}
                onChange={handleSubSkillChange}
                disabled={generating || !selectedIntelligenceId || filteredSubSkills.length === 0}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="">
                  {!selectedIntelligenceId
                    ? "Select intelligence first"
                    : selectedSkillId
                    ? `Any sub skill in ${selectedSkillName || "skill"} (optional)`
                    : `Any sub skill in ${selectedIntelligenceName || "intelligence"} (optional)`}
                </option>
                {filteredSubSkills.map(ssk => (
                  <option key={ssk.sub_skill_id} value={ssk.sub_skill_id}>
                    {ssk.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">All fields stay together as one search experience. Search text drives discovery; filters narrow the result.</p>
      </div>

      {/* Discover button */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={generating || aiConfigured === false}
          className="flex items-center gap-2.5 px-8 py-3.5 bg-[#5B50F5] hover:bg-[#4740d4] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors shadow-md shadow-indigo-200 text-[15px]"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Searching &amp; Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Discover Topics
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {generating && (
        <p className="text-xs text-center text-slate-400">Please wait while OCTA AI searches the web and discovers topics...</p>
      )}

      {/* SESSION CANDIDATES SECTION */}
      {session && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Discovered Topics</h2>
              <p className="text-slate-500 text-sm mt-0.5">Review the AI-generated topics before adding them to your Topic Library.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsSourcesModalOpen(true)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium flex items-center gap-2 text-slate-600 hover:bg-slate-50 bg-white shadow-2xs"
                title="View external web research sources"
              >
                <Globe className="w-4 h-4 text-[#5B50F5]" />
                <span>View Web Sources ({session.research_sources?.length || 0})</span>
              </button>
              <button
                onClick={handleKeepAll}
                className="px-4 py-2 bg-[#ECEFFE] text-[#5B50F5] border border-[#d4d0fc] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#e0dcfd] shadow-2xs"
              >
                <Check className="w-4 h-4" />
                Keep All Valid
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {session.candidates.map((c, i) => {
              const status = candidateStatuses[i];
              const err = candidateErrors[i];
              const isEditing = editingIndex === i;
              const isEdited = !!editedIndices[i];

              if (status === "REJECTED") {
                return (
                  <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 opacity-50 flex justify-between items-center">
                    <div className="text-slate-400 line-through truncate max-w-xl text-sm">{c.topic}</div>
                    <div className="text-xs font-semibold text-slate-400">Rejected</div>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className={`bg-white rounded-2xl border p-5 shadow-sm flex flex-col md:flex-row justify-between items-start gap-4 ${
                    status === "KEPT"
                      ? "border-emerald-200 bg-emerald-50/50"
                      : status === "ERROR"
                      ? "border-red-200 bg-red-50/50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex-1 min-w-0 w-full">
                    {/* Candidate header or inline editor */}
                    {isEditing ? (
                      <div className="space-y-3 p-4 bg-indigo-50/40 rounded-xl border border-indigo-200">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#5B50F5] uppercase tracking-wider flex items-center gap-1.5">
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Topic Candidate
                          </span>
                          {editError && <span className="text-xs text-red-600 font-medium">{editError}</span>}
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Topic Title *</label>
                          <input
                            type="text"
                            value={editTopic}
                            onChange={e => setEditTopic(e.target.value)}
                            disabled={savingEdit}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                            placeholder="Topic title..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Short Description *</label>
                          <textarea
                            rows={2}
                            value={editShortDescription}
                            onChange={e => setEditShortDescription(e.target.value)}
                            disabled={savingEdit}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                            placeholder="Brief summary..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Full Description (Optional)</label>
                          <textarea
                            rows={3}
                            value={editFullDescription}
                            onChange={e => setEditFullDescription(e.target.value)}
                            disabled={savingEdit}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                            placeholder="Detailed topic description..."
                          />
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleCancelEdit}
                            disabled={savingEdit}
                            className="px-3 py-1.5 border border-slate-300 text-slate-600 bg-white rounded-lg text-xs font-semibold hover:bg-slate-100 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(i)}
                            disabled={savingEdit}
                            className="px-4 py-1.5 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            <span>Save Changes</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-[15px]">{c.topic}</h4>
                          {isEdited && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                              Edited
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-sm mt-1 line-clamp-2">{c.short_description}</p>
                      </>
                    )}

                    <div className="flex items-center gap-3 mt-3 text-xs flex-wrap">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">Age: {c.age_suitability}</span>
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 font-medium">
                        Potential: {c.activity_potential}
                      </span>
                    </div>

                    {/* Mapping Details: AI-Suggested vs User-Selected */}
                    <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* User-Selected Parameters */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                          <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                          <span>User-Selected Parameters</span>
                        </div>
                        <div className="space-y-1.5 text-slate-600">
                          <div>
                            <span className="text-slate-400 font-medium mr-1.5">User-Selected Intelligence:</span>
                            <span className="font-semibold text-slate-800">
                              {c.user_selected_intelligence || selectedIntelligenceName || "None (Open Discovery)"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium mr-1.5">User-Selected Skills:</span>
                            <span className="font-semibold text-slate-800">
                              {c.user_selected_skills && c.user_selected_skills.length > 0
                                ? c.user_selected_skills.join(", ")
                                : (selectedSkillName || "None")}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium mr-1.5">User-Selected Sub-skills:</span>
                            <span className="font-semibold text-slate-800">
                              {c.user_selected_sub_skills && c.user_selected_sub_skills.length > 0
                                ? c.user_selected_sub_skills.join(", ")
                                : (selectedSubSkillName || "None")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* AI-Suggested Mappings */}
                      <div className="rounded-xl border border-indigo-100 bg-[#FAF9FF] p-3.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-[#5B50F5] font-bold uppercase tracking-wider text-[11px]">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI-Suggested Mappings</span>
                        </div>
                        <div className="space-y-1.5 text-slate-600">
                          <div>
                            <span className="text-slate-400 font-medium mr-1.5">Suggested Intelligence:</span>
                            <span className="font-semibold text-[#5B50F5]">
                              {c.suggested_intelligence || "None"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium mr-1.5">Suggested Skills:</span>
                            {c.suggested_skills && c.suggested_skills.length > 0 ? (
                              <div className="inline-flex flex-wrap gap-1 mt-0.5">
                                {c.suggested_skills.map((s, idx) => (
                                  <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-indigo-200 text-[#5B50F5] font-medium text-[11px]">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None suggested</span>
                            )}
                          </div>
                          <div>
                            <span className="text-slate-400 font-medium mr-1.5">Suggested Sub-skills:</span>
                            {c.suggested_sub_skills && c.suggested_sub_skills.length > 0 ? (
                              <div className="inline-flex flex-wrap gap-1 mt-0.5">
                                {c.suggested_sub_skills.map((ss, idx) => (
                                  <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-violet-200 text-violet-700 font-medium text-[11px]">
                                    {ss}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None suggested</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {err && (
                      <div className="mt-3 p-2 bg-red-100 text-red-700 text-xs rounded-lg border border-red-200 whitespace-pre-wrap font-mono">
                        {err}
                      </div>
                    )}
                  </div>

                  {status === "PENDING" || status === "ERROR" ? (
                    <div className="flex flex-wrap gap-2 shrink-0 mt-0.5">
                      <button
                        onClick={() => handleKeepAndGenerate(i)}
                        disabled={approvingTopicId !== null || isEditing}
                        className="px-3.5 py-2 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                        title="Keep this topic, approve it, and generate activities immediately"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Keep &amp; Generate Activities →</span>
                      </button>
                      <button
                        onClick={() => handleKeep(i)}
                        disabled={approvingTopicId !== null || isEditing}
                        className="px-3 py-2 border border-indigo-200 hover:bg-indigo-50 text-[#5B50F5] bg-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                        title="Save to Topic Library as Draft"
                      >
                        <Check className="w-3.5 h-3.5" /> Keep
                      </button>
                      {!isEditing && (
                        <button
                          onClick={() => handleStartEdit(i)}
                          disabled={approvingTopicId !== null}
                          className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 bg-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                          title="Edit candidate title and description in place"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleReject(i)}
                        disabled={approvingTopicId !== null || isEditing}
                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  ) : status === "KEPT" ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Saved</span>
                        {keptTopicMap[i] && (
                          <span className="font-mono text-[10px] text-emerald-600">({keptTopicMap[i]})</span>
                        )}
                      </div>
                      {keptTopicMap[i] && (
                        <button
                          onClick={() => handleApproveAndGenerate(keptTopicMap[i])}
                          disabled={approvingTopicId === keptTopicMap[i]}
                          className="px-3.5 py-2 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                          title="Approve this topic and proceed immediately to Activity Generation"
                        >
                          {approvingTopicId === keptTopicMap[i] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Approving &amp; Launching...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Approve &amp; Generate Activities →</span>
                            </>
                          )}
                        </button>
                      )}
                      <Link
                        href="/topics/library"
                        className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 bg-white rounded-xl text-xs font-semibold transition-colors shadow-2xs"
                      >
                        View in Topic Library
                      </Link>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {session.candidates.every((_, i) => candidateStatuses[i] === "REJECTED") && (
              <div className="text-center p-10 bg-white rounded-2xl border border-slate-200 text-slate-400">
                All candidates have been rejected. Try adjusting your keywords and generating again.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Web Sources Modal */}
      {isSourcesModalOpen && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5B50F5]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Web Research Sources</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified external web references consulted during AI topic discovery
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSourcesModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-3.5">
              {session.research_sources && session.research_sources.length > 0 ? (
                session.research_sources.map((s, idx) => {
                  let domain = "";
                  try {
                    if (s.url) domain = new URL(s.url).hostname.replace(/^www\./, "");
                  } catch {}
                  return (
                    <div key={idx} className="p-4 rounded-xl border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="font-semibold text-slate-900 text-sm leading-snug">
                          {s.title || "Web Source"}
                        </h4>
                        {domain && (
                          <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {domain}
                          </span>
                        )}
                      </div>
                      {s.snippet && (
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {s.snippet}
                        </p>
                      )}
                      {s.url && (
                        <div className="pt-1">
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B50F5] hover:text-[#4740d4] hover:underline"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate max-w-md">{s.url}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 px-4 space-y-2">
                  <Globe className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-semibold text-slate-700">No Web Sources Available</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    This topic was generated using core pedagogical models without external web search citations.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setIsSourcesModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
