/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  CalendarClock,
  XCircle,
  ArrowUpDown,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Compass,
  Tag,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  CheckSquare,
  Square,
  Download,
  Loader2,
  ChevronDown,
  Layers,
  Settings2,
  Pencil,
  Trash2,
  History,
} from "lucide-react";
import { ActivityLibraryItem, getActivities, deleteActivity } from "@/lib/api/activityIdeation";
import { ActivityTemplateView } from "@/components/activity-ideation/ActivityTemplateView";
import VersionHistoryModal from "@/components/modals/VersionHistoryModal";
import ActivityEditModal from "@/components/modals/ActivityEditModal";
import { formatDateTime } from "@/lib/dateTime";
import {
  ExportOptions,
  exportActivityToExcel,
  exportActivityToPdf,
  exportBatchActivitiesToExcel,
  exportBatchActivitiesToPdf,
} from "@/lib/exportUtils";
import {
  fetchMasterData,
  DEFAULT_INTELLIGENCES,
  DEFAULT_SKILLS,
  DEFAULT_SUBSKILLS,
  MasterIntelligence,
  MasterSkill,
  MasterSubSkill,
} from "@/lib/apiCache";

const ACTIVITY_STORAGE_KEY = "octa_activity_library_filters_v1";
const PAGE_SIZE = 10;

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

