"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Edit3, RefreshCw, Search, Sparkles } from "lucide-react";
import { getApprovedTopics, TopicDetail } from "@/lib/api/activityIdeation";

function ActivityGenerationContent() {
  const searchParams = useSearchParams();
  const preselectedTopicId = searchParams.get("topic_id");
  const [topics, setTopics] = useState<TopicDetail[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getApprovedTopics()
      .then((results) => {
        if (cancelled) return;
        setTopics(results);
        if (preselectedTopicId && results.some((item) => item.topic.topic_id === preselectedTopicId)) {
          setSelectedId(preselectedTopicId);
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

  const filteredTopics = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return topics;
    return topics.filter((item) =>
      `${item.topic.topic} ${item.topic.short_description || ""} ${item.topic_family_name} ${item.keywords.join(" ")}`
        .toLowerCase()
        .includes(search),
    );
  }, [topics, query]);

  const selectedTopic = topics.find((item) => item.topic.topic_id === selectedId);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Activity Generation</h1>
          <p className="mt-2 text-slate-600">Choose an approved topic to create and review educational activities.</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setError("");
            setRefreshKey((current) => current + 1);
          }}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh topics
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="relative mb-4 block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search approved topics..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#5B50F5] focus:ring-2 focus:ring-[#5B50F5]/20"
            />
          </label>
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading approved topics...</p>
          ) : filteredTopics.length === 0 ? (
            <div className="rounded-xl bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              <p>{topics.length ? "No topics match your search." : "There are no approved topics available yet."}</p>
              {!topics.length && (
                <p className="mx-auto mt-2 max-w-sm">
                  Open Topic Library to edit draft topics, then approve them here for activity generation.
                </p>
              )}
              <div className="mt-4 flex justify-center gap-2">
                <Link href="/topics/library" className="inline-flex items-center gap-1.5 rounded-lg bg-[#5B50F5] px-3 py-2 text-xs font-semibold text-white">
                  Topic Library
                </Link>
              </div>
            </div>
          ) : (
            <div className="max-h-[620px] space-y-3 overflow-y-auto pr-1">
              {filteredTopics.map(({ topic, topic_family_name }) => (
                <button
                  key={topic.topic_id}
                  onClick={() => setSelectedId(topic.topic_id)}
                  className={`w-full rounded-xl border p-4 text-left transition-colors ${
                    selectedId === topic.topic_id
                      ? "border-[#5B50F5] bg-[#F7F7FF] ring-1 ring-[#5B50F5]/20"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-slate-900">{topic.topic}</span>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                      topic.status === "APPROVED" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                    }`}>{topic.status}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{topic.short_description}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{topic_family_name}</span>
                    <span>·</span>
                    <span>Ages {topic.age_min}–{topic.age_max}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {selectedTopic ? (
            <>
              <div className="mb-4 flex items-center gap-2 text-[#5B50F5]">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Selected topic</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">{selectedTopic.topic.topic}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {selectedTopic.topic.full_description || selectedTopic.topic.short_description || "No description provided."}
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 text-sm">
                <div><dt className="text-xs text-slate-500">Age range</dt><dd className="mt-1 font-semibold text-slate-800">{selectedTopic.topic.age_min}–{selectedTopic.topic.age_max} years</dd></div>
                <div><dt className="text-xs text-slate-500">Class / grade</dt><dd className="mt-1 font-semibold text-slate-800">{selectedTopic.topic.target_class || "Not specified"}</dd></div>
                <div><dt className="text-xs text-slate-500">Family</dt><dd className="mt-1 font-semibold text-slate-800">{selectedTopic.topic_family_name}</dd></div>
                <div><dt className="text-xs text-slate-500">Context</dt><dd className="mt-1 font-semibold text-slate-800">{selectedTopic.topic.country_context || "Not specified"}</dd></div>
              </dl>
              {selectedTopic.skills.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Supported skills</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTopic.skills.map((skill) => (
                      <span key={`${skill.skill_id}-${skill.sub_skill_id}`} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                        {skill.skill_name} · {skill.sub_skill_name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Link
                href={`/activity-ideation?topic_id=${encodeURIComponent(selectedTopic.topic.topic_id)}`}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5B50F5] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#4740d4]"
              >
                Generate Activities <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={{
                  pathname: "/topics/detail",
                  query: { id: selectedTopic.topic.topic_id },
                }}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Edit3 className="h-4 w-4" /> Edit topic details
              </Link>
            </>
          ) : (
            <div className="py-10 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Select a topic to view its details and generate activities.</p>
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
