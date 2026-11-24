"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import {
  MainActivity,
  PostActivity,
  PreActivity,
} from "@/lib/api/activityIdeation";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  Sparkles,
  BookOpen,
  Compass,
  CheckCircle,
  HelpCircle,
  Lightbulb,
  ShieldAlert,
  Layers,
  RefreshCw,
  Loader2,
} from "lucide-react";

interface Props {
  activityName: string;
  activityDuration: string;
  preActivity: PreActivity;
  mainActivity: MainActivity;
  postActivity: PostActivity;
  legacy?: boolean;
  onRegenerateSection?: (section: "pre_activity" | "main_activity" | "post_activity") => void;
  regeneratingSection?: "pre_activity" | "main_activity" | "post_activity" | null;
  canRegenerateSection?: boolean;
}

export function ActivityTemplateView({
  activityName,
  activityDuration,
  preActivity,
  mainActivity,
  postActivity,
  legacy = false,
  onRegenerateSection,
  regeneratingSection,
  canRegenerateSection = true,
}: Props) {
  const [expandedSections, setExpandedSections] = useState({
    pre: true,
    main: true,
    post: true,
  });

  const toggleSection = (section: "pre" | "main" | "post") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const expandAll = () => {
    setExpandedSections({ pre: true, main: true, post: true });
  };

  const collapseAll = () => {
    setExpandedSections({ pre: false, main: false, post: false });
  };

  const allExpanded = expandedSections.pre && expandedSections.main && expandedSections.post;

  return (
    <div className="space-y-4">
      {legacy && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-5 text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>This activity predates the OCTAKIDZ template. Fields not previously stored are marked as not recorded.</span>
        </p>
      )}

      {/* Global Expand / Collapse All controls */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Activity Blueprint (3 Sections)
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={allExpanded ? collapseAll : expandAll}
            className="font-semibold text-[#5B50F5] hover:text-[#4740d4] hover:underline transition-colors cursor-pointer"
          >
            {allExpanded ? "Collapse All Sections" : "Expand All Sections"}
          </button>
        </div>
      </div>

      {/* SECTION 1: PRE-ACTIVITY */}
      <CollapsibleSection
        title="Pre-Activity"
        subtitle="Warm-up, Parent Guidance & Context"
        badge="Section 1"
        badgeColor="bg-sky-50 text-sky-700 border-sky-200"
        icon={<BookOpen className="w-4 h-4 text-sky-600" />}
        isExpanded={expandedSections.pre}
        onToggle={() => toggleSection("pre")}
        onRegenerate={
          onRegenerateSection && canRegenerateSection
            ? () => onRegenerateSection("pre_activity")
            : undefined
        }
        isRegenerating={regeneratingSection === "pre_activity"}
      >
        <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
          <TemplateValue
            label="Activity Name"
            value={activityName}
            icon={<Sparkles className="w-3.5 h-3.5 text-[#5B50F5]" />}
          />
          <TemplateValue
            label="Activity Duration"
            value={activityDuration}
            icon={<Clock className="w-3.5 h-3.5 text-amber-600" />}
          />
        </div>

        <TemplateValue
          label="Activity Description"
          value={preActivity.activity_description}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TemplateValue
            label="Parent's Note"
            value={preActivity.parents_note}
            hint="Safety, materials or assistance needed"
            required
          />
          <TemplateValue
            label="Parent's Guide"
            value={preActivity.parents_guide}
            emptyMessage="Adult guidance not required for this activity."
            optional
          />
        </div>

        <TemplateList
          label="Pre-Activity Engagement"
          values={preActivity.pre_activity_engagement}
          emptyMessage="No warm-up prompts specified."
          hint="Warm-up questions or mini-prompts"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TemplateValue
            label="Why / How Is This Important?"
            value={preActivity.why_how_is_this_important}
            icon={<Lightbulb className="w-3.5 h-3.5 text-amber-500" />}
            required
          />
          <TemplateValue
            label="Let's Get Started!"
            value={preActivity.lets_get_started}
            icon={<Compass className="w-3.5 h-3.5 text-[#5B50F5]" />}
            required
          />
        </div>
      </CollapsibleSection>

      {/* SECTION 2: MAIN ACTIVITY */}
      <CollapsibleSection
        title="Main Activity"
        subtitle="Core Hands-On Process & Reflection"
        badge="Section 2"
        badgeColor="bg-violet-50 text-violet-700 border-violet-200"
        icon={<Layers className="w-4 h-4 text-violet-600" />}
        isExpanded={expandedSections.main}
        onToggle={() => toggleSection("main")}
        onRegenerate={
          onRegenerateSection && canRegenerateSection
            ? () => onRegenerateSection("main_activity")
            : undefined
        }
        isRegenerating={regeneratingSection === "main_activity"}
      >
        <TemplateValue
          label="Activity Step / Task Title"
          value={mainActivity.activity_step_task_title}
          required
        />

        <TemplateValue
          label="Scenario / Real-Life Connection"
          value={mainActivity.scenario_real_life_connection}
          emptyMessage="Direct conceptual connection (no separate scenario needed)."
          optional
        />

        <TemplateList
          label="Activity In-depth Description and Process"
          values={mainActivity.in_depth_description_and_process}
          ordered
          required
          hint="Step-by-step actionable instructions"
        />

        <TemplateList
          label="Reflection Questions"
          values={mainActivity.reflection_questions}
          ordered
          required
          hint="Prompts to deepen understanding"
        />
      </CollapsibleSection>

      {/* SECTION 3: POST-ACTIVITY */}
      <CollapsibleSection
        title="Post-Activity"
        subtitle="Next Steps, Leveling Up & Summary"
        badge="Section 3"
        badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
        icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
        isExpanded={expandedSections.post}
        onToggle={() => toggleSection("post")}
        onRegenerate={
          onRegenerateSection && canRegenerateSection
            ? () => onRegenerateSection("post_activity")
            : undefined
        }
        isRegenerating={regeneratingSection === "post_activity"}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TemplateValue
            label="What's Next?"
            value={postActivity.whats_next}
            required
          />
          <TemplateValue
            label="How to Improve or Level Up"
            value={postActivity.how_to_improvise_or_level_up}
            required
          />
        </div>

        <TemplateList
          label="Extend the Learning"
          values={postActivity.extend_the_learning}
          hint="Follow-up challenges and experiments"
          required
        />

        <TemplateValue
          label="Post-Activity Summary"
          value={postActivity.post_activity_summary}
          required
        />
      </CollapsibleSection>
    </div>
  );
}