export default function ActivityLibraryPage() {
  const [activities, setActivities] = useState<ActivityLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [isExportingBatch, setIsExportingBatch] = useState(false);

  // Master data
  const [intelligences, setIntelligences] = useState<MasterIntelligence[]>(DEFAULT_INTELLIGENCES);
  const [skills, setSkills] = useState<MasterSkill[]>(DEFAULT_SKILLS);
  const [subSkills, setSubSkills] = useState<MasterSubSkill[]>(DEFAULT_SUBSKILLS);

  // Filter States
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [intelligenceFilter, setIntelligenceFilter] = useState("ALL");
  const [skillFilter, setSkillFilter] = useState("ALL");
  const [subSkillFilter, setSubSkillFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "TITLE_AZ" | "TITLE_ZA">("NEWEST");
  const [currentPage, setCurrentPage] = useState(1);
  const [isHydrated, setIsHydrated] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Export customization options
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeEducationalMetadata: true,
    includeParentGuidance: true,
    includeCarriedForwardMappings: true,
  });
  const [showExportOptions, setShowExportOptions] = useState(false);

  // Restore state from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ACTIVITY_STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (typeof data.rawQuery === "string") {
          setRawQuery(data.rawQuery);
          setDebouncedQuery(data.rawQuery);
        }
        if (data.topicFilter) setTopicFilter(data.topicFilter);
        if (data.intelligenceFilter) setIntelligenceFilter(data.intelligenceFilter);
        if (data.skillFilter) setSkillFilter(data.skillFilter);
        if (data.subSkillFilter) setSubSkillFilter(data.subSkillFilter);
        if (data.statusFilter) setStatusFilter(data.statusFilter);
        if (data.datePreset) setDatePreset(data.datePreset);
        if (data.startDate) setStartDate(data.startDate);
        if (data.endDate) setEndDate(data.endDate);
        if (data.sortBy) setSortBy(data.sortBy);
        if (typeof data.currentPage === "number") setCurrentPage(data.currentPage);
      }
    } catch {
      // Ignore
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Persist state to sessionStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      const stateToSave = {
        rawQuery,
        topicFilter,
        intelligenceFilter,
        skillFilter,
        subSkillFilter,
        statusFilter,
        datePreset,
        startDate,
        endDate,
        sortBy,
        currentPage,
      };
      sessionStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore
    }
  }, [
    isHydrated,
    rawQuery,
    topicFilter,
    intelligenceFilter,
    skillFilter,
    subSkillFilter,
    statusFilter,
    datePreset,
    startDate,
    endDate,
    sortBy,
    currentPage,
  ]);

  // Edit, Delete and Version History state
  const [editingActivity, setEditingActivity] = useState<any | null>(null);
  const [historyActivity, setHistoryActivity] = useState<{ id: string; title: string } | null>(null);
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    try {
      const data = await getActivities();
      setActivities(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load activities");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteActivity = async (activityId: string, activityTitle: string) => {
    const confirmMsg = `Are you sure you want to delete "${activityTitle}"?\n\nThis will permanently delete the activity, its skill mappings, and its version history from Firestore.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingActivityId(activityId);
    try {
      await deleteActivity(activityId);
      await loadActivities();
    } catch (err: any) {
      alert(err.message || "Failed to delete activity");
    } finally {
      setDeletingActivityId(null);
    }
  };

  // Load activities and master data
  useEffect(() => {
    loadActivities();

    fetchMasterData()
      .then((data) => {
        if (data.intelligences?.length) setIntelligences(data.intelligences);
        if (data.skills?.length) setSkills(data.skills);
        if (data.subSkills?.length) setSubSkills(data.subSkills);
      })
      .catch(() => {});
  }, [loadActivities]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(rawQuery);
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  const handleFilterChange = (setter: (val: any) => void, value: any) => {
    setter(value);
    setCurrentPage(1);
  };

  const topicsList = useMemo(
    () => Array.from(new Set(activities.map((item) => item.topic_title).filter(Boolean))).sort(),
    [activities]
  );

  // Filter skills based on selected intelligence (only show skills for the selected intelligence)
  const filteredSkillsOptions = useMemo(() => {
    if (intelligenceFilter === "ALL") return [];
    const matchIntel = intelligences.find(
      (i) => i.name.toLowerCase() === intelligenceFilter.toLowerCase()
    );
    if (!matchIntel) return [];
    return skills.filter((s) => s.intelligence_id === matchIntel.intelligence_id);
  }, [skills, intelligences, intelligenceFilter]);

  // Filter subskills based on selected skill or selected intelligence
  const filteredSubSkillsOptions = useMemo(() => {
    if (skillFilter !== "ALL") {
      const matchSkill = skills.find(
        (s) => s.name.toLowerCase() === skillFilter.toLowerCase()
      );
      if (!matchSkill) return [];
      return subSkills.filter((ss) => ss.skill_id === matchSkill.skill_id);
    }
    if (intelligenceFilter !== "ALL") {
      const matchIntel = intelligences.find(
        (i) => i.name.toLowerCase() === intelligenceFilter.toLowerCase()
      );
      if (!matchIntel) return [];
      const intelSkillIds = new Set(
        skills.filter((s) => s.intelligence_id === matchIntel.intelligence_id).map((s) => s.skill_id)
      );
      return subSkills.filter((ss) => intelSkillIds.has(ss.skill_id));
    }
    return [];
  }, [subSkills, skills, intelligences, skillFilter, intelligenceFilter]);

  // Client-side filtering and sorting
  const filtered = useMemo(() => {
    const search = debouncedQuery.trim().toLowerCase();

    const result = activities.filter((item) => {
      const act = item.activity;
      const topicTitle = item.topic_title || "";

      // Topic filter
      if (topicFilter !== "ALL" && topicTitle !== topicFilter) return false;

      // Status filter
      if (statusFilter !== "ALL" && (act.status || "").toUpperCase() !== statusFilter) {
        return false;
      }

      // Intelligence filter
      if (intelligenceFilter !== "ALL") {
        const target = intelligenceFilter.toLowerCase();
        const uIntel = (act.user_selected_intelligence || item.mappings?.user_selected?.intelligence || "").toLowerCase();
        const sIntel = (act.suggested_intelligence || item.mappings?.suggested?.intelligence || "").toLowerCase();
        if (!uIntel.includes(target) && !sIntel.includes(target)) {
          return false;
        }
      }

      // Skill filter
      if (skillFilter !== "ALL") {
        const targetSkill = skillFilter.toLowerCase();
        const uSkills = (act.user_selected_skills || []).map((s: string) => s.toLowerCase());
        const sSkills = (act.suggested_skills || []).map((s: string) => s.toLowerCase());
        const itemSkills = (item.skills || []).map((s) => (s.skill_name || "").toLowerCase());
        const matchesSkill =
          uSkills.includes(targetSkill) ||
          sSkills.includes(targetSkill) ||
          itemSkills.includes(targetSkill);
        if (!matchesSkill) return false;
      }

      // Sub-skill filter
      if (subSkillFilter !== "ALL") {
        const targetSub = subSkillFilter.toLowerCase();
        const uSub = (act.user_selected_sub_skills || []).map((s: string) => s.toLowerCase());
        const sSub = (act.suggested_sub_skills || []).map((s: string) => s.toLowerCase());
        const itemSub = (item.skills || []).map((s) => (s.sub_skill_name || "").toLowerCase());
        const matchesSub =
          uSub.includes(targetSub) ||
          sSub.includes(targetSub) ||
          itemSub.includes(targetSub);
        if (!matchesSub) return false;
      }

      // Date filter
      if (datePreset !== "ALL") {
        const recordDate = parseRecordDate(act.created_at || act.updated_at);
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

      // Text search
      if (!search) return true;
      const haystack = `${act.title} ${act.activity_name || ""} ${act.description} ${topicTitle} ${act.learning_objective || ""} ${act.activity_id} ${JSON.stringify([
        act.pre_activity,
        act.main_activity,
        act.post_activity,
        act.user_selected_intelligence,
        act.suggested_intelligence,
        act.user_selected_skills,
        act.suggested_skills,
      ])}`.toLowerCase();

      return haystack.includes(search);
    });

    // Sort Order
    result.sort((a, b) => {
      if (sortBy === "NEWEST") {
        const dtA = parseRecordDate(a.activity.created_at)?.getTime() || 0;
        const dtB = parseRecordDate(b.activity.created_at)?.getTime() || 0;
        if (dtB !== dtA) return dtB - dtA;
        return (b.activity.activity_id || "").localeCompare(a.activity.activity_id || "");
      }
      if (sortBy === "OLDEST") {
        const dtA = parseRecordDate(a.activity.created_at)?.getTime() || 0;
        const dtB = parseRecordDate(b.activity.created_at)?.getTime() || 0;
        if (dtA !== dtB) return dtA - dtB;
        return (a.activity.activity_id || "").localeCompare(b.activity.activity_id || "");
      }
      if (sortBy === "TITLE_AZ") {
        const cmp = (a.activity.title || "").localeCompare(b.activity.title || "");
        if (cmp !== 0) return cmp;
        return (a.activity.activity_id || "").localeCompare(b.activity.activity_id || "");
      }
      if (sortBy === "TITLE_ZA") {
        const cmp = (b.activity.title || "").localeCompare(a.activity.title || "");
        if (cmp !== 0) return cmp;
        return (b.activity.activity_id || "").localeCompare(a.activity.activity_id || "");
      }
      return 0;
    });

    return result;
  }, [
    activities,
    debouncedQuery,
    topicFilter,
    intelligenceFilter,
    skillFilter,
    subSkillFilter,
    statusFilter,
    datePreset,
    startDate,
    endDate,
    sortBy,
  ]);

  // Pagination calculation
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const hasActiveFilters =
    topicFilter !== "ALL" ||
    intelligenceFilter !== "ALL" ||
    skillFilter !== "ALL" ||
    subSkillFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    datePreset !== "ALL" ||
    startDate !== "" ||
    endDate !== "" ||
    rawQuery.trim() !== "";

  const clearFilters = () => {
    setRawQuery("");
    setDebouncedQuery("");
    setTopicFilter("ALL");
    setIntelligenceFilter("ALL");
    setSkillFilter("ALL");
    setSubSkillFilter("ALL");
    setStatusFilter("ALL");
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setSortBy("NEWEST");
    setCurrentPage(1);
    try {
      sessionStorage.removeItem(ACTIVITY_STORAGE_KEY);
    } catch {}
  };

  // Multi-select handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const allFilteredIds = new Set(filtered.map((item) => item.activity.activity_id));
    setSelectedIds(allFilteredIds);
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const selectedActivitiesList = useMemo(() => {
    return activities
      .filter((item) => selectedIds.has(item.activity.activity_id))
      .map((item) => ({
        ...item.activity,
        topic_title: item.topic_title,
        topic_family_name: item.topic_family_name,
        country_context: item.country_context,
        keywords: item.keywords,
        mappings: item.mappings,
        skills: item.skills,
      }));
  }, [activities, selectedIds]);

  const filteredActivitiesList = useMemo(() => {
    return filtered.map((item) => ({
      ...item.activity,
      topic_title: item.topic_title,
      topic_family_name: item.topic_family_name,
      country_context: item.country_context,
      keywords: item.keywords,
      mappings: item.mappings,
      skills: item.skills,
    }));
  }, [filtered]);

  const handleBatchExcel = async () => {
    if (selectedActivitiesList.length === 0) return;
    if (selectedActivitiesList.length > 50) {
      alert("Batch export limit is 50 activities. Please select up to 50 activities.");
      return;
    }
    setIsExportingBatch(true);
    try {
      await exportBatchActivitiesToExcel(selectedActivitiesList, "OctaKids_Batch_Export", exportOptions);
    } catch (err: any) {
      alert(err.message || "Batch Excel export failed");
    } finally {
      setIsExportingBatch(false);
    }
  };

  const handleBatchPdf = () => {
    if (selectedActivitiesList.length === 0) return;
    exportBatchActivitiesToPdf(selectedActivitiesList, exportOptions);
  };

  const handleExportAllFilteredExcel = async () => {
    if (filteredActivitiesList.length === 0) return;
    if (filteredActivitiesList.length > 50) {
      alert(`Filtered set contains ${filteredActivitiesList.length} activities, which exceeds the batch export limit of 50. Please narrow your search or filters.`);
      return;
    }
    setIsExportingBatch(true);
    try {
      await exportBatchActivitiesToExcel(filteredActivitiesList, "OctaKids_Filtered_Batch", exportOptions);
    } catch (err: any) {
      alert(err.message || "Export failed");
    } finally {
      setIsExportingBatch(false);
    }
  };

  const handleExportAllFilteredPdf = () => {
    if (filteredActivitiesList.length === 0) return;
    exportBatchActivitiesToPdf(filteredActivitiesList, exportOptions);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/activities"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#5B50F5] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Activity Ideation &amp; Generation
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Activity Library</h1>
          <p className="mt-1 text-slate-500 text-[15px]">
            Explore, inspect, and batch-export approved activities stored in the database.
          </p>
        </div>
        <Link
          href="/activities"
          className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl bg-[#5B50F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4740d4] shadow-sm transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Generate Activities
        </Link>
      </div>

      {/* Main Search & Filter Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        {/* Top search & sort row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              placeholder="Search activities by title, description, associated topic, learning objective, id..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-800 outline-none focus:bg-white focus:border-[#5B50F5] focus:ring-2 focus:ring-[#5B50F5] transition-all"
            />
            {rawQuery && (
              <button
                onClick={() => setRawQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
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
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] focus:ring-2 focus:ring-[#5B50F5] cursor-pointer transition-all"
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
          {/* Topic Filter */}
          <select
            value={topicFilter}
            onChange={(e) => handleFilterChange(setTopicFilter, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer truncate"
          >
            <option value="ALL">All Topics</option>
            {topicsList.map((t) => (
              <option key={t} value={t}>
                {t}
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
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer truncate"
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
            disabled={intelligenceFilter === "ALL"}
            onChange={(e) => {
              handleFilterChange(setSkillFilter, e.target.value);
              setSubSkillFilter("ALL");
            }}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer truncate disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <option value="ALL">
              {intelligenceFilter === "ALL" ? "Select Intelligence First" : `All Skills in ${intelligenceFilter}`}
            </option>
            {filteredSkillsOptions.map((sk) => (
              <option key={sk.skill_id} value={sk.name}>
                {sk.name}
              </option>
            ))}
          </select>

          {/* Sub-Skill Filter (Cascading) */}
          <select
            value={subSkillFilter}
            disabled={intelligenceFilter === "ALL" || filteredSubSkillsOptions.length === 0}
            onChange={(e) => handleFilterChange(setSubSkillFilter, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer truncate disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <option value="ALL">
              {intelligenceFilter === "ALL"
                ? "Select Intelligence First"
                : skillFilter !== "ALL"
                ? `All Sub-skills in ${skillFilter}`
                : `All Sub-skills in ${intelligenceFilter}`}
            </option>
            {filteredSubSkillsOptions.map((ssk) => (
              <option key={ssk.sub_skill_id} value={ssk.name}>
                {ssk.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleFilterChange(setStatusFilter, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="APPROVED">Approved</option>
          </select>

          {/* Date Filter Preset */}
          <select
            value={datePreset}
            onChange={(e) => handleFilterChange(setDatePreset, e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
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

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-[#5B50F5]" /> Active:
            </span>
            {debouncedQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-[#5B50F5] text-xs rounded-full font-medium">
                Search: &ldquo;{debouncedQuery}&rdquo;
                <button onClick={() => setRawQuery("")} className="hover:text-indigo-800">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {topicFilter !== "ALL" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-800 text-xs rounded-full font-medium">
                Topic: {topicFilter}
                <button onClick={() => setTopicFilter("ALL")} className="hover:text-sky-900">
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

      {/* Multi-Select & Batch Export Action Bar */}
      <div className="flex flex-col gap-3 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={
                selectedIds.size === filtered.length && filtered.length > 0
                  ? deselectAll
                  : selectAllFiltered
              }
              disabled={filtered.length === 0}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 disabled:opacity-50"
            >
              {selectedIds.size > 0 && selectedIds.size === filtered.length ? (
                <CheckSquare className="w-4 h-4 text-[#5B50F5]" />
              ) : (
                <Square className="w-4 h-4 text-slate-400" />
              )}
              <span>
                {selectedIds.size > 0 && selectedIds.size === filtered.length
                  ? "Deselect All"
                  : `Select All Filtered (${filtered.length})`}
              </span>
            </button>

            {selectedIds.size > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ECEFFE] text-[#5B50F5] border border-indigo-200">
                {selectedIds.size} selected
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Export Options Popover Trigger */}
            <button
              type="button"
              onClick={() => setShowExportOptions(!showExportOptions)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-2xs transition-colors ${
                showExportOptions
                  ? "bg-indigo-50 border-indigo-300 text-[#5B50F5]"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
              title="Customize export contents"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Export Options</span>
            </button>

            {selectedIds.size > 0 ? (
              <>
                <button
                  onClick={handleBatchExcel}
                  disabled={isExportingBatch}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
                  title="Export selected activities as a multi-sheet Excel file"
                >
                  {isExportingBatch ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export Selected ({selectedIds.size}) to Excel</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleBatchPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                  title="Print or Save selected activities to combined PDF"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Export Selected ({selectedIds.size}) to PDF</span>
                </button>
              </>
            ) : filtered.length > 0 ? (
              <>
                <button
                  onClick={handleExportAllFilteredExcel}
                  disabled={isExportingBatch || filtered.length > 50}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs font-semibold shadow-2xs transition-colors disabled:opacity-40"
                  title={
                    filtered.length > 50
                      ? "Filtered count exceeds 50 activities limit"
                      : "Export all currently filtered activities to Excel"
                  }
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export All Filtered ({filtered.length}) Excel</span>
                </button>
                <button
                  onClick={handleExportAllFilteredPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-indigo-200 text-[#5B50F5] hover:bg-indigo-50 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
                  title="Print or Save all currently filtered activities to PDF"
                >
                  <FileText className="w-3.5 h-3.5 text-[#5B50F5]" />
                  <span>Export All Filtered PDF</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Customization Options Bar */}
        {showExportOptions && (
          <div className="pt-2.5 border-t border-slate-200 flex flex-wrap items-center gap-4 text-xs text-slate-700 bg-white/70 p-2.5 rounded-xl">
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Include:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.includeParentGuidance !== false}
                onChange={(e) =>
                  setExportOptions((prev) => ({ ...prev, includeParentGuidance: e.target.checked }))
                }
                className="rounded border-slate-300 text-[#5B50F5] focus:ring-[#5B50F5]"
              />
              <span className="font-medium">Parent's Guidance &amp; Note</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.includeEducationalMetadata !== false}
                onChange={(e) =>
                  setExportOptions((prev) => ({ ...prev, includeEducationalMetadata: e.target.checked }))
                }
                className="rounded border-slate-300 text-[#5B50F5] focus:ring-[#5B50F5]"
              />
              <span className="font-medium">Educational Taxonomy &amp; Objectives</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={exportOptions.includeCarriedForwardMappings !== false}
                onChange={(e) =>
                  setExportOptions((prev) => ({ ...prev, includeCarriedForwardMappings: e.target.checked }))
                }
                className="rounded border-slate-300 text-[#5B50F5] focus:ring-[#5B50F5]"
              />
              <span className="font-medium">Carried-Forward Mappings</span>
            </label>
          </div>
        )}
      </div>

      {/* Results Header Counter */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Showing {totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}–
          {Math.min(currentPage * PAGE_SIZE, totalItems)} of {totalItems} activities
          {activities.length !== totalItems && ` (filtered from ${activities.length} total)`}
        </span>
        {totalPages > 1 && (
          <span>
            Page {currentPage} of {totalPages}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3 animate-pulse">
              <div className="h-5 w-40 bg-slate-200 rounded" />
              <div className="h-6 w-3/4 bg-slate-200 rounded" />
              <div className="h-4 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-[#5B50F5]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No matching activities found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {hasActiveFilters
              ? "None of your stored activities match the current filters. Adjust or clear filters to see more."
              : "No activities have been approved yet. Approve concepts in Activity Ideation to add them to your library."}
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
              href="/activities"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#5B50F5] text-white text-xs font-semibold rounded-xl hover:bg-[#4740d4] transition-colors shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Activities
            </Link>
          )}
        </div>
      )}

      {/* Activities List */}
      {!loading && !error && paginatedActivities.length > 0 && (
        <div className="space-y-4">
          {paginatedActivities.map((item) => {
            const act = item.activity;
            const isExpanded = expandedId === act.activity_id;
            const isSelected = selectedIds.has(act.activity_id);

            const exportPayload = {
              ...act,
              topic_title: item.topic_title,
              topic_family_name: item.topic_family_name,
              country_context: item.country_context,
              keywords: item.keywords,
              mappings: item.mappings,
              skills: item.skills,
            };

            const primaryIntel =
              act.user_selected_intelligence ||
              act.suggested_intelligence ||
              item.mappings?.user_selected?.intelligence ||
              item.mappings?.suggested?.intelligence;

            const displaySkills = [
              ...(act.user_selected_skills || []),
              ...(act.suggested_skills || []),
              ...(item.skills ? item.skills.map((s) => s.skill_name) : []),
            ]
              .filter((v, i, a) => v && a.indexOf(v) === i)
              .slice(0, 4);

            return (
              <article
                key={act.activity_id}
                className={`rounded-2xl border bg-white p-6 shadow-sm transition-all space-y-4 ${
                  isSelected
                    ? "border-indigo-400 ring-2 ring-indigo-200"
                    : "border-slate-200 hover:shadow-md"
                }`}
              >
                {/* Header row with checkbox, ID, badges, and export actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Checkbox for batch select */}
                    <button
                      type="button"
                      onClick={() => toggleSelect(act.activity_id)}
                      className="text-slate-400 hover:text-[#5B50F5] transition-colors p-0.5"
                      title={isSelected ? "Deselect activity" : "Select activity for batch export"}
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-[#5B50F5]" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>

                    <span className="font-mono text-xs font-bold text-slate-400">
                      {act.activity_id}
                    </span>
                    <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 uppercase">
                      {act.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs text-slate-600 font-medium">
                      {act.activity_duration || `${act.estimated_duration} mins`}
                    </span>
                    {act.age_min !== undefined && act.age_max !== undefined && (
                      <span className="text-xs text-slate-500 font-medium">
                        • Ages {act.age_min}–{act.age_max}
                      </span>
                    )}
                    {act.target_class && (
                      <span className="text-xs text-slate-400">({act.target_class})</span>
                    )}
                  </div>

                  {/* Single export actions & view toggle */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => exportActivityToExcel(exportPayload, "OctaKids_Activity", exportOptions)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs"
                      title="Download as Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Excel</span>
                    </button>
                    <button
                      onClick={() => exportActivityToPdf(exportPayload, exportOptions)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors shadow-2xs"
                      title="Print or Save as PDF"
                    >
                      <FileText className="h-3.5 w-3.5 text-[#5B50F5]" />
                      <span>PDF</span>
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? "" : act.activity_id)}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
                    >
                      {isExpanded ? "Collapse View" : "Full View"}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    <button
                      onClick={() => setEditingActivity(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                      title="Edit all activity parameters & sections"
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-500" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setHistoryActivity({ id: act.activity_id, title: act.activity_name || act.title })}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors shadow-2xs"
                      title="View version history & restore previous snapshots"
                    >
                      <History className="h-3.5 w-3.5 text-purple-600" />
                      <span>History</span>
                    </button>

                    <button
                      onClick={() => handleDeleteActivity(act.activity_id, act.activity_name || act.title)}
                      disabled={deletingActivityId === act.activity_id}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs disabled:opacity-50"
                      title="Delete activity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Title & Associated Topic */}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 leading-snug">
                    {act.activity_name || act.title}
                  </h3>
                  {item.topic_title && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <span>Associated Topic:</span>
                      <span className="font-semibold text-slate-700">{item.topic_title}</span>
                    </div>
                  )}
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 line-clamp-2">
                    {act.description || act.pre_activity?.activity_description}
                  </p>
                </div>

                {/* Expandable Full View */}
                {isExpanded && (
                  <div className="border-t border-slate-100 pt-5 space-y-5 animate-in fade-in duration-200">
                    <ActivityTemplateView
                      activityName={act.activity_name || act.title}
                      activityDuration={act.activity_duration || `${act.estimated_duration} minutes`}
                      preActivity={
                        act.pre_activity || {
                          activity_description: act.description,
                          parents_note: "Parent note was not recorded.",
                          parents_guide: null,
                          pre_activity_engagement: [],
                          why_how_is_this_important: act.learning_objective || "Not recorded.",
                          lets_get_started: act.title,
                        }
                      }
                      mainActivity={
                        act.main_activity || {
                          activity_step_task_title: act.title,
                          scenario_real_life_connection: null,
                          in_depth_description_and_process: (act.instructions || "").split("\n").filter(Boolean),
                          reflection_questions: [],
                        }
                      }
                      postActivity={
                        act.post_activity || {
                          whats_next: "Not recorded.",
                          extend_the_learning: [],
                          how_to_improvise_or_level_up: "Not recorded.",
                          post_activity_summary: act.expected_output,
                        }
                      }
                      canRegenerateSection={false}
                    />
                  </div>
                )}

                {/* Footer metadata tags */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {primaryIntel && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-[#5B50F5]">
                        <Compass className="w-3 h-3" />
                        {primaryIntel}
                      </span>
                    )}
                    {displaySkills.map((sk) => (
                      <span
                        key={sk}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>

                  {act.created_at && (
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>Approved {formatDateTime(act.created_at)}</span>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && totalPages > 1 && (
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

      {/* Activity Edit Modal */}
      <ActivityEditModal
        isOpen={Boolean(editingActivity)}
        onClose={() => setEditingActivity(null)}
        activityData={editingActivity}
        onSaveSuccess={() => {
          setEditingActivity(null);
          loadActivities();
        }}
      />

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={Boolean(historyActivity)}
        onClose={() => setHistoryActivity(null)}
        title={historyActivity?.title || "Activity"}
        entityType="activity"
        entityId={historyActivity?.id || ""}
        onRestoreSuccess={() => {
          loadActivities();
        }}
      />
    </div>
  );
}
