/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import {
  ActivityConcept,
  MainActivity,
  PostActivity,
  PreActivity,
} from "@/lib/api/activityIdeation";
import { ActivityTemplateView } from "@/components/activity-ideation/ActivityTemplateView";
import {
  CalendarClock,
  Check,
  FileSpreadsheet,
  FileText,
  Pencil,
  RefreshCw,
  X,
  Library,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BookOpen,
  Layers,
  CheckCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { formatDateTime } from "@/lib/dateTime";
import { exportActivityToExcel, exportActivityToPdf } from "@/lib/exportUtils";

interface Props {
  concept: ActivityConcept;
  disabled?: boolean;
  topicMeta?: {
    topic_title?: string;
    topic_family_name?: string;
    country_context?: string;
    keywords?: string[];
    mappings?: any;
    user_selected_intelligence?: string;
    user_selected_skills?: string[];
    user_selected_sub_skills?: string[];
    suggested_intelligence?: string;
    suggested_skills?: string[];
    suggested_sub_skills?: string[];
  };
  onEdit: (updates: Partial<ActivityConcept>) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onRegenerateSection?: (section: "pre_activity" | "main_activity" | "post_activity") => Promise<void>;
}

interface ActivityDraft {
  activity_name: string;
  activity_duration: string;
  pre_activity: PreActivity;
  main_activity: MainActivity;
  post_activity: PostActivity;
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] transition-all";

export function ActivityConceptCard({
  concept,
  disabled = false,
  topicMeta,
  onEdit,
  onRegenerate,
  onApprove,
  onReject,
  onRegenerateSection,
}: Props) {
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [initialDraft, setInitialDraft] = useState<ActivityDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<"pre_activity" | "main_activity" | "post_activity" | null>(null);

  // Edit section toggle states
  const [editSections, setEditSections] = useState({
    pre: true,
    main: true,
    post: true,
  });

  const editable = concept.status === "TEMPORARY";
  const preActivity = concept.pre_activity || legacyPreActivity(concept);
  const mainActivity = concept.main_activity || legacyMainActivity(concept);
  const postActivity = concept.post_activity || legacyPostActivity(concept);

  // Compute dirty state
  const isDirty = useMemo(() => {
    if (!draft || !initialDraft) return false;
    return JSON.stringify(draft) !== JSON.stringify(initialDraft);
  }, [draft, initialDraft]);

  // Warn user on tab close / reload if there are unsaved edits
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Auto-save working draft to sessionStorage
  useEffect(() => {
    if (!draft) return;
    try {
      window.sessionStorage.setItem(
        `octa_concept_draft_${concept.concept_id}`,
        JSON.stringify(draft)
      );
    } catch {
      // Ignore storage errors
    }
  }, [draft, concept.concept_id]);

  const mergedData = {
    ...concept,
    topic_title: concept.topic_title || topicMeta?.topic_title,
    topic_family_name: concept.topic_family_name || topicMeta?.topic_family_name,
    country_context: concept.country_context || topicMeta?.country_context,
    keywords: concept.keywords?.length ? concept.keywords : topicMeta?.keywords || [],
    mappings: concept.mappings || topicMeta?.mappings,
    user_selected_intelligence: concept.user_selected_intelligence || topicMeta?.user_selected_intelligence,
    user_selected_skills: concept.user_selected_skills?.length ? concept.user_selected_skills : topicMeta?.user_selected_skills || [],
    user_selected_sub_skills: concept.user_selected_sub_skills?.length ? concept.user_selected_sub_skills : topicMeta?.user_selected_sub_skills || [],
    suggested_intelligence: concept.suggested_intelligence || topicMeta?.suggested_intelligence,
    suggested_skills: concept.suggested_skills?.length ? concept.suggested_skills : topicMeta?.suggested_skills || [],
    suggested_sub_skills: concept.suggested_sub_skills?.length ? concept.suggested_sub_skills : topicMeta?.suggested_sub_skills || [],
    pre_activity: preActivity,
    main_activity: mainActivity,
    post_activity: postActivity,
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await exportActivityToExcel(mergedData);
    } catch (err: any) {
      alert(err.message || "Failed to export Excel file");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPdf = () => {
    exportActivityToPdf(mergedData);
  };

  const startEditing = () => {
    // Check if there is a preserved draft in sessionStorage
    let savedDraft: ActivityDraft | null = null;
    try {
      const raw = window.sessionStorage.getItem(`octa_concept_draft_${concept.concept_id}`);
      if (raw) savedDraft = JSON.parse(raw);
    } catch {}

    const newDraft: ActivityDraft = savedDraft || {
      activity_name: concept.activity_name || concept.activity_title,
      activity_duration: concept.activity_duration || `${concept.estimated_duration || 30} minutes`,
      pre_activity: { ...preActivity, pre_activity_engagement: [...preActivity.pre_activity_engagement] },
      main_activity: {
        ...mainActivity,
        in_depth_description_and_process: [...mainActivity.in_depth_description_and_process],
        reflection_questions: [...mainActivity.reflection_questions],
      },
      post_activity: { ...postActivity, extend_the_learning: [...postActivity.extend_the_learning] },
    };

    setDraft(newDraft);
    setInitialDraft(JSON.parse(JSON.stringify(newDraft)));
    setSaveError("");
  };

  const cancelEditing = () => {
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Are you sure you want to discard your edits?")) {
        return;
      }
    }
    try {
      window.sessionStorage.removeItem(`octa_concept_draft_${concept.concept_id}`);
    } catch {}
    setDraft(null);
    setInitialDraft(null);
    setSaveError("");
  };

  const updatePre = <K extends keyof PreActivity>(key: K, value: PreActivity[K]) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            pre_activity: { ...current.pre_activity, [key]: value },
          }
        : current
    );
  };

  const updateMain = <K extends keyof MainActivity>(key: K, value: MainActivity[K]) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            main_activity: { ...current.main_activity, [key]: value },
          }
        : current
    );
  };

  const updatePost = <K extends keyof PostActivity>(key: K, value: PostActivity[K]) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            post_activity: { ...current.post_activity, [key]: value },
          }
        : current
    );
  };

  const save = async () => {
    if (!draft) return;
    if (!draft.activity_name.trim()) {
      setSaveError("Activity name cannot be empty.");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      await onEdit({
        activity_name: draft.activity_name.trim(),
        activity_title: draft.activity_name.trim(),
        activity_duration: draft.activity_duration.trim(),
        estimated_duration: parseDuration(draft.activity_duration, concept.estimated_duration || 30),
        pre_activity: draft.pre_activity,
        main_activity: draft.main_activity,
        post_activity: draft.post_activity,
      });
      try {
        window.sessionStorage.removeItem(`octa_concept_draft_${concept.concept_id}`);
      } catch {}
      setDraft(null);
      setInitialDraft(null);
    } catch (err: any) {
      setSaveError(err.message || "Failed to persist changes");
    } finally {
      setSaving(false);
    }
  };

  const handleSectionRegenerate = async (section: "pre_activity" | "main_activity" | "post_activity") => {
    if (!onRegenerateSection) return;
    if (draft && isDirty) {
      alert("Please save or cancel your unsaved changes before regenerating a section.");
      return;
    }
    setRegeneratingSection(section);
    try {
      await onRegenerateSection(section);
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleApproveWithConfirm = async () => {
    await onApprove();
  };

  const handleRejectWithConfirm = async () => {
    if (window.confirm("Are you sure you want to reject this activity concept? It will not be saved.")) {
      await onReject();
    }
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-slate-50 shadow-sm transition-all ${
        concept.status === "APPROVED"
          ? "border-emerald-300 ring-1 ring-emerald-200"
          : concept.status === "REJECTED"
          ? "border-red-200 opacity-80"
          : draft
          ? "border-indigo-300 ring-2 ring-indigo-200 bg-white"
          : "border-slate-200"
      }`}
    >
      {/* Card Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {concept.activity_type_id}
          </span>
          {draft && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 animate-pulse">
              <Pencil className="w-3 h-3" />
              Editing Mode
            </span>
          )}
          {isDirty && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {formatDateTime(concept.created_at) && (
            <time dateTime={concept.created_at} className="inline-flex items-center gap-1 text-xs text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Generated {formatDateTime(concept.created_at)}
            </time>
          )}
          <span className="text-[10px] font-medium text-slate-500">
            {concept.status === "TEMPORARY"
              ? "Unsaved review result"
              : concept.status === "APPROVED"
              ? "Saved to Activity Library"
              : "Not saved"}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
              concept.status === "APPROVED"
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : concept.status === "REJECTED"
                ? "bg-red-100 text-red-800 border border-red-200"
                : "bg-amber-100 text-amber-800 border border-amber-200"
            }`}
          >
            {concept.status}
          </span>
        </div>
      </header>

      {/* Card Body */}
      <div className="space-y-4 p-4 sm:p-6">
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2.5 text-xs font-medium">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-600" />
            <p className="flex-1">{saveError}</p>
          </div>
        )}

        {draft ? (
          /* ==================== EDITING INTERFACE ==================== */
          <div className="space-y-5 rounded-2xl border border-indigo-100 bg-white p-4 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#5B50F5]" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Edit Activity Details
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditSections({
                      pre: !editSections.pre,
                      main: !editSections.main,
                      post: !editSections.post,
                    })
                  }
                  className="text-xs font-semibold text-[#5B50F5] hover:underline"
                >
                  {editSections.pre && editSections.main && editSections.post
                    ? "Collapse Edit Sections"
                    : "Expand Edit Sections"}
                </button>
              </div>
            </div>

            {/* Basic details */}
            <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
              <TextEditor
                label="Activity Name"
                value={draft.activity_name}
                onChange={(value) => setDraft({ ...draft, activity_name: value })}
                required
              />
              <TextEditor
                label="Activity Duration"
                value={draft.activity_duration}
                onChange={(value) => setDraft({ ...draft, activity_duration: value })}
                required
              />
            </div>

            {/* Edit Section 1: Pre-Activity */}
            <EditCollapsibleSection
              title="Pre-Activity"
              subtitle="Warm-up, Parent Guidance & Context"
              icon={<BookOpen className="w-4 h-4 text-sky-600" />}
              badgeColor="bg-sky-50 text-sky-700 border-sky-200"
              isExpanded={editSections.pre}
              onToggle={() =>
                setEditSections((prev) => ({ ...prev, pre: !prev.pre }))
              }
            >
              <TextEditor
                label="Activity Description"
                value={draft.pre_activity.activity_description}
                onChange={(value) => updatePre("activity_description", value)}
                multiline
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextEditor
                  label="Parent's Note"
                  value={draft.pre_activity.parents_note}
                  onChange={(value) => updatePre("parents_note", value)}
                  multiline
                  required
                />
                <TextEditor
                  label="Parent's Guide"
                  value={draft.pre_activity.parents_guide || ""}
                  onChange={(value) => updatePre("parents_guide", value || null)}
                  multiline
                  optional
                />
              </div>
              <ListEditor
                label="Pre-Activity Engagement (up to 3 warm-ups, one per line)"
                values={draft.pre_activity.pre_activity_engagement}
                onChange={(value) => updatePre("pre_activity_engagement", value)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextEditor
                  label="Why/How Is This Important?"
                  value={draft.pre_activity.why_how_is_this_important}
                  onChange={(value) => updatePre("why_how_is_this_important", value)}
                  multiline
                  required
                />
                <TextEditor
                  label="Let's Get Started!"
                  value={draft.pre_activity.lets_get_started}
                  onChange={(value) => updatePre("lets_get_started", value)}
                  multiline
                  required
                />
              </div>
            </EditCollapsibleSection>

            {/* Edit Section 2: Main Activity */}
            <EditCollapsibleSection
              title="Main Activity"
              subtitle="Core Hands-On Process & Reflection"
              icon={<Layers className="w-4 h-4 text-violet-600" />}
              badgeColor="bg-violet-50 text-violet-700 border-violet-200"
              isExpanded={editSections.main}
              onToggle={() =>
                setEditSections((prev) => ({ ...prev, main: !prev.main }))
              }
            >
              <TextEditor
                label="Activity Step / Task Title"
                value={draft.main_activity.activity_step_task_title}
                onChange={(value) => updateMain("activity_step_task_title", value)}
                required
              />
              <TextEditor
                label="Scenario / Real-Life Connection"
                value={draft.main_activity.scenario_real_life_connection || ""}
                onChange={(value) => updateMain("scenario_real_life_connection", value || null)}
                multiline
                optional
              />
              <ListEditor
                label="Activity In-depth Description and Process (one step per line)"
                values={draft.main_activity.in_depth_description_and_process}
                onChange={(value) => updateMain("in_depth_description_and_process", value)}
                rows={6}
                required
              />
              <ListEditor
                label="Reflection Questions (one question per line)"
                values={draft.main_activity.reflection_questions}
                onChange={(value) => updateMain("reflection_questions", value)}
                rows={3}
                required
              />
            </EditCollapsibleSection>

            {/* Edit Section 3: Post-Activity */}
            <EditCollapsibleSection
              title="Post-Activity"
              subtitle="Next Steps, Leveling Up & Summary"
              icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
              badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
              isExpanded={editSections.post}
              onToggle={() =>
                setEditSections((prev) => ({ ...prev, post: !prev.post }))
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <TextEditor
                  label="What's Next?"
                  value={draft.post_activity.whats_next}
                  onChange={(value) => updatePost("whats_next", value)}
                  multiline
                  required
                />
                <TextEditor
                  label="How to Improve or Level Up"
                  value={draft.post_activity.how_to_improvise_or_level_up}
                  onChange={(value) => updatePost("how_to_improvise_or_level_up", value)}
                  multiline
                  required
                />
              </div>
              <ListEditor
                label="Extend the Learning (one challenge per line)"
                values={draft.post_activity.extend_the_learning}
                onChange={(value) => updatePost("extend_the_learning", value)}
                required
              />
              <TextEditor
                label="Post-Activity Summary"
                value={draft.post_activity.post_activity_summary}
                onChange={(value) => updatePost("post_activity_summary", value)}
                multiline
                required
              />
            </EditCollapsibleSection>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                {isDirty ? (
                  <span className="font-semibold text-amber-700">
                    You have unsaved edits.
                  </span>
                ) : (
                  <span>No changes made yet.</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-2xs transition-colors"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || disabled}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#5B50F5] hover:bg-[#4740d4] px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 shadow-xs transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ==================== VIEWING INTERFACE ==================== */
          <>
            <ActivityTemplateView
              activityName={concept.activity_name || concept.activity_title}
              activityDuration={concept.activity_duration || `${concept.estimated_duration || "Not specified"} minutes`}
              preActivity={preActivity}
              mainActivity={mainActivity}
              postActivity={postActivity}
              onRegenerateSection={onRegenerateSection ? handleSectionRegenerate : undefined}
              regeneratingSection={regeneratingSection}
              canRegenerateSection={editable && !disabled}
            />
            <EducationalMetadata concept={concept} topicMeta={topicMeta} />
          </>
        )}
      </div>

      {/* Card Footer Bar */}
      {!draft && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            {editable ? (
              <>
                <button
                  onClick={startEditing}
                  disabled={disabled || regeneratingSection !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-2xs transition-colors"
                  title="Edit activity fields in place"
                >
                  <Pencil className="h-3.5 w-3.5 text-slate-500" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => void onRegenerate()}
                  disabled={disabled || regeneratingSection !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 shadow-2xs transition-colors"
                  title="Regenerate all 3 sections of this activity"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Regenerate Entire Activity</span>
                </button>
                <button
                  onClick={() => void handleApproveWithConfirm()}
                  disabled={disabled || regeneratingSection !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 shadow-2xs transition-colors"
                  title="Approve and persist this activity to the library"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Approve</span>
                </button>
                <button
                  onClick={() => void handleRejectWithConfirm()}
                  disabled={disabled || regeneratingSection !== null}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 shadow-2xs transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reject</span>
                </button>
              </>
            ) : concept.status === "APPROVED" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-semibold text-emerald-800">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Approved &amp; Persisted</span>
                </span>
                <Link
                  href="/activities/library"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#5B50F5] hover:bg-[#4740d4] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors"
                >
                  <Library className="h-3.5 w-3.5" />
                  <span>Open in Activity Library →</span>
                </Link>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Download Activity as Excel (.xlsx)"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Export Excel</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-100 transition-colors shadow-2xs cursor-pointer"
              title="Print or Save as PDF"
            >
              <FileText className="h-3.5 w-3.5 text-[#5B50F5]" />
              <span>Export PDF</span>
            </button>
          </div>
        </footer>
      )}
    </article>
  );
}

function EditCollapsibleSection({
  title,
  subtitle,
  icon,
  badgeColor,
  isExpanded,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  badgeColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/40">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3.5 bg-slate-50 border-b border-slate-100 hover:bg-slate-100/70 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded bg-white border border-slate-200 text-slate-600">
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
            {title}
          </span>
          <span className="text-xs text-slate-500 font-medium">{subtitle}</span>
        </div>
      </button>
      {isExpanded && <div className="p-4 space-y-3 bg-white">{children}</div>}
    </div>
  );
}

function TextEditor({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {optional && <span className="text-[10px] font-normal text-slate-400">Optional</span>}
      </div>
      {multiline ? (
        <textarea
          rows={3}
          className={fieldClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className={fieldClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  );
}

function ListEditor({
  label,
  values,
  onChange,
  rows = 3,
  required = false,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  rows?: number;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-semibold text-slate-700">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        <span className="text-[10px] font-normal text-slate-400">One per line</span>
      </div>
      <textarea
        rows={rows}
        className={fieldClass}
        value={values.join("\n")}
        onChange={(event) =>
          onChange(
            event.target.value
              .split("\n")
              .map((value) => value.trimStart())
              .filter((v, idx, arr) => idx === arr.length - 1 || v.trim().length > 0)
          )
        }
      />
    </label>
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
    in_depth_description_and_process:
      concept.instructions.length >= 3
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

function EducationalMetadata({ concept, topicMeta }: { concept: ActivityConcept; topicMeta?: any }) {
  const intel =
    concept.suggested_intelligence ||
    topicMeta?.suggested_intelligence ||
    concept.user_selected_intelligence ||
    topicMeta?.user_selected_intelligence;
  const skills = (concept.suggested_skills?.length ? concept.suggested_skills : topicMeta?.suggested_skills) || [];
  const subSkills =
    (concept.suggested_sub_skills?.length ? concept.suggested_sub_skills : topicMeta?.suggested_sub_skills) || [];

  const details = [
    concept.age_min !== undefined &&
      concept.age_max !== undefined && [
        "Target age / class range",
        `Ages ${concept.age_min}–${concept.age_max}${concept.target_class ? ` · ${concept.target_class}` : ""}`,
      ],
    (concept.topic_family_name || topicMeta?.topic_family_name) && [
      "Topic family",
      concept.topic_family_name || topicMeta?.topic_family_name,
    ],
    (concept.country_context || topicMeta?.country_context) && [
      "Country / Context",
      concept.country_context || topicMeta?.country_context,
    ],
    intel && ["Target intelligence", intel],
    skills.length > 0 && ["Target skills", skills.join(" · ")],
    subSkills.length > 0 && ["Target sub-skills", subSkills.join(" · ")],
    concept.learning_objective && ["Learning objective", concept.learning_objective],
    concept.materials.length > 0 && ["Materials", concept.materials.join(" · ")],
    concept.assessment_criteria && ["Assessment criteria", concept.assessment_criteria],
    concept.difficulty_level && ["Difficulty", concept.difficulty_level],
  ].filter((item): item is [string, string] => Array.isArray(item));

  if (details.length === 0) return null;
  return (
    <section className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#5B50F5]">
        Additional Educational Metadata
      </h4>
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

function parseDuration(value: string, fallback: number): number {
  const minutes = Number(value.match(/\d+/)?.[0]);
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 180 ? minutes : fallback;
}
