"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Search, CalendarClock } from "lucide-react";
import { ActivityLibraryItem, getActivities } from "@/lib/api/activityIdeation";
import { ActivityTemplateView } from "@/components/activity-ideation/ActivityTemplateView";
import { formatDateTime } from "@/lib/dateTime";

export default function ActivityLibraryPage() {
  const [activities, setActivities] = useState<ActivityLibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("ALL");
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
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return activities.filter(({ activity, topic_title }) => {
      if (topicFilter !== "ALL" && topic_title !== topicFilter) return false;
      if (!search) return true;
      return `${activity.title} ${activity.description} ${topic_title} ${activity.learning_objective || ""} ${JSON.stringify([
        activity.pre_activity,
        activity.main_activity,
        activity.post_activity,
      ])}`
        .toLowerCase()
        .includes(search);
    });
  }, [activities, query, topicFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/activities" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#5B50F5]">
            <ArrowLeft className="h-4 w-4" /> Activity Generation
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Activity Library</h1>
          <p className="mt-2 text-slate-600">Approved activities saved in the local database.</p>
        </div>
        <Link href="/activities" className="rounded-xl bg-[#5B50F5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4740d4]">
          Generate activities
        </Link>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activity or topic..."
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#5B50F5]"
          />
        </label>
        <select
          value={topicFilter}
          onChange={(event) => setTopicFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#5B50F5]"
        >
          <option value="ALL">All topics</option>
          {topics.map((topic) => <option key={topic} value={topic}>{topic}</option>)}
        </select>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {loading ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">Loading approved activities...</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-800">{activities.length ? "No activities match these filters" : "No approved activities yet"}</h2>
          <p className="mt-2 text-sm text-slate-500">Approved activities will appear here after review.</p>
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
                        <span>{topic_title}</span><span aria-hidden="true">·</span>
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
