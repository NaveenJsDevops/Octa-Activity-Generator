/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Library } from "lucide-react";
import {
  ActivityConcept,
  ActivityIdeationResult,
  approveConcept,
  generateIdeas,
  getConcepts,
  getReviewSession,
  regenerateConcept,
  rejectConcept,
  selectConcept,
  TopicDetail,
  updateConcept,
} from "@/lib/api/activityIdeation";
import { ActivityConceptCard } from "@/components/activity-ideation/ActivityConceptCard";
import { GenerationControls } from "@/components/activity-ideation/GenerationControls";
import { Skeleton } from "@/components/activity-ideation/Skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function ActivityReviewContent() {
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topic_id");
  const [topicData, setTopicData] = useState<TopicDetail | null>(null);
  const [concepts, setConcepts] = useState<ActivityConcept[]>([]);
  const [legacyConcepts, setLegacyConcepts] = useState<ActivityConcept[]>([]);
  const [generationResult, setGenerationResult] = useState<ActivityIdeationResult | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [busyConceptId, setBusyConceptId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!topicId) {
      setError("No topic was selected.");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [topicResponse, savedConcepts] = await Promise.all([
          fetch(`${API_URL}/api/topics/${encodeURIComponent(topicId)}`),
          getConcepts(topicId),
        ]);
        if (!topicResponse.ok) throw new Error("Failed to load topic details");
        const topic = await topicResponse.json() as TopicDetail;
        if (!["APPROVED", "SELECTED"].includes(topic.topic.status)) {
          throw new Error("Only approved topics can be used to generate activities.");
        }
        if (cancelled) return;
        setTopicData(topic);
        setLegacyConcepts(savedConcepts);

        const storedSessionId = window.sessionStorage.getItem(`activity-review:${topicId}`);
        if (storedSessionId) {
          try {
            const session = await getReviewSession(storedSessionId);
            if (!cancelled) {
              setSessionId(session.session_id);
              setGenerationResult(session);
              setConcepts(session.concepts);
            }
          } catch (sessionError) {
            window.sessionStorage.removeItem(`activity-review:${topicId}`);
            if (!(sessionError instanceof Error) || !sessionError.message.includes("404")) {
              throw sessionError;
            }
          }
        }
      } catch (loadError: any) {
        if (!cancelled) setError(loadError.message || "Failed to load the activity generation screen");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  const handleGenerate = async (count: number) => {
    if (!topicId || isGenerating) return;
    if (concepts.some((concept) => concept.status === "TEMPORARY") &&
        !window.confirm("Generate a new batch? Unreviewed temporary concepts from this batch will no longer be shown.")) {
      return;
    }
    setIsGenerating(true);
    setError("");
    setNotice("");
    try {
      const result = await generateIdeas(topicId, count);
      setGenerationResult(result);
      setSessionId(result.session_id);
      setConcepts(result.concepts);
      window.sessionStorage.setItem(`activity-review:${topicId}`, result.session_id);
      setNotice(`${result.accepted_count} activity concepts are ready for review. Nothing is saved until you approve it.`);
    } catch (generationError: any) {
      setError(generationError.message || "Failed to generate activities");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateInList = (updated: ActivityConcept) => {
    setConcepts((current) => current.map((concept) =>
      concept.concept_id === updated.concept_id ? updated : concept,
    ));
  };

  const runConceptAction = useCallback(async (
    conceptId: string,
    action: () => Promise<ActivityConcept>,
    successMessage?: string,
  ) => {
    if (busyConceptId || !sessionId) return;
    setBusyConceptId(conceptId);
    setError("");
    setNotice("");
    try {
      updateInList(await action());
      if (successMessage) setNotice(successMessage);
    } catch (actionError: any) {
      setError(actionError.message || "The activity action failed");
    } finally {
      setBusyConceptId("");
    }
  }, [busyConceptId, sessionId]);

  const handleLegacySelect = async (conceptId: string) => {
    setError("");
    try {
      await selectConcept(conceptId);
      if (topicId) setLegacyConcepts(await getConcepts(topicId));
    } catch (selectError: any) {
      setError(selectError.message || "Failed to select the saved concept");
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-8"><Skeleton /></div>;
  }
  if (!topicData || !topicId) {
    return (
      <div className="mx-auto max-w-6xl rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="mt-3 text-xl font-bold text-red-900">Topic unavailable</h1>
        <p className="mt-2 text-sm text-red-700">{error || "Choose an approved topic to continue."}</p>
        <Link href="/activities" className="mt-5 inline-flex rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700">Back to topics</Link>
      </div>
    );
  }

  const pendingCount = concepts.filter((concept) => concept.status === "TEMPORARY").length;

  return (
    <div className="mx-auto max-w-7xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/activities" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#5B50F5]">
          <ArrowLeft className="h-4 w-4" /> Back to approved topics
        </Link>
        <Link href="/activities/library" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <Library className="h-4 w-4" /> Activity Library
        </Link>
      </div>

      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B50F5]">Activity generation · {topicData.topic.status}</span>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">{topicData.topic.topic}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {topicData.topic.full_description || topicData.topic.short_description}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="font-semibold text-slate-800">Ages {topicData.topic.age_min}–{topicData.topic.age_max}</div>
            <div className="mt-1 text-slate-500">{topicData.topic.target_class || "Class/grade not specified"}</div>
            <div className="mt-1 text-slate-500">{topicData.topic_family_name}</div>
          </div>
        </div>
        {topicData.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {topicData.skills.map((skill) => (
              <span key={`${skill.skill_id}-${skill.sub_skill_id}`} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                {skill.skill_name} · {skill.sub_skill_name}
              </span>
            ))}
          </div>
        )}
      </header>

      {error && <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{notice}</div>}

      <GenerationControls onGenerate={handleGenerate} isGenerating={isGenerating} isDisabled={pendingCount > 0} />
      {generationResult && (generationResult.duplicate_count > 0 || generationResult.rejected_count > 0) && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {generationResult.duplicate_count} duplicate and {generationResult.rejected_count} invalid candidates were excluded from review.
        </p>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Review generated activities</h2>
            <p className="mt-1 text-sm text-slate-500">Edit, regenerate, approve, or reject each temporary activity. Only approved items are saved.</p>
          </div>
          {pendingCount > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{pendingCount} awaiting review</span>}
        </div>
        {concepts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 p-10 text-center text-sm text-slate-500">
            Generate a batch to see temporary activity concepts for review.
          </div>
        ) : (
          <div className="space-y-6">
            {concepts.map((concept) => (
              <ActivityConceptCard
                key={concept.concept_id}
                concept={concept}
                disabled={Boolean(busyConceptId)}
                onEdit={(updates) => runConceptAction(
                  concept.concept_id,
                  () => updateConcept(sessionId, concept.concept_id, updates),
                )}
                onRegenerate={() => runConceptAction(
                  concept.concept_id,
                  () => regenerateConcept(sessionId, concept.concept_id),
                  "Activity concept regenerated.",
                )}
                onApprove={() => runConceptAction(
                  concept.concept_id,
                  () => approveConcept(sessionId, concept.concept_id),
                  "Activity approved and saved to the Activity Library.",
                )}
                onReject={() => runConceptAction(
                  concept.concept_id,
                  () => rejectConcept(sessionId, concept.concept_id),
                  "Activity rejected. It was not saved.",
                )}
              />
            ))}
          </div>
        )}
      </section>

      {legacyConcepts.length > 0 && (
        <section className="space-y-3 border-t border-slate-200 pt-7">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Previously saved concepts</h2>
            <p className="mt-1 text-sm text-slate-500">Existing concept selection remains available for concepts saved before this review workflow.</p>
          </div>
          {legacyConcepts.map((concept) => (
            <article key={concept.concept_id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <h3 className="font-semibold text-slate-900">{concept.activity_title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{concept.activity_concept}</p>
                <span className="mt-2 inline-block text-xs font-semibold text-slate-500">{concept.status}</span>
              </div>
              {concept.status === "DRAFT" && (
                <button onClick={() => void handleLegacySelect(concept.concept_id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  Select concept
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default function ActivityIdeationPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8"><Skeleton /></div>}>
      <ActivityReviewContent />
    </Suspense>
  );
}
