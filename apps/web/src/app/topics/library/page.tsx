/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { API_BASE_URL } from "@/lib/apiBase";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  XCircle,
  AlertCircle,
  RefreshCw,
  CalendarClock,
  ArrowUpDown,
  Sparkles,
  Loader2,
  Compass,
  Tag,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Plus,
} from "lucide-react";
import { formatDateTime } from "@/lib/dateTime";
import {
  fetchMasterData,
  DEFAULT_INTELLIGENCES,
  DEFAULT_SKILLS,
  DEFAULT_SUBSKILLS,
  MasterIntelligence,
  MasterSkill,
  MasterSubSkill,
} from "@/lib/apiCache";

const TOPIC_STORAGE_KEY = "octa_topic_library_filters_v1";
const PAGE_SIZE = 10;

const TOPIC_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Space Exploration":    { bg: "#EEF0FF", text: "#5B50F5", border: "#d4d0fc" },
  "Earth & Environment":  { bg: "#ECFDF5", text: "#059669", border: "#a7f3d0" },
  "Nature & Environment": { bg: "#ECFDF5", text: "#059669", border: "#a7f3d0" },
  "Life Science":         { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  "Technology":           { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  "Science & Technology": { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  "History & Culture":    { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Culture & Community":  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Mathematics":          { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  "Math & Logic":         { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  "Arts & Creativity":    { bg: "#FDF2F8", text: "#BE185D", border: "#FBCFE8" },
  "Health & Wellness":    { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  "Health & Wellbeing":   { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
  "Social Studies":       { bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  "default":              { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0" },
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT:    { label: "Draft", bg: "#FEF3C7", text: "#92400E", border: "#FDE68A" },
  REVIEW:   { label: "In Review", bg: "#EEF0FF", text: "#5B50F5", border: "#D4D0FC" },
  APPROVED: { label: "Approved", bg: "#ECFDF5", text: "#065F46", border: "#A7F3D0" },
  SELECTED: { label: "Selected", bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
  REJECTED: { label: "Rejected", bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
};

function TopicTypeBadge({ label }: { label: string }) {
  const style = TOPIC_TYPE_COLORS[label] || TOPIC_TYPE_COLORS["default"];
  return (
    <span
      className="px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-2xs"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status.toUpperCase()] || {
    label: status,
    bg: "#F1F5F9",
    text: "#475569",
    border: "#E2E8F0",
  };
  return (
    <span
      className="px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider shadow-2xs"
      style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
    >
      {badge.label}
    </span>
  );
}

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

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Master Data
  const [intelligences, setIntelligences] = useState<MasterIntelligence[]>(DEFAULT_INTELLIGENCES);
  const [skills, setSkills] = useState<MasterSkill[]>(DEFAULT_SKILLS);
  const [subSkills, setSubSkills] = useState<MasterSubSkill[]>(DEFAULT_SUBSKILLS);

  // Search & Filter States
  const [rawSearchQuery, setRawSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [intelligenceFilter, setIntelligenceFilter] = useState("ALL");
  const [skillFilter, setSkillFilter] = useState("ALL");
  const [subSkillFilter, setSubSkillFilter] = useState("ALL");
  const [ageFilter, setAgeFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "TITLE_AZ" | "TITLE_ZA">("NEWEST");
  const [currentPage, setCurrentPage] = useState(1);
  const [isHydrated, setIsHydrated] = useState(false);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TOPIC_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.rawSearchQuery === "string") {
          setRawSearchQuery(data.rawSearchQuery);
          setDebouncedSearchQuery(data.rawSearchQuery);
        }
        if (data.typeFilter) setTypeFilter(data.typeFilter);
        if (data.statusFilter) setStatusFilter(data.statusFilter);
        if (data.intelligenceFilter) setIntelligenceFilter(data.intelligenceFilter);
        if (data.skillFilter) setSkillFilter(data.skillFilter);
        if (data.subSkillFilter) setSubSkillFilter(data.subSkillFilter);
        if (data.ageFilter) setAgeFilter(data.ageFilter);
        if (data.datePreset) setDatePreset(data.datePreset);
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
        if (data.sortBy) setSortBy(data.sortBy);
        if (typeof data.currentPage === "number") setCurrentPage(data.currentPage);
      }
    } catch {
      // Fallback to defaults
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist state to sessionStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      const stateToSave = {
        rawSearchQuery,
        typeFilter,
        statusFilter,
        intelligenceFilter,
        skillFilter,
        subSkillFilter,
        ageFilter,
        datePreset,
        startDate,
        endDate,
        sortBy,
        currentPage,
      };
      sessionStorage.setItem(TOPIC_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore storage errors
    }
  }, [
    isHydrated,
    rawSearchQuery,
    typeFilter,
    statusFilter,
    intelligenceFilter,
    skillFilter,
    subSkillFilter,
    ageFilter,
    datePreset,
    startDate,
    endDate,
    sortBy,
    currentPage,
  ]);

  // Load master data
  useEffect(() => {
    fetchMasterData()
      .then((data) => {
        if (data.intelligences?.length) setIntelligences(data.intelligences);
        if (data.skills?.length) setSkills(data.skills);
        if (data.subSkills?.length) setSubSkills(data.subSkills);
      })
      .catch(() => {});
  }, []);

  // Search input debounce (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(rawSearchQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [rawSearchQuery]);

  // Reset pagination on filter change
  const handleFilterChange = (setter: (val: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const handleApproveAndGenerate = async (topicId: string) => {
    setActionLoadingId(topicId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/topics/${topicId}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to approve topic");
      }
      setTopics((prev) =>
        prev.map((item) =>
          item.topic?.topic_id === topicId
            ? { ...item, topic: { ...item.topic, status: "APPROVED" } }
            : item
        )
      );
      router.push(`/activities?topic_id=${topicId}`);
    } catch (err: any) {
      alert(err.message || "Approval failed");
      setActionLoadingId(null);
    }
  };

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/topics`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch topics from backend API`);
      }
      const data = await res.json();
      setTopics(data.topics || []);
    } catch (err: any) {
      console.error("Failed to fetch topics:", err);
      setErrorMessage(err.message || "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  // Extract unique topic family names
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    topics.forEach((t) => {
      const name = t.topic_family_name || t.topic?.topic_type;
      if (name && name !== "Unknown") set.add(name);
    });
    return Array.from(set).sort();
  }, [topics]);

  // Filter skills based on selected intelligence
  const filteredSkillsOptions = useMemo(() => {
    if (intelligenceFilter === "ALL") return skills;
    const matchIntel = intelligences.find(
      (i) => i.name.toLowerCase() === intelligenceFilter.toLowerCase()
    );
    if (!matchIntel) return skills;
    return skills.filter((s) => s.intelligence_id === matchIntel.intelligence_id);
  }, [skills, intelligences, intelligenceFilter]);

  // Filter subskills based on selected skill
  const filteredSubSkillsOptions = useMemo(() => {
    if (skillFilter === "ALL") return subSkills;
    const matchSkill = skills.find(
      (s) => s.name.toLowerCase() === skillFilter.toLowerCase()
    );
    if (!matchSkill) return subSkills;
    return subSkills.filter((ss) => ss.skill_id === matchSkill.skill_id);
  }, [subSkills, skills, skillFilter]);

  // Client-side filtering and sorting
  const filteredTopics = useMemo(() => {
    const filtered = topics.filter((t) => {
      // 1. Status filter
      if (statusFilter !== "ALL" && t.topic?.status?.toUpperCase() !== statusFilter) {
        return false;
      }

      // 2. Topic family / type filter
      if (typeFilter !== "ALL") {
        const family = t.topic_family_name || t.topic?.topic_type || "General";
        if (family !== typeFilter) return false;
      }

      // 3. Intelligence filter
      if (intelligenceFilter !== "ALL") {
        const target = intelligenceFilter.toLowerCase();
        const uIntel = (t.topic?.user_selected_intelligence || "").toLowerCase();
        const sIntel = (t.topic?.suggested_intelligence || "").toLowerCase();
        const mappedIntel = (t.skills || []).some((s: any) => {
          const iName = (s.intelligence_name || "").toLowerCase();
          const iId = (s.intelligence_id || "").toLowerCase();
          return iName.includes(target) || iId.includes(target);
        });
        if (!uIntel.includes(target) && !sIntel.includes(target) && !mappedIntel) {
          return false;
        }
      }

      // 4. Skill filter
      if (skillFilter !== "ALL") {
        const targetSkill = skillFilter.toLowerCase();
        const uSkills = (t.topic?.user_selected_skills || []).map((s: string) => s.toLowerCase());
        const sSkills = (t.topic?.suggested_skills || []).map((s: string) => s.toLowerCase());
        const mappedSkills = (t.skills || []).map((s: any) => (s.skill_name || "").toLowerCase());
        const matchesSkill =
          uSkills.includes(targetSkill) ||
          sSkills.includes(targetSkill) ||
          mappedSkills.includes(targetSkill);
        if (!matchesSkill) return false;
      }

      // 5. Sub-skill filter
      if (subSkillFilter !== "ALL") {
        const targetSub = subSkillFilter.toLowerCase();
        const uSub = (t.topic?.user_selected_sub_skills || []).map((s: string) => s.toLowerCase());
        const sSub = (t.topic?.suggested_sub_skills || []).map((s: string) => s.toLowerCase());
        const mappedSub = (t.skills || []).map((s: any) => (s.sub_skill_name || "").toLowerCase());
        const matchesSub =
          uSub.includes(targetSub) ||
          sSub.includes(targetSub) ||
          mappedSub.includes(targetSub);
        if (!matchesSub) return false;
      }

      // 6. Age filter
      if (ageFilter !== "ALL") {
        const min = t.topic?.age_min ?? 0;
        const max = t.topic?.age_max ?? 99;
        if (ageFilter === "5-7" && (max < 5 || min > 7)) return false;
        if (ageFilter === "8-10" && (max < 8 || min > 10)) return false;
        if (ageFilter === "11-13" && (max < 11 || min > 13)) return false;
        if (ageFilter === "14+" && max < 14) return false;
      }

      // 7. Date filter
      if (datePreset !== "ALL") {
        const recordDate = parseRecordDate(t.topic?.created_at || t.topic?.updated_at);
        if (!recordDate) return false;

        const now = new Date();
        if (datePreset === "TODAY") {
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (recordDate < startOfToday) return false;
        } else if (datePreset === "LAST_7_DAYS") {
          const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (recordDate < cutoff) return false;
        } else if (datePreset === "LAST_30_DAYS") {
          const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (recordDate < cutoff) return false;
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

      // 8. Search query
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase().trim();
        const titleMatch = (t.topic?.topic || "").toLowerCase().includes(q);
        const descMatch =
          (t.topic?.short_description || "").toLowerCase().includes(q) ||
          (t.topic?.full_description || "").toLowerCase().includes(q) ||
          (t.topic?.topic_hook || "").toLowerCase().includes(q);
        const idMatch = (t.topic?.topic_id || "").toLowerCase().includes(q);
        const keywordMatch = (t.keywords || []).some((k: string) => k.toLowerCase().includes(q));
        const familyMatch = (t.topic_family_name || "").toLowerCase().includes(q);
        const intelMatch =
          (t.topic?.user_selected_intelligence || "").toLowerCase().includes(q) ||
          (t.topic?.suggested_intelligence || "").toLowerCase().includes(q);
        const skillMatch = (t.skills || []).some((s: any) =>
          `${s.skill_name || ""} ${s.sub_skill_name || ""} ${s.intelligence_name || ""}`
            .toLowerCase()
            .includes(q)
        );

        if (!titleMatch && !descMatch && !idMatch && !keywordMatch && !familyMatch && !intelMatch && !skillMatch) {
          return false;
        }
      }

      return true;
    });

    // Sort Order
    filtered.sort((a, b) => {
      if (sortBy === "NEWEST") {
        const dtA = parseRecordDate(a.topic?.created_at)?.getTime() || 0;
        const dtB = parseRecordDate(b.topic?.created_at)?.getTime() || 0;
        if (dtB !== dtA) return dtB - dtA;
        return (b.topic?.topic_id || "").localeCompare(a.topic?.topic_id || "");
      }
      if (sortBy === "OLDEST") {
        const dtA = parseRecordDate(a.topic?.created_at)?.getTime() || 0;
        const dtB = parseRecordDate(b.topic?.created_at)?.getTime() || 0;
        if (dtA !== dtB) return dtA - dtB;
        return (a.topic?.topic_id || "").localeCompare(b.topic?.topic_id || "");
      }
      if (sortBy === "TITLE_AZ") {
        const cmp = (a.topic?.topic || "").localeCompare(b.topic?.topic || "");
        if (cmp !== 0) return cmp;
        return (a.topic?.topic_id || "").localeCompare(b.topic?.topic_id || "");
      }
      if (sortBy === "TITLE_ZA") {
        const cmp = (b.topic?.topic || "").localeCompare(a.topic?.topic || "");
        if (cmp !== 0) return cmp;
        return (b.topic?.topic_id || "").localeCompare(a.topic?.topic_id || "");
      }
      return 0;
    });

    return filtered;
  }, [
    topics,
    statusFilter,
    typeFilter,
    intelligenceFilter,
    skillFilter,
    subSkillFilter,
    ageFilter,
    datePreset,
    startDate,
    endDate,
    debouncedSearchQuery,
    sortBy,
  ]);

  // Pagination calculation
  const totalItems = filteredTopics.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginatedTopics = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTopics.slice(start, start + PAGE_SIZE);
  }, [filteredTopics, currentPage]);

  const hasActiveFilters =
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    intelligenceFilter !== "ALL" ||
    skillFilter !== "ALL" ||
    subSkillFilter !== "ALL" ||
    ageFilter !== "ALL" ||
    datePreset !== "ALL" ||
    startDate !== "" ||
    endDate !== "" ||
    rawSearchQuery.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setIntelligenceFilter("ALL");
    setSkillFilter("ALL");
    setSubSkillFilter("ALL");
    setAgeFilter("ALL");
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setRawSearchQuery("");
    setDebouncedSearchQuery("");
    setSortBy("NEWEST");
    setCurrentPage(1);
    try {
      sessionStorage.removeItem(TOPIC_STORAGE_KEY);
    } catch {}
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Discovered Topics</h1>
          <p className="text-slate-500 mt-1.5 text-[15px]">
            Review all topics stored in the database and open any topic to inspect or edit details.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchTopics}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
            title="Reload topics from the database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/topics/generate"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Discover New
          </Link>
        </div>
      </div>

      {/* Main Filter and Search Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        {/* Top search & sort row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rawSearchQuery}
              onChange={(e) => setRawSearchQuery(e.target.value)}
              placeholder="Search topics by title, keywords, intelligence, skills, description..."
              className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:bg-white transition-all"
            />
            {rawSearchQuery && (
              <button
                onClick={() => setRawSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                title="Clear search query"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="relative shrink-0 min-w-[170px]">
            <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => handleFilterChange(setSortBy, e.target.value as any)}
              className="w-full appearance-none pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:bg-white cursor-pointer transition-all"
            >
              <option value="NEWEST">Latest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="TITLE_AZ">Title (A → Z)</option>
              <option value="TITLE_ZA">Title (Z → A)</option>
            </select>
          </div>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="SELECTED">Selected</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Topic Family Filter */}
          <select
            value={typeFilter}
            onChange={(e) => handleFilterChange(setTypeFilter, e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] cursor-pointer truncate"
          >
            <option value="ALL">All Topic Types</option>
            {availableTypes.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>

          {/* Intelligence Filter */}
          <select
            value={intelligenceFilter}
            onChange={(e) => {
              handleFilterChange(setIntelligenceFilter, e.target.value);
              setSkillFilter("ALL");
              setSubSkillFilter("ALL");
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] cursor-pointer"
          >
            <option value="ALL">All Intelligences</option>
            {intelligences.map((intel) => (
              <option key={intel.intelligence_id} value={intel.name}>
                {intel.name}
              </option>
            ))}
          </select>

          {/* Skill Filter (Cascading) */}
          <select
            value={skillFilter}
            onChange={(e) => {
              handleFilterChange(setSkillFilter, e.target.value);
              setSubSkillFilter("ALL");
            }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] cursor-pointer truncate"
          >
            <option value="ALL">All Skills</option>
            {filteredSkillsOptions.map((sk) => (
              <option key={sk.skill_id} value={sk.name}>
                {sk.name}
              </option>
            ))}
          </select>

          {/* Sub-Skill Filter (Cascading) */}
          <select
            value={subSkillFilter}
            onChange={(e) => handleFilterChange(setSubSkillFilter, e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] cursor-pointer truncate"
          >
            <option value="ALL">All Sub-skills</option>
            {filteredSubSkillsOptions.map((ssk) => (
              <option key={ssk.sub_skill_id} value={ssk.name}>
                {ssk.name}
              </option>
            ))}
          </select>

          {/* Date Filter Preset */}
          <select
            value={datePreset}
            onChange={(e) => handleFilterChange(setDatePreset, e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] cursor-pointer"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="CUSTOM">Custom Range...</option>
          </select>
        </div>

        {/* Custom Date Range Row */}
        {datePreset === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 bg-slate-50/80 p-3 rounded-xl border border-dashed border-slate-200 text-xs">
            <span className="font-medium text-slate-500 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-slate-500">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-[#5B50F5] hover:underline font-semibold ml-auto"
              >
                Clear range
              </button>
            )}
          </div>
        )}

        {/* Active Filter Chips Bar */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#5B50F5]" /> Active:
            </span>
            {debouncedSearchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-[#5B50F5] text-xs rounded-full font-medium">
                Search: &ldquo;{debouncedSearchQuery}&rdquo;
                <button onClick={() => setRawSearchQuery("")} className="hover:text-indigo-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-full font-medium">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter("ALL")} className="hover:text-amber-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {typeFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-800 text-xs rounded-full font-medium">
                Family: {typeFilter}
                <button onClick={() => setTypeFilter("ALL")} className="hover:text-sky-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {intelligenceFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-800 text-xs rounded-full font-medium">
                Intelligence: {intelligenceFilter}
                <button onClick={() => setIntelligenceFilter("ALL")} className="hover:text-purple-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {skillFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-50 border border-violet-200 text-violet-800 text-xs rounded-full font-medium">
                Skill: {skillFilter}
                <button onClick={() => setSkillFilter("ALL")} className="hover:text-violet-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {subSkillFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-800 text-xs rounded-full font-medium">
                Sub-skill: {subSkillFilter}
                <button onClick={() => setSubSkillFilter("ALL")} className="hover:text-slate-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {datePreset !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-full font-medium">
                Date: {datePreset === "CUSTOM" ? `${startDate || "Start"} to ${endDate || "End"}` : datePreset}
                <button onClick={() => setDatePreset("ALL")} className="hover:text-emerald-900">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline ml-auto"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* Results Header Counter */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing {totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
          {Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} topics
          {topics.length !== totalItems && ` (filtered from ${topics.length} total)`}
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {/* Error state */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">Error Loading Topics</h3>
            <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={fetchTopics}
            className="px-3 py-1 bg-white border border-red-200 text-xs font-semibold text-red-700 rounded-lg hover:bg-red-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 animate-pulse">
              <div className="flex gap-2">
                <div className="h-5 w-24 bg-slate-200 rounded" />
                <div className="h-5 w-20 bg-slate-200 rounded-full" />
              </div>
              <div className="h-6 w-3/4 bg-slate-200 rounded" />
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-4 w-1/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !errorMessage && filteredTopics.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-[#5B50F5]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No matching topics found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {hasActiveFilters
              ? "None of your stored topics match the current filter criteria. Try adjusting or clearing your filters."
              : "No activity topics have been discovered yet. Generate your first topic to get started!"}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-[#5B50F5] text-xs font-semibold rounded-xl hover:bg-indigo-100 transition-colors"
            >
              Clear All Filters
            </button>
          ) : (
            <Link
              href="/topics/generate"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5B50F5] text-white text-xs font-semibold rounded-xl hover:bg-[#4740d4] transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Discover Topics
            </Link>
          )}
        </div>
      )}

      {/* Topics list */}
      {!loading && !errorMessage && paginatedTopics.length > 0 && (
        <div className="space-y-4">
          {paginatedTopics.map((item) => {
            const topic = item.topic || {};
            const topicId = topic.topic_id;
            const topicFamily = item.topic_family_name || topic.topic_type || "General";
            const status = topic.status || "DRAFT";
            const isEligibleForApproval = status.toUpperCase() === "DRAFT" || status.toUpperCase() === "REVIEW";
            const isApproved = status.toUpperCase() === "APPROVED" || status.toUpperCase() === "SELECTED";
            const isActing = actionLoadingId === topicId;

            // Educational metadata display
            const primaryIntel =
              topic.user_selected_intelligence ||
              topic.suggested_intelligence ||
              item.mappings?.user_selected?.intelligence ||
              item.mappings?.suggested?.intelligence ||
              (item.skills && item.skills[0]?.intelligence_name);

            const displaySkills = [
              ...(topic.user_selected_skills || []),
              ...(topic.suggested_skills || []),
              ...(item.skills ? item.skills.map((s: any) => s.skill_name) : []),
            ].filter((v, i, a) => v && a.indexOf(v) === i).slice(0, 4);

            return (
              <div
                key={topicId}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                {/* Card Top: Badges and Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">{topicId}</span>
                    <StatusBadge status={status} />
                    <TopicTypeBadge label={topicFamily} />
                    {topic.age_min !== undefined && topic.age_max !== undefined && (
                      <span className="text-xs text-slate-500 font-medium">
                        • {topic.age_min}–{topic.age_max} yrs
                      </span>
                    )}
                    {topic.target_class && (
                      <span className="text-xs text-slate-400">({topic.target_class})</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {isEligibleForApproval && (
                      <button
                        onClick={() => handleApproveAndGenerate(topicId)}
                        disabled={actionLoadingId !== null}
                        className="px-3.5 py-1.5 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                        title="Approve topic and immediately generate activities"
                      >
                        {isActing ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Approving...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Approve &amp; Generate Activities →</span>
                          </>
                        )}
                      </button>
                    )}

                    {isApproved && (
                      <Link
                        href={`/activities?topic_id=${topicId}`}
                        className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#5B50F5] border border-indigo-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
                        title="Generate activities for this approved topic"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Activities →</span>
                      </Link>
                    )}

                    <Link
                      href={`/topics/detail/?id=${topicId}`}
                      className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 bg-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs"
                    >
                      View →
                    </Link>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    <Link
                      href={`/topics/detail/?id=${topicId}`}
                      className="hover:text-[#5B50F5] transition-colors"
                    >
                      {topic.topic}
                    </Link>
                  </h3>
                  <p className="text-slate-600 text-sm mt-1 line-clamp-2 leading-relaxed">
                    {topic.short_description || topic.full_description || "No description provided."}
                  </p>
                </div>

                {/* Educational Tags & Metadata Footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {primaryIntel && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-[#5B50F5] font-semibold text-[11px]">
                        <Compass className="w-3 h-3" />
                        {primaryIntel}
                      </span>
                    )}
                    {displaySkills.map((sk) => (
                      <span
                        key={sk}
                        className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>

                  {topic.created_at && (
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Created {formatDateTime(topic.created_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !errorMessage && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40 transition-colors shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              // Show first, last, current, and neighbours
              if (
                pageNum === 1 ||
                pageNum === totalPages ||
                (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl text-xs font-semibold transition-all ${
                      currentPage === pageNum
                        ? "bg-[#5B50F5] text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              }
              if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                return (
                  <span key={pageNum} className="px-1 text-slate-400 text-xs">
                    ...
                  </span>
                );
              }
              return null;
            })}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-40 transition-colors shadow-2xs"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
