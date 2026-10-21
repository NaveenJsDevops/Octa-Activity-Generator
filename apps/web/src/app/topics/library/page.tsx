/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { API_BASE_URL } from "@/lib/apiBase";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search, XCircle, AlertCircle, FileText, ArrowRight, ChevronDown, RefreshCw, CalendarClock } from "lucide-react";
import { formatDateTime } from "@/lib/dateTime";

// Deterministic color mapping for topic families/types
const TOPIC_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Space Exploration":    { bg: "#EEF0FF", text: "#5B50F5", border: "#d4d0fc" },
  "Earth & Environment":  { bg: "#ECFDF5", text: "#059669", border: "#a7f3d0" },
  "Life Science":         { bg: "#FFFBEB", text: "#B45309", border: "#FDE68A" },
  "Technology":           { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
  "History & Culture":    { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  "Mathematics":          { bg: "#F5F3FF", text: "#7C3AED", border: "#DDD6FE" },
  "Arts & Creativity":    { bg: "#FDF2F8", text: "#BE185D", border: "#FBCFE8" },
  "Health & Wellness":    { bg: "#ECFDF5", text: "#065F46", border: "#6EE7B7" },
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
      className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
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
      className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider"
      style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
    >
      {badge.label}
    </span>
  );
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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

  // Extract unique topic family names for the filter dropdown
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    topics.forEach(t => {
      const name = t.topic_family_name || t.topic?.topic_type;
      if (name && name !== "Unknown") set.add(name);
    });
    return Array.from(set);
  }, [topics]);

  // Client-side filtering for fast, responsive search and dropdowns
  const filteredTopics = useMemo(() => {
    return topics.filter(t => {
      // Status filter
      if (statusFilter !== "ALL" && t.topic?.status?.toUpperCase() !== statusFilter) {
        return false;
      }

      // Topic family / type filter
      if (typeFilter !== "ALL") {
        const family = t.topic_family_name || t.topic?.topic_type || "General";
        if (family !== typeFilter) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = t.topic?.topic?.toLowerCase().includes(q);
        const descMatch =
          t.topic?.short_description?.toLowerCase().includes(q) ||
          t.topic?.full_description?.toLowerCase().includes(q) ||
          t.topic?.topic_hook?.toLowerCase().includes(q);
        const keywordMatch = (t.keywords || []).some((k: string) => k.toLowerCase().includes(q));
        const familyMatch = (t.topic_family_name || "").toLowerCase().includes(q);

        if (!titleMatch && !descMatch && !keywordMatch && !familyMatch) {
          return false;
        }
      }

      return true;
    });
  }, [topics, statusFilter, typeFilter, searchQuery]);

  const hasActiveFilters = statusFilter !== "ALL" || typeFilter !== "ALL" || searchQuery.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setSearchQuery("");
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
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
            title="Reload topics from the database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            href="/topics/generate"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B50F5] hover:bg-[#4740d4] text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
          >
            + Discover New
          </Link>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        {/* Real-time search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search topics by title, keywords, description..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] transition-all shadow-sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Topic Type / Family Filter */}
        <div className="relative">
          <select
            className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] cursor-pointer shadow-sm transition-all"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Topic Types</option>
            {availableTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            className="appearance-none pl-4 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] cursor-pointer shadow-sm transition-all"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="SELECTED">Selected</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Topics list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 animate-pulse shadow-sm">
              <div className="flex justify-between items-center">
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-slate-200 rounded w-1/3" />
                  <div className="h-4 bg-slate-100 rounded w-2/3" />
                </div>
                <div className="flex gap-3 ml-6">
                  <div className="h-7 bg-slate-100 rounded-full w-28" />
                  <div className="h-9 bg-slate-200 rounded-xl w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : errorMessage ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-14 flex flex-col items-center justify-center text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">Unable to load topics</h3>
          <p className="text-slate-500 mb-2 text-sm">{errorMessage}</p>
          <p className="text-slate-400 mb-6 text-xs">Verify that the API service is reachable.</p>
          <button
            onClick={fetchTopics}
            className="px-5 py-2 bg-[#5B50F5] text-white rounded-xl font-medium hover:bg-[#4740d4] transition-colors shadow-sm text-sm"
          >
            Try Again
          </button>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-200 mb-4" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {hasActiveFilters ? "No matching topics found" : "No topics in library"}
          </h3>
          <p className="text-slate-400 max-w-sm text-sm mb-5">
            {hasActiveFilters
              ? "None of the topics match your current filter and search criteria."
              : "No topics are stored in the database yet. Discover and save candidates to get started."}
          </p>
          {hasActiveFilters ? (
            <button
              onClick={clearFilters}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors shadow-sm"
            >
              Clear Filters
            </button>
          ) : (
            <Link
              href="/topics/generate"
              className="px-4 py-2 bg-[#5B50F5] text-white rounded-xl text-sm font-semibold hover:bg-[#4740d4] transition-colors shadow-sm"
            >
              Discover Topics
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
            <span>Showing {filteredTopics.length} of {topics.length} topics</span>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-[#5B50F5] hover:underline">
                Reset filters
              </button>
            )}
          </div>

          {filteredTopics.map((t: any) => {
            const topicLabel = t.topic_family_name || t.topic?.topic_type || "General";
            const status = t.topic?.status || "DRAFT";
            const keywords = t.keywords || [];

            return (
              <div
                key={t.topic.topic_id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md hover:border-slate-300 transition-all group"
              >
                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-slate-400">
                      {t.topic.topic_id}
                    </span>
                    <StatusBadge status={status} />
                    <TopicTypeBadge label={topicLabel} />
                    {t.topic.age_suitability && (
                      <span className="text-xs text-slate-400 font-medium">
                        • {t.topic.age_suitability}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base group-hover:text-[#5B50F5] transition-colors">
                    {t.topic.topic}
                  </h3>

                  <p className="text-slate-500 text-sm line-clamp-2">
                    {t.topic.short_description || t.topic.full_description || t.topic.topic_hook || "No description provided."}
                  </p>

                  {formatDateTime(t.topic.created_at) && (
                    <p className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                      <CalendarClock className="h-3.5 w-3.5" />
                      <time dateTime={t.topic.created_at}>
                        Created {formatDateTime(t.topic.created_at)}
                      </time>
                    </p>
                  )}

                  {/* Keywords chips */}
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {keywords.slice(0, 5).map((kw: string) => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                      {keywords.length > 5 && (
                        <span className="text-xs text-slate-400 self-center">
                          +{keywords.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* View button */}
                <div className="shrink-0 flex items-center">
                  <Link
                    href={{
                      pathname: "/topics/detail",
                      query: { id: t.topic.topic_id },
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm group-hover:border-[#5B50F5] group-hover:text-[#5B50F5]"
                  >
                    View <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
