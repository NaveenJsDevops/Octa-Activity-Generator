/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { Search, Sparkles, Loader2, AlertCircle, X, Check, Globe, CheckCircle, ArrowRight } from "lucide-react";
import { discoverTopics, keepCandidate, rejectCandidate, keepAllCandidates, TopicDiscoveryRequest, TopicDiscoveryResult } from "@/lib/api/topicDiscovery";
import { API_BASE_URL } from "@/lib/apiBase";

interface TopicFamily {
  topic_family_id: string;
  name: string;
}

const CLASS_OPTIONS = ["Grade 6", "Grade 7", "Grade 8", "Grade 9"];

interface TopicDiscoveryPanelProps {
  onTopicsGenerated: () => void;
  aiConfigured: boolean | null;
}

export default function TopicDiscoveryPanel({ onTopicsGenerated, aiConfigured }: TopicDiscoveryPanelProps) {
  const [searchText, setSearchText] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);

  const [ageMin, setAgeMin] = useState(10);
  const [ageMax, setAgeMax] = useState(12);
  const [targetClass, setTargetClass] = useState<string>("Grade 9");
  const [countryContext, setCountryContext] = useState("India");
  const [requestedCount, setRequestedCount] = useState(1);
  const [topicFamilies, setTopicFamilies] = useState<TopicFamily[]>([]);
  const [topicFamilyId, setTopicFamilyId] = useState("");
  const [topicFamiliesLoading, setTopicFamiliesLoading] = useState(true);
  const [topicFamiliesError, setTopicFamiliesError] = useState("");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const [session, setSession] = useState<TopicDiscoveryResult | null>(null);
  const [candidateStatuses, setCandidateStatuses] = useState<Record<number, "PENDING" | "KEPT" | "REJECTED" | "ERROR">>({});
  const [candidateErrors, setCandidateErrors] = useState<Record<number, string>>({});

  const [showResearch, setShowResearch] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTopicFamilies = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/master`);
        if (!response.ok) {
          throw new Error("Unable to load topic families from the database.");
        }

        const masterData = await response.json();
        const families = Array.isArray(masterData.topicFamilies) ? masterData.topicFamilies : [];
        if (!families.length) {
          throw new Error("No topic families are configured. Add a topic family before generating topics.");
        }

        if (!cancelled) {
          setTopicFamilies(families);
          setTopicFamilyId(families[0].topic_family_id);
        }
      } catch (err) {
        if (!cancelled) {
          setTopicFamiliesError(err instanceof Error ? err.message : "Unable to load topic families.");
        }
      } finally {
        if (!cancelled) {
          setTopicFamiliesLoading(false);
        }
      }
    };

    void loadTopicFamilies();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleAddKeyword = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = keywordInput.trim().replace(/,$/, '');
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
    // Use searchText as a keyword if no keywords were added
    const effectiveKeywords = keywords.length > 0 ? keywords : (searchText.trim() ? [searchText.trim()] : []);

    if (effectiveKeywords.length === 0) {
      setError("Please describe the kind of activity you're looking for.");
      return;
    }

    if (ageMin > ageMax) {
      setError("Maximum age must be greater than or equal to minimum age.");
      return;
    }

    if (!topicFamilyId) {
      setError("Select a topic family before generating topics.");
      return;
    }

    setError("");
    setGenerating(true);
    setSession(null);
    setCandidateStatuses({});
    setCandidateErrors({});
    setShowResearch(false);

    try {
      const request: TopicDiscoveryRequest = {
        keywords: effectiveKeywords,
        age_min: ageMin,
        age_max: ageMax,
        target_class: targetClass || undefined,
        country_context: countryContext || undefined,
        topic_family_id: topicFamilyId,
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

  const handleKeep = async (index: number) => {
    if (!session) return;
    try {
      setCandidateStatuses(prev => ({ ...prev, [index]: "PENDING" }));
      await keepCandidate(session.session_id, index);
      setCandidateStatuses(prev => ({ ...prev, [index]: "KEPT" }));
      setCandidateErrors(prev => ({ ...prev, [index]: "" }));
      onTopicsGenerated();
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
      res.results.forEach((r: any) => {
        const idx = r.index;
        if (r.status === "kept") {
          newStatuses[idx] = "KEPT";
          newErrors[idx] = "";
        } else {
          newStatuses[idx] = "ERROR";
          newErrors[idx] = r.reason;
        }
      });
      setCandidateStatuses(newStatuses);
      setCandidateErrors(newErrors);
      onTopicsGenerated();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Discover Activity Topics</h1>
        <p className="text-slate-500 mt-1.5 text-[15px]">Describe the kind of activity you want and refine it with a few details.</p>
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
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
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
                placeholder={keywords.length === 0 ? "Type and press Enter, e.g. space, teamwork, design" : "Add another..."}
                disabled={generating}
                className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-slate-700 placeholder-slate-400"
              />
            </div>
            {/* Keyword chips */}
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
              disabled={generating || topicFamiliesLoading || !!topicFamiliesError}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] disabled:bg-slate-50 disabled:text-slate-400"
            >
              <option value="">
                {topicFamiliesLoading ? "Loading topic families..." : "Select a topic family"}
              </option>
              {topicFamilies.map(family => (
                <option key={family.topic_family_id} value={family.topic_family_id}>
                  {family.name}
                </option>
              ))}
            </select>
            {topicFamiliesError && <p role="alert" className="mt-1.5 text-xs text-red-600">{topicFamiliesError}</p>}
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

        <p className="text-xs text-slate-400">All fields stay together as one search experience. Search text drives discovery; filters narrow the result.</p>
      </div>

      {/* Discover button — centered below the card */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={generating || aiConfigured === false || topicFamiliesLoading || !!topicFamiliesError || !topicFamilyId}
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
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Discovered Topics</h2>
              <p className="text-slate-500 text-sm mt-0.5">Review the AI-generated topics before adding them to your Topic Library.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResearch(!showResearch)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium flex items-center gap-2 text-slate-600 hover:bg-slate-50 bg-white"
              >
                <Globe className="w-4 h-4" />
                {showResearch ? "Hide Sources" : "View Web Sources"}
              </button>
              <button
                onClick={handleKeepAll}
                className="px-4 py-2 bg-[#ECEFFE] text-[#5B50F5] border border-[#d4d0fc] rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-[#e0dcfd]"
              >
                <Check className="w-4 h-4" />
                Keep All Valid
              </button>
            </div>
          </div>

          {showResearch && session.research_sources && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 text-sm">
              <h4 className="font-semibold text-slate-800 mb-3">Web Research Sources</h4>
              <ul className="space-y-3">
                {session.research_sources.map((s, i) => (
                  <li key={i} className="flex flex-col">
                    <a href={s.url} target="_blank" rel="noreferrer" className="text-[#5B50F5] hover:underline font-medium">{s.title}</a>
                    <span className="text-slate-500 mt-0.5 line-clamp-2 text-xs">{s.snippet}</span>
                  </li>
                ))}
                {session.research_sources.length === 0 && <li className="text-slate-400">No web results were found.</li>}
              </ul>
            </div>
          )}

          <div className="space-y-3">
            {session.candidates.map((c, i) => {
              const status = candidateStatuses[i];
              const err = candidateErrors[i];

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
                  className={`bg-white rounded-2xl border p-5 shadow-sm flex justify-between items-start gap-4 ${
                    status === "KEPT"
                      ? "border-emerald-200 bg-emerald-50"
                      : status === "ERROR"
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 text-[15px]">{c.topic}</h4>
                    <p className="text-slate-500 text-sm mt-1 line-clamp-2">{c.short_description}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">Age: {c.age_suitability}</span>
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 font-medium">
                        Potential: {c.activity_potential}
                      </span>
                    </div>
                    {err && (
                      <div className="mt-3 p-2 bg-red-100 text-red-700 text-xs rounded-lg border border-red-200 whitespace-pre-wrap font-mono">
                        {err}
                      </div>
                    )}
                  </div>

                  {status === "PENDING" || status === "ERROR" ? (
                    <div className="flex gap-2 shrink-0 mt-0.5">
                      <button
                        onClick={() => handleKeep(i)}
                        className="px-4 py-2 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <Check className="w-4 h-4" /> Keep
                      </button>
                      <button
                        onClick={() => handleReject(i)}
                        className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  ) : status === "KEPT" ? (
                    <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold shrink-0 bg-emerald-100 px-4 py-2 rounded-xl">
                      <CheckCircle className="w-4 h-4" /> Saved
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
    </div>
  );
}