function CollapsibleSection({
  title,
  subtitle,
  badge,
  badgeColor,
  icon,
  isExpanded,
  onToggle,
  onRegenerate,
  isRegenerating,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs transition-all">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3.5 bg-slate-50/60 border-b border-slate-100">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-3 text-left focus:outline-none flex-1 min-w-[200px]"
        >
          <div className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-slate-700">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 transition-transform duration-200" />
            ) : (
              <ChevronRight className="w-4 h-4 transition-transform duration-200" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
              {badge}
            </span>
            <div>
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                {icon}
                <span>{title}</span>
              </h4>
              <p className="text-[11px] text-slate-500">{subtitle}</p>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {onRegenerate && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRegenerate();
              }}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              title={`Regenerate ${title} section with AI`}
            >
              {isRegenerating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5B50F5]" />
                  <span className="text-[11px]">Regenerating...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px]">Regenerate Section</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </section>
  );
}

function TemplateValue({
  label,
  value,
  icon,
  emptyMessage = "Not recorded.",
  required = false,
  optional = false,
  hint,
}: {
  label: string;
  value: string | null | undefined;
  icon?: ReactNode;
  emptyMessage?: string;
  required?: boolean;
  optional?: boolean;
  hint?: string;
}) {
  const hasValue = Boolean(value && value.trim());

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          {icon}
          <span>{label}</span>
          {required && <span className="text-red-500 text-[10px]">*</span>}
        </h5>
        {optional && (
          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            Optional
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      <p
        className={`whitespace-pre-line text-sm leading-relaxed ${
          hasValue ? "text-slate-700 font-normal" : "text-slate-400 italic"
        }`}
      >
        {hasValue ? value : emptyMessage}
      </p>
    </div>
  );
}

function TemplateList({
  label,
  values,
  ordered = false,
  emptyMessage = "Not recorded.",
  required = false,
  hint,
}: {
  label: string;
  values: string[];
  ordered?: boolean;
  emptyMessage?: string;
  required?: boolean;
  hint?: string;
}) {
  const hasItems = values && values.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span>{label}</span>
          {required && <span className="text-red-500 text-[10px]">*</span>}
          {hasItems && (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">
              {values.length} {values.length === 1 ? "item" : "items"}
            </span>
          )}
        </h5>
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
      {hasItems ? (
        <div className="space-y-2 mt-1">
          {values.map((value, index) => (
            <div
              key={`${index}-${value}`}
              className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-sm text-slate-700 leading-relaxed"
            >
              <span className="shrink-0 font-bold text-xs font-mono text-[#5B50F5] bg-indigo-50 border border-indigo-100 w-5 h-5 rounded-md flex items-center justify-center mt-0.5">
                {ordered ? index + 1 : "•"}
              </span>
              <div className="flex-1 whitespace-pre-line">{value}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-slate-400 italic">{emptyMessage}</p>
      )}
    </div>
  );
}
