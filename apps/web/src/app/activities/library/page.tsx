/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Search,
  CalendarClock,
  Calendar,
  XCircle,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import { ActivityLibraryItem, getActivities } from "@/lib/api/activityIdeation";
import { ActivityTemplateView } from "@/components/activity-ideation/ActivityTemplateView";
import { formatDateTime } from "@/lib/dateTime";

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
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("ALL");
  const [skillFilter, setSkillFilter] = useState("ALL");
  const [datePreset, setDatePreset] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "TITLE_AZ">("NEWEST");
  const [expandedId, setExpandedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getActivities()
      .then(setActivities)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load activities"))
      .finally(() => setLoading(false));
  }, []);

  const topics = useMemo(
    () => Array.from(new Set(activities.map((item) => item.topic_title))).sort(),
    [activities],
  );

  const availableSkills = useMemo(() => {
    const set = new Set<string>();
    activities.forEach((item) => {
      (item.skills || []).forEach((s) => {
        if (s.skill_name) set.add(s.skill_name);
      });
    });
    return Array.from(set).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();

    const result = activities.filter(({ activity, topic_title, skills }) => {
      // Topic filter
      if (topicFilter !== "ALL" && topic_title !== topicFilter) return false;

      // Skill filter
      if (skillFilter !== "ALL") {
        const matchesSkill = (skills || []).some((s) =>
          (s.skill_name || "").toLowerCase() === skillFilter.toLowerCase()
        );
        if (!matchesSkill) return false;
      }

      // Date filter
      if (datePreset !== "ALL") {
        const recordDate = parseRecordDate(activity.created_at || activity.updated_at);
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
      const haystack = `${activity.title} ${activity.description} ${topic_title} ${activity.learning_objective || ""} ${activity.activity_id} ${JSON.stringify([
        activity.pre_activity,
        activity.main_activity,
        activity.post_activity,
      ])}`.toLowerCase();

      return haystack.includes(search);
    });

    // Sort order (Default: NEWEST first)
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
        return (a.activity.title || "").localeCompare(b.activity.title || "");
      }
      return 0;
    });

    return result;
  }, [activities, query, topicFilter, skillFilter, datePreset, startDate, endDate, sortBy]);

  const hasActiveFilters =
    topicFilter !== "ALL" ||
    skillFilter !== "ALL" ||
    datePreset !== "ALL" ||
    startDate !== "" ||
    endDate !== "" ||
    query.trim() !== "" ||
    sortBy !== "NEWEST";

  const clearFilters = () => {
    setQuery("");
    setTopicFilter("ALL");
    setSkillFilter("ALL");
    setDatePreset("ALL");
    setStartDate("");
    setEndDate("");
    setSortBy("NEWEST");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/activities" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#5B50F5]">
            <ArrowLeft className="h-4 w-4" /> Activity Generation
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Activity Library</h1>
          <p className="mt-2 text-slate-600">Approved activities saved in the database.</p>
        </div>
        <Link href="/activities" className="rounded-xl bg-[#5B50F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4740d4] shadow-sm">
          Generate activities
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        {/* Top search & sort row */}
        <div className="flex flex-col gap-3 sm:flex-row items-stretch sm:items-center">
          <label className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search activities by title, description, topic, learning objective..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-10 text-sm outline-none focus:bg-white focus:border-[#5B50F5] focus:ring-2 focus:ring-[#5B50F5]"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </label>

          {/* Sort By Dropdown (Latest First is default) */}
          <div className="relative shrink-0 min-w-[170px]">
            <ArrowUpDown className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] focus:ring-2 focus:ring-[#5B50F5] cursor-pointer"
            >
              <option value="NEWEST">Latest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="TITLE_AZ">Title (A → Z)</option>
            </select>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
          {/* Topic Filter */}
          <select
            value={topicFilter}
            onChange={(event) => setTopicFilter(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
          >
            <option value="ALL">All topics</option>
            {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
          </select>

          {/* Skill Filter */}
          <select
            value={skillFilter}
            onChange={(event) => setSkillFilter(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
          >
            <option value="ALL">All Skills</option>
            {availableSkills.map((sk) => <option key={sk} value={sk}>{sk}</option>)}
          </select>

          {/* Date Filter Preset */}
          <select
            value={datePreset}
            onChange={(event) => setDatePreset(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:bg-white focus:border-[#5B50F5] cursor-pointer"
          >
            <option value="ALL">All Dates</option>
            <option value="TODAY">Today</option>
            <option value="LAST_7_DAYS">Last 7 Days</option>
            <option value="LAST_30_DAYS">Last 30 Days</option>
            <option value="CUSTOM">Custom Date Range...</option>
          </select>
        </div>

        {/* Custom Date Range Row */}
        {datePreset === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-2 bg-slate-50/80 p-3 rounded-xl border border-dashed border-slate-200">
            <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" /> Date Range:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">From:</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">To:</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-[#5B50F5] hover:underline ml-auto"
              >
                Clear date range
              </button>
            )}
          </div>
        )}
      </div>

      {/* Showing Count & Reset */}
      <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
        <span>
          Showing <strong className="text-slate-800">{filtered.length}</strong> of {activities.length} activities
          {hasActiveFilters && " (Filtered)"}
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 text-[#5B50F5] font-semibold hover:underline"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reset all filters
          </button>
        )}
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading approved activities...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-800">{activities.length ? "No activities match these filters" : "No approved activities yet"}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {hasActiveFilters ? "Try resetting your filter or search criteria." : "Approved activities will appear here after review."}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ activity, topic_title, skills }) => {
            const expanded = expandedId === activity.activity_id;
            const template = activity.pre_activity && activity.main_activity && activity.post_activity
              ? {
                  pre: activity.pre_activity,
                  main: activity.main_activity,
                  post: activity.post_activity,
                  legacy: false,
                }
              : legacyTemplate(activity);
            return (
              <article key={activity.activity_id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                <button
                  onClick={() => setExpandedId(expanded ? "" : activity.activity_id)}
                  aria-expanded={expanded}
                  className="w-full p-5 text-left transition-colors hover:bg-slate-50 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{activity.title}</h2>
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-700">{activity.status}</span>
                      </div>
                      <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">{activity.description}</p>
                      <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
                        <span className="font-semibold text-slate-700">{topic_title}</span><span aria-hidden="true">·</span>
                        <span>Ages {activity.age_min}–{activity.age_max}{activity.target_class ? ` · ${activity.target_class}` : ""}</span><span aria-hidden="true">·</span>
                        <span>{activity.activity_duration || `${activity.estimated_duration} minutes`}</span>
                        {formatDateTime(activity.created_at) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5" />
                              <time dateTime={activity.created_at}>Created {formatDateTime(activity.created_at)}</time>
                            </span>
                          </>
                        )}
                        {skills.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-violet-700 font-medium">
                              <Sparkles className="h-3 w-3" />
                              {skills.map(s => s.skill_name || s.sub_skill_name).filter(Boolean).slice(0, 2).join(" • ")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                      {expanded ? "Hide activity" : "View full activity"}
                      {expanded ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                </button>
                {expanded && (
                  <div className="space-y-5 border-t border-slate-200 bg-slate-50/60 p-4 sm:p-6">
                    <ActivityTemplateView
                      activityName={activity.activity_name || activity.title}
                      activityDuration={activity.activity_duration || `${activity.estimated_duration} minutes`}
                      preActivity={template.pre}
                      mainActivity={template.main}
                      postActivity={template.post}
                      legacy={template.legacy}
                    />
                    <EducationalMetadata
                      learningObjective={activity.learning_objective}
                      materials={activity.materials}
                      assessmentCriteria={activity.assessment_criteria}
                      ageRange={`Ages ${activity.age_min}–${activity.age_max}${activity.target_class ? ` · ${activity.target_class}` : ""}`}
                      difficulty={activity.difficulty_level}
                      skills={skills.map((skill) => `${skill.skill_name || skill.skill_id} · ${skill.sub_skill_name || skill.sub_skill_id}`)}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function legacyTemplate(activity: ActivityLibraryItem["activity"]) {
  const steps = activity.instructions
    .split("\n")
    .map((step) => step.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  return {
    legacy: true,
    pre: {
      activity_description: activity.description,
      parents_note: "Parent assistance information was not recorded for this legacy activity.",
      parents_guide: null,
      pre_activity_engagement: [],
      why_how_is_this_important: activity.learning_objective || "Not recorded in this legacy activity.",
      lets_get_started: "Use the saved activity instructions to begin.",
    },
    main: {
      activity_step_task_title: activity.title,
      scenario_real_life_connection: null,
      in_depth_description_and_process: steps.length ? steps : [activity.description],
      reflection_questions: [],
    },
    post: {
      whats_next: "Not recorded in this legacy activity.",
      extend_the_learning: [],
      how_to_improvise_or_level_up: "Not recorded in this legacy activity.",
      post_activity_summary: activity.expected_output,
    },
  };
}

function EducationalMetadata({
  learningObjective,
  materials,
  assessmentCriteria,
  ageRange,
  difficulty,
  skills,
}: {
  learningObjective?: string;
  materials: string[];
  assessmentCriteria?: string;
  ageRange: string;
  difficulty?: string;
  skills: string[];
}) {
  const values = [
    learningObjective && ["Learning objective", learningObjective],
    materials.length > 0 && ["Materials", materials.join(" · ")],
    assessmentCriteria && ["Assessment criteria", assessmentCriteria],
    ["Target age / class range", ageRange],
    difficulty && ["Difficulty", difficulty],
    skills.length > 0 && ["Skill mappings", skills.join("\n")],
  ].filter((item): item is [string, string] => Array.isArray(item));
  if (!values.length) return null;
  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-indigo-800">Additional educational metadata</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {values.map(([label, value]) => (
          <div key={label}>
            <h4 className="text-xs font-semibold text-slate-600">{label}</h4>
            <p className="mt-1 whitespace-pre-line text-sm leading-5 text-slate-700">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
