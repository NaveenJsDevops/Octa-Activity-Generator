"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ActivityConcept, MainActivity, PostActivity, PreActivity } from "@/lib/api/activityIdeation";
import { ActivityTemplateView } from "@/components/activity-ideation/ActivityTemplateView";
import { CalendarClock, Check, Pencil, RefreshCw, X } from "lucide-react";
import { formatDateTime } from "@/lib/dateTime";

interface Props {
  concept: ActivityConcept;
  disabled?: boolean;
  onEdit: (updates: Partial<ActivityConcept>) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

interface ActivityDraft {
  activity_name: string;
  activity_duration: string;
  pre_activity: PreActivity;
  main_activity: MainActivity;
  post_activity: PostActivity;
}

const fieldClass = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#5B50F5]";

export function ActivityConceptCard({
  concept,
  disabled = false,
  onEdit,
  onRegenerate,
  onApprove,
  onReject,
}: Props) {
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const editable = concept.status === "TEMPORARY";
  const preActivity = concept.pre_activity || legacyPreActivity(concept);
  const mainActivity = concept.main_activity || legacyMainActivity(concept);
  const postActivity = concept.post_activity || legacyPostActivity(concept);

  const updatePre = <K extends keyof PreActivity,>(key: K, value: PreActivity[K]) => {
    setDraft((current) => current ? {
      ...current,
      pre_activity: { ...current.pre_activity, [key]: value },
    } : current);
  };
  const updateMain = <K extends keyof MainActivity,>(key: K, value: MainActivity[K]) => {
    setDraft((current) => current ? {
      ...current,
      main_activity: { ...current.main_activity, [key]: value },
    } : current);
  };
  const updatePost = <K extends keyof PostActivity,>(key: K, value: PostActivity[K]) => {
    setDraft((current) => current ? {
      ...current,
      post_activity: { ...current.post_activity, [key]: value },
    } : current);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await onEdit({
        activity_name: draft.activity_name,
        activity_title: draft.activity_name,
        activity_duration: draft.activity_duration,
        estimated_duration: parseDuration(draft.activity_duration, concept.estimated_duration || 30),
        pre_activity: draft.pre_activity,
        main_activity: draft.main_activity,
        post_activity: draft.post_activity,
      });
      setDraft(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className={`overflow-hidden rounded-2xl border bg-slate-50 shadow-sm ${
      concept.status === "APPROVED" ? "border-emerald-200" : concept.status === "REJECTED" ? "border-red-200 opacity-80" : "border-slate-200"
    }`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{concept.activity_type_id}</span>
        <div className="flex items-center gap-2">
          {formatDateTime(concept.created_at) && (
            <time dateTime={concept.created_at} className="inline-flex items-center gap-1 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Generated {formatDateTime(concept.created_at)}
            </time>
          )}
          <span className="text-[10px] font-medium text-slate-500">
            {concept.status === "TEMPORARY" ? "Unsaved review result" : concept.status === "APPROVED" ? "Saved to Activity Library" : "Not saved"}
          </span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
            concept.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
              concept.status === "REJECTED" ? "bg-red-100 text-red-800" :
                "bg-amber-100 text-amber-800"
          }`}>{concept.status}</span>
        </div>
      </header>

      <div className="space-y-4 p-4 sm:p-6">
        {draft ? (
          <div className="space-y-5 rounded-xl border border-indigo-100 bg-white p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextEditor label="Activity Name" value={draft.activity_name} onChange={(value) => setDraft({ ...draft, activity_name: value })} />
              <TextEditor label="Activity Duration" value={draft.activity_duration} onChange={(value) => setDraft({ ...draft, activity_duration: value })} />
            </div>

            <EditSection title="Pre-Activity">
              <TextEditor label="Activity Description" value={draft.pre_activity.activity_description} onChange={(value) => updatePre("activity_description", value)} multiline />
              <TextEditor label="Parent's Note" value={draft.pre_activity.parents_note} onChange={(value) => updatePre("parents_note", value)} multiline />
              <TextEditor label="Parent's Guide (leave blank when not required)" value={draft.pre_activity.parents_guide || ""} onChange={(value) => updatePre("parents_guide", value || null)} multiline />
              <ListEditor label="Pre-Activity Engagement (up to 3 prompts)" values={draft.pre_activity.pre_activity_engagement} onChange={(value) => updatePre("pre_activity_engagement", value)} />
              <TextEditor label="Why/How Is This Important?" value={draft.pre_activity.why_how_is_this_important} onChange={(value) => updatePre("why_how_is_this_important", value)} multiline />
              <TextEditor label="Let's Get Started!" value={draft.pre_activity.lets_get_started} onChange={(value) => updatePre("lets_get_started", value)} multiline />
            </EditSection>

            <EditSection title="Main Activity">
              <TextEditor label="Activity Step / Task Title" value={draft.main_activity.activity_step_task_title} onChange={(value) => updateMain("activity_step_task_title", value)} />
              <TextEditor label="Scenario / Real-Life Connection (If Applicable)" value={draft.main_activity.scenario_real_life_connection || ""} onChange={(value) => updateMain("scenario_real_life_connection", value || null)} multiline />
              <ListEditor label="Activity In-depth Description and Process (one step per line)" values={draft.main_activity.in_depth_description_and_process} onChange={(value) => updateMain("in_depth_description_and_process", value)} rows={7} />
              <ListEditor label="Reflection Questions (one question per line)" values={draft.main_activity.reflection_questions} onChange={(value) => updateMain("reflection_questions", value)} />
            </EditSection>

            <EditSection title="Post-Activity">
              <TextEditor label="What's Next" value={draft.post_activity.whats_next} onChange={(value) => updatePost("whats_next", value)} multiline />
              <ListEditor label="Extend the Learning (one task per line)" values={draft.post_activity.extend_the_learning} onChange={(value) => updatePost("extend_the_learning", value)} />
              <TextEditor label="How to Improvise or Level Up" value={draft.post_activity.how_to_improvise_or_level_up} onChange={(value) => updatePost("how_to_improvise_or_level_up", value)} multiline />
              <TextEditor label="Post-Activity Summary" value={draft.post_activity.post_activity_summary} onChange={(value) => updatePost("post_activity_summary", value)} multiline />
            </EditSection>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void save()} disabled={saving || disabled} className="inline-flex items-center gap-1 rounded-lg bg-[#5B50F5] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                <Check className="h-3.5 w-3.5" /> Save changes
              </button>
              <button onClick={() => setDraft(null)} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <ActivityTemplateView
              activityName={concept.activity_name || concept.activity_title}
              activityDuration={concept.activity_duration || `${concept.estimated_duration || "Not specified"} minutes`}
              preActivity={preActivity}
              mainActivity={mainActivity}
              postActivity={postActivity}
            />
            <EducationalMetadata concept={concept} />
          </>
        )}
      </div>

      {!draft && editable && (
        <footer className="flex flex-wrap gap-2 border-t border-slate-100 bg-white p-4">
          <button
            onClick={() => setDraft({
              activity_name: concept.activity_name || concept.activity_title,
              activity_duration: concept.activity_duration || `${concept.estimated_duration || 30} minutes`,
              pre_activity: { ...preActivity, pre_activity_engagement: [...preActivity.pre_activity_engagement] },
              main_activity: {
                ...mainActivity,
                in_depth_description_and_process: [...mainActivity.in_depth_description_and_process],
                reflection_questions: [...mainActivity.reflection_questions],
              },
              post_activity: { ...postActivity, extend_the_learning: [...postActivity.extend_the_learning] },
            })}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button onClick={() => void onRegenerate()} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </button>
          <button onClick={() => void onApprove()} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button onClick={() => void onReject()} disabled={disabled} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-50">
            <X className="h-3.5 w-3.5" /> Reject
          </button>
        </footer>
      )}
    </article>
  );
}

function legacyPreActivity(concept: ActivityConcept): PreActivity {
  return {
    activity_description: concept.activity_concept,
    parents_note: "Parent assistance information was not recorded for this legacy activity.",
    parents_guide: null,
    pre_activity_engagement: [],
    why_how_is_this_important: concept.learning_objective || concept.why_engaging || "Not recorded.",
    lets_get_started: concept.learner_task,
  };
}

function legacyMainActivity(concept: ActivityConcept): MainActivity {
  return {
    activity_step_task_title: concept.learner_task,
    scenario_real_life_connection: null,
    in_depth_description_and_process: concept.instructions.length >= 3
      ? concept.instructions
      : [concept.activity_concept, ...concept.instructions].filter(Boolean).slice(0, 3),
    reflection_questions: [],
  };
}

function legacyPostActivity(concept: ActivityConcept): PostActivity {
  return {
    whats_next: "Not recorded in this legacy activity.",
    extend_the_learning: [],
    how_to_improvise_or_level_up: "Not recorded in this legacy activity.",
    post_activity_summary: concept.expected_output,
  };
}

function EducationalMetadata({ concept }: { concept: ActivityConcept }) {
  const details = [
    concept.age_min !== undefined && concept.age_max !== undefined && [
      "Target age / class range",
      `Ages ${concept.age_min}–${concept.age_max}${concept.target_class ? ` · ${concept.target_class}` : ""}`,
    ],
    concept.learning_objective && ["Learning objective", concept.learning_objective],
    concept.materials.length > 0 && ["Materials", concept.materials.join(" · ")],
    concept.assessment_criteria && ["Assessment criteria", concept.assessment_criteria],
    concept.difficulty_level && ["Difficulty", concept.difficulty_level],
    (concept.primary_skill_id || concept.primary_sub_skill_id) && [
      "Supported skill mapping",
      [concept.primary_skill_id, concept.primary_sub_skill_id].filter(Boolean).join(" · "),
    ],
  ].filter((item): item is [string, string] => Array.isArray(item));
  if (details.length === 0) return null;
  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wide text-indigo-800">Additional educational metadata</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label}>
            <h5 className="text-xs font-semibold text-slate-600">{label}</h5>
            <p className="mt-1 whitespace-pre-line text-sm leading-5 text-slate-700">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function EditSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 border-t border-slate-100 pt-4"><h3 className="text-sm font-bold text-[#5B50F5]">{title}</h3>{children}</section>;
}

function TextEditor({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      {multiline ? (
        <textarea rows={3} className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={fieldClass} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

function ListEditor({
  label,
  values,
  onChange,
  rows = 3,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  rows?: number;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-600">
      {label}
      <textarea
        rows={rows}
        className={fieldClass}
        value={values.join("\n")}
        onChange={(event) => onChange(event.target.value.split("\n").map((value) => value.trimStart()))}
      />
    </label>
  );
}

function parseDuration(value: string, fallback: number): number {
  const minutes = Number(value.match(/\d+/)?.[0]);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 180 ? minutes : fallback;
}
