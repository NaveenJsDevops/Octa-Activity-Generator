import type { ReactNode } from "react";
import {
  MainActivity,
  PostActivity,
  PreActivity,
} from "@/lib/api/activityIdeation";

interface Props {
  activityName: string;
  activityDuration: string;
  preActivity: PreActivity;
  mainActivity: MainActivity;
  postActivity: PostActivity;
  legacy?: boolean;
}

export function ActivityTemplateView({
  activityName,
  activityDuration,
  preActivity,
  mainActivity,
  postActivity,
  legacy = false,
}: Props) {
  return (
    <div className="space-y-5">
      {legacy && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          This activity predates the OCTAKIDZ template. Fields that were not stored
          previously are marked as not recorded.
        </p>
      )}

      <TemplateSection title="Pre-Activity">
        <div className="grid gap-4 sm:grid-cols-2">
          <TemplateValue label="Activity Name" value={activityName} />
          <TemplateValue label="Activity Duration" value={activityDuration} />
        </div>
        <TemplateValue label="Activity Description" value={preActivity.activity_description} />
        <TemplateValue label="Parent's Note" value={preActivity.parents_note} />
        {preActivity.parents_guide && (
          <TemplateValue label="Parent's Guide" value={preActivity.parents_guide} />
        )}
        <TemplateList
          label="Pre-Activity Engagement"
          values={preActivity.pre_activity_engagement}
          emptyMessage="Not included for this activity."
        />
        <TemplateValue
          label="Why/How Is This Important?"
          value={preActivity.why_how_is_this_important}
        />
        <TemplateValue label="Let's Get Started!" value={preActivity.lets_get_started} />
      </TemplateSection>

      <TemplateSection title="Main Activity">
        <TemplateValue
          label="Activity Step / Task Title"
          value={mainActivity.activity_step_task_title}
        />
        <TemplateValue
          label="Scenario / Real-Life Connection (If Applicable)"
          value={mainActivity.scenario_real_life_connection}
          emptyMessage="Not applicable to this activity."
        />
        <TemplateList
          label="Activity In-depth Description and Process"
          values={mainActivity.in_depth_description_and_process}
          ordered
        />
        <TemplateList
          label="Reflection Questions"
          values={mainActivity.reflection_questions}
          ordered
          emptyMessage="Not recorded in this activity."
        />
      </TemplateSection>

      <TemplateSection title="Post-Activity">
        <TemplateValue label="What's Next" value={postActivity.whats_next} />
        <TemplateList label="Extend the Learning" values={postActivity.extend_the_learning} />
        <TemplateValue
          label="How to Improvise or Level Up"
          value={postActivity.how_to_improvise_or_level_up}
        />
        <TemplateValue label="Post-Activity Summary" value={postActivity.post_activity_summary} />
      </TemplateSection>
    </div>
  );
}

function TemplateSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h4 className="border-b border-slate-100 pb-3 text-sm font-bold uppercase tracking-wide text-[#5B50F5]">
        {title}
      </h4>
      {children}
    </section>
  );
}

function TemplateValue({
  label,
  value,
  emptyMessage = "Not recorded.",
}: {
  label: string;
  value: string | null | undefined;
  emptyMessage?: string;
}) {
  return (
    <div>
      <h5 className="text-xs font-bold text-slate-700">{label}</h5>
      <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">
        {value?.trim() || emptyMessage}
      </p>
    </div>
  );
}

function TemplateList({
  label,
  values,
  ordered = false,
  emptyMessage = "Not recorded.",
}: {
  label: string;
  values: string[];
  ordered?: boolean;
  emptyMessage?: string;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <div>
      <h5 className="text-xs font-bold text-slate-700">{label}</h5>
      {values.length > 0 ? (
        <List className={`mt-1 space-y-1 pl-5 text-sm leading-6 text-slate-600 ${ordered ? "list-decimal" : "list-disc"}`}>
          {values.map((value, index) => <li key={`${index}-${value}`}>{value}</li>)}
        </List>
      ) : (
        <p className="mt-1 text-sm leading-6 text-slate-500">{emptyMessage}</p>
      )}
    </div>
  );
}
