"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  Compass,
  Edit3,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  XCircle,
} from "lucide-react";
import { getApprovedTopics, TopicDetail } from "@/lib/api/activityIdeation";

const INTELLIGENCE_OPTIONS = [
  "Artistic",
  "Arithmetic",
  "Communication",
  "Cognitive",
  "Creative",
  "Emotional",
  "Environmental",
  "Social",
];

function parseRecordDate(value?: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object") {
    if ("_seconds" in value && typeof value._seconds === "number") {
      return new Date(value._seconds * 1000);
    }
    if ("seconds" in value && typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }
  }
  return null;
}

function ActivityGenerationContent() {
  const searchParams = useSearchParams();
  const preselectedTopicId = searchParams.get("topic_id");
  const [topics, setTopics] = useState<TopicDetail[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [ideaCount, setIdeaCount] = useState<number>(5);

  useEffect(() => {
    if (selectedId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`topic-item-${selectedId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedId, topics]);

  // Filter & Search states
  const [query, setQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("ALL");
  const [intelligenceFilter, setIntelligenceFilter] = useState("ALL");
  const [ageFilter, setAgeFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "TITLE_AZ" | "TITLE_ZA">("NEWEST");

  useEffect(() => {
    let cancelled = false;
    getApprovedTopics()
      .then((results) => {
        if (cancelled) return;
        setTopics(results);
        if (preselectedTopicId && results.some((item) => item.topic.topic_id === preselectedTopicId)) {
          setSelectedId(preselectedTopicId);
        } else if (results.length > 0 && !selectedId) {
          // Select latest topic by default
          setSelectedId(results[0].topic.topic_id);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load approved topics");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preselectedTopicId, refreshKey]);

  const families = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => {
      if (t.topic_family_name) set.add(t.topic_family_name);
    });
    return Array.from(set).sort();
  }, [topics]);

  const filteredTopics = useMemo(() => {
    let list = topics.filter((item) => {
      // 1. Topic Family Filter
      if (familyFilter !== "ALL" && item.topic_family_name !== familyFilter) {
        return false;
      }

      // 2. Intelligence Filter
      if (intelligenceFilter !== "ALL") {
        const target = intelligenceFilter.toLowerCase();
        const userIntel = (item.mappings?.user_selected?.intelligence || item.topic?.user_selected_intelligence || "").toLowerCase();
        const suggIntel = (item.mappings?.suggested?.intelligence || item.topic?.suggested_intelligence || "").toLowerCase();
        const skillIntelMatch = (item.skills || []).some((s) => {
          const iName = (s.intelligence_name || "").toLowerCase();
          const iId = (s.intelligence_id || "").toLowerCase();
          return iName.includes(target) || iId.includes(target);
        });

        if (!userIntel.includes(target) && !suggIntel.includes(target) && !skillIntelMatch) {
          return false;
        }
      }

      // 3. Age Suitability Filter
      if (ageFilter !== "ALL") {
        const min = item.topic?.age_min ?? 0;
        const max = item.topic?.age_max ?? 99;
        if (ageFilter === "5-7" && (max < 5 || min > 7)) return false;
        if (ageFilter === "8-10" && (max < 8 || min > 10)) return false;
        if (ageFilter === "11-13" && (max < 11 || min > 13)) return false;
        if (ageFilter === "14+" && max < 14) return false;
      }

      // 4. Date Filter
      if (datePreset !== "ALL") {
        const recordDate = parseRecordDate(item.topic?.created_at || item.topic?.updated_at);
        if (!recordDate) return false;

        const now = new Date();
        if (datePreset === "TODAY") {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (recordDate < startOfToday) return false;
        } else if (datePreset === "LAST_7_DAYS") {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (recordDate < sevenDaysAgo) return false;
        } else if (datePreset === "LAST_30_DAYS") {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (recordDate < thirtyDaysAgo) return false;
        } else if (datePreset === "CUSTOM") {
          if (startDate) {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            if (recordDate < start) return false;
          }
          if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            if (recordDate > end) return false;
          }
        }
      }

      // 5. Text Search Filter
      const search = query.trim().toLowerCase();
      if (search) {
        const searchable = [
          item.topic?.topic,
          item.topic?.short_description,
          item.topic?.full_description,
          item.topic_family_name,
          (item.keywords || []).join(" "),
          item.mappings?.user_selected?.intelligence,
          item.mappings?.suggested?.intelligence,
          (item.skills || []).map((s) => `${s.skill_name} ${s.sub_skill_name}`).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(search)) return false;
      }

      return true;
    });

    // Sort by selected option (Newest first by default)
    list.sort((a, b) => {
      if (sortBy === "TITLE_AZ") {
        return (a.topic?.topic || "").localeCompare(b.topic?.topic || "");
      }
      if (sortBy === "TITLE_ZA") {
        return (b.topic?.topic || "").localeCompare(a.topic?.topic || "");
      }

      const dateA = parseRecordDate(a.topic?.created_at)?.getTime() || 0;
      const dateB = parseRecordDate(b.topic?.created_at)?.getTime() || 0;

      if (sortBy === "OLDEST") {
        return dateA - dateB;
      }
      // Default: NEWEST
      if (dateB !== dateA) return dateB - dateA;
      return (b.topic?.topic_id || "").localeCompare(a.topic?.topic_id || "");
    });

    return list;
  }, [topics, query, familyFilter, intelligenceFilter, ageFilter, datePreset, startDate, endDate, sortBy]);

  const hasActiveFilters =
    familyFilter !== "ALL" ||
    intelligenceFilter !== "ALL" ||
    ageFilter !== "ALL" ||
    datePreset !== "ALL" ||
    startDate !== "" ||
    endDate !== "" ||
    query.trim() !== "" ||
    sortBy !== "NEWEST";

  const clearFilters = () => {
    setFamilyFilter("ALL");
    setIntelligenceFilter("ALL");
    setAgeFilter("ALL");
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setQuery("");
    setSortBy("NEWEST");
  };

  const selectedTopic = topics.find((item) => item.topic.topic_id === selectedId) || filteredTopics[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Activity Generation</h1>
          <p className="mt-2 text-slate-600">Turn an approved topic into classroom-ready activities in three steps.</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setError("");
            setRefreshKey((current) => current + 1);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh topics
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <ol className="grid gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 sm:grid-cols-3 sm:p-5">
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5B50F5] text-sm font-bold text-white">1</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Choose a topic</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Pick an approved topic from the list below.</p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#5B50F5]">2</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Generate activity ideas</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Review the topic details, then select “Generate Activities.”</p>
          </div>
        </li>
        <li className="flex gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-[#5B50F5]">3</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Review and save</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">Edit the generated ideas and approve the ones to save.</p>
          </div>
        </li>
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Step 1: Choose an approved topic</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">
                Showing {filteredTopics.length} of {topics.length} approved topics
              </span>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs font-semibold text-[#5B50F5] hover:text-[#4740d4] hover:underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <label className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search topics by title, keywords, intelligence, skill..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-9 text-sm outline-none focus:bg-white focus:border-[#5B50F5] focus:ring-2 focus:ring-[#5B50F5]/20 transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </label>

            {/* Sort Dropdown */}
            <div className="relative shrink-0 sm:w-44">
              <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-8 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
              >
                <option value="NEWEST">Latest First</option>
                <option value="OLDEST">Oldest First</option>
                <option value="TITLE_AZ">Title (A → Z)</option>
                <option value="TITLE_ZA">Title (Z → A)</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Filter Row: Family, Intelligence, Age, Date */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {/* Topic Family Filter */}
            <div className="relative">
              <select
                value={familyFilter}
                onChange={(e) => setFamilyFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
              >
                <option value="ALL">All Topic Types</option>
                {families.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Intelligence Filter */}
            <div className="relative">
              <select
                value={intelligenceFilter}
                onChange={(e) => setIntelligenceFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
              >
                <option value="ALL">All Intelligences</option>
                {INTELLIGENCE_OPTIONS.map((intel) => (
                  <option key={intel} value={intel}>{intel}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Age Range Filter */}
            <div className="relative">
              <select
                value={ageFilter}
                onChange={(e) => setAgeFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
              >
                <option value="ALL">All Ages</option>
                <option value="5-7">5 - 7 Years</option>
                <option value="8-10">8 - 10 Years</option>
                <option value="11-13">11 - 13 Years</option>
                <option value="14+">14+ Years</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            </div>

            {/* Date Range Preset */}
            <div className="relative">
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pl-3 pr-7 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
              >
                <option value="ALL">All Dates</option>
                <option value="TODAY">Today</option>
                <option value="LAST_7_DAYS">Last 7 Days</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
                <option value="CUSTOM">Custom Date...</option>
              </select>
              <Calendar className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 text-slate-400" />
            </div>
          </div>

          {/* Custom Date Pickers (Shown only when datePreset is CUSTOM) */}
          {datePreset === "CUSTOM" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-200">
              <span className="font-semibold text-slate-700">Date Range:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none focus:border-[#5B50F5]"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs outline-none focus:border-[#5B50F5]"
              />
            </div>
          )}

          {/* Topics List */}
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading approved topics...</p>
          ) : filteredTopics.length === 0 ? (
            <div className="rounded-xl bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              <p>{topics.length ? "No approved topics match your filters." : "There are no approved topics available yet."}</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset filters
                </button>
              )}
              {!topics.length && (
                <p className="mx-auto mt-2 max-w-sm text-xs text-slate-400">
                  Open Topic Library to review and approve topics for activity generation.
                </p>
              )}
            </div>
          ) : (
            <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
              {filteredTopics.map(({ topic, topic_family_name, mappings }) => {
                const isSelected = (selectedTopic?.topic?.topic_id || selectedId) === topic.topic_id;
                const intel = mappings?.user_selected?.intelligence || mappings?.suggested?.intelligence || topic.user_selected_intelligence || topic.suggested_intelligence;

                return (
                  <button
                    key={topic.topic_id}
                    id={`topic-item-${topic.topic_id}`}
                    onClick={() => setSelectedId(topic.topic_id)}
                    className={`w-full rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-[#5B50F5] bg-[#F7F7FF] ring-2 ring-[#5B50F5]/20 shadow-sm"
                        : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-semibold text-slate-900 leading-snug">{topic.topic}</span>
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 border border-emerald-200">
                        {topic.status}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600 leading-relaxed">
                      {topic.short_description || topic.full_description}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                        {topic_family_name}
                      </span>
                      {intel && (
                        <span className="font-medium text-[#5B50F5] bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                          Intelligence: {intel}
                        </span>
                      )}
                      <span>·</span>
                      <span>Ages {topic.age_min}–{topic.age_max}</span>
                      {topic.target_class && (
                        <>
                          <span>·</span>
                          <span>{topic.target_class}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Step 2: Review your topic with carried forward parameters */}
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          {selectedTopic ? (
            <>
              <div className="flex items-center gap-2 text-[#5B50F5]">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Step 2: Review your topic</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">{selectedTopic.topic.topic}</h2>
              <p className="text-xs leading-relaxed text-slate-600">
                {selectedTopic.topic.full_description || selectedTopic.topic.short_description || "No description provided."}
              </p>

              {/* Topic Details Grid */}
              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs">
                <div>
                  <dt className="text-slate-400 font-medium">Age range</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{selectedTopic.topic.age_min}–{selectedTopic.topic.age_max} years</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Class / grade</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{selectedTopic.topic.target_class || "Not specified"}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Family</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{selectedTopic.topic_family_name}</dd>
                </div>
                <div>
                  <dt className="text-slate-400 font-medium">Context / Country</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">{selectedTopic.topic.country_context || "Not specified"}</dd>
                </div>
              </dl>

              {/* Carried-Forward Parameters: Intelligence, Skills & Sub-Skills */}
              {(() => {
                const userSelected = selectedTopic.mappings?.user_selected || {};
                const suggested = selectedTopic.mappings?.suggested || {};
                const uIntel = userSelected.intelligence || selectedTopic.topic.user_selected_intelligence;
                const uSkills = userSelected.skills || selectedTopic.topic.user_selected_skills || [];
                const uSubSkills = userSelected.sub_skills || selectedTopic.topic.user_selected_sub_skills || [];
                const sIntel = suggested.intelligence || selectedTopic.topic.suggested_intelligence;
                const sSkills = suggested.skills || selectedTopic.topic.suggested_skills || [];
                const sSubSkills = suggested.sub_skills || selectedTopic.topic.suggested_sub_skills || [];

                return (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-3">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-indigo-900">
                      <Compass className="h-3.5 w-3.5 text-[#5B50F5]" />
                      <span>Carried-Forward Intelligence &amp; Skills</span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      {/* User-Selected Parameters */}
                      <div className="rounded-lg bg-white p-3 border border-indigo-100/80 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          User-Selected Parameters
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Intelligence: </span>
                          <span className="font-semibold text-slate-900">
                            {uIntel || "None (Open Discovery)"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Skill: </span>
                          {uSkills.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {uSkills.map((sk: string) => (
                                <span key={sk} className="rounded bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                                  {sk}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">None</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Sub skill: </span>
                          {uSubSkills.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {uSubSkills.map((sub: string) => (
                                <span key={sub} className="rounded bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                                  {sub}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">None</span>
                          )}
                        </div>
                      </div>

                      {/* AI-Suggested Mappings */}
                      <div className="rounded-lg bg-white p-3 border border-indigo-100/80 space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#5B50F5]">
                          AI-Suggested Mappings
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Intelligence: </span>
                          <span className="font-semibold text-[#5B50F5]">
                            {sIntel || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Skill: </span>
                          {sSkills.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {sSkills.map((sk: string) => (
                                <span key={sk} className="rounded bg-violet-50 border border-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                                  {sk}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">None suggested</span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 font-medium">Sub skill: </span>
                          {sSubSkills.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {sSubSkills.map((sub: string) => (
                                <span key={sub} className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  {sub}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">None suggested</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Keywords */}
              {(selectedTopic.keywords?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <Tag className="h-3 w-3" /> Keywords
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {selectedTopic.keywords.map((kw: string) => (
                      <span key={kw} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Configurable Idea Count Selector */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200/80 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  <span>Number of activity ideas:</span>
                  <span className="text-[#5B50F5] font-bold">{ideaCount} ideas</span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[1, 3, 5].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setIdeaCount(cnt)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-center ${
                        ideaCount === cnt
                          ? "bg-[#5B50F5] text-white shadow-2xs"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {cnt} {cnt === 1 ? "Idea" : "Ideas"}
                    </button>
                  ))}
                </div>
              </div>

              <Link
                href={`/activity-ideation?topic_id=${encodeURIComponent(selectedTopic.topic.topic_id)}&count=${ideaCount}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B50F5] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#4740d4] active:scale-[0.99]"
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate Activity Ideas ({ideaCount}) →</span>
              </Link>
              <p className="text-center text-[11px] leading-relaxed text-slate-500">
                All topic parameters and intelligence/skill mappings will carry forward directly into activity generation.
              </p>
              <Link
                href={{
                  pathname: "/topics/detail",
                  query: { id: selectedTopic.topic.topic_id },
                }}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" /> Edit topic details
              </Link>
            </>
          ) : (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Choose a topic to begin</p>
              <p className="mt-1 text-xs text-slate-500">Select an approved topic from the list to review it and generate activities.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function ActivityGenerationPage() {
  return (
    <Suspense fallback={<div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading approved topics...</div>}>
      <ActivityGenerationContent />
    </Suspense>
  );
}
