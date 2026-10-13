/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Check,
  X,
  Edit3,
  FileText,
  Sliders,
  Layers,
  Users,
  MapPin,
  Zap,
  Tag,
  AlertCircle,
  Play,
  Save,
  CheckCircle,
  Search,
  Archive,
  XCircle
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface EditFormState {
  topic: string;
  full_description: string;
  short_description: string;
  topic_family_name: string;
  age_min: number;
  age_max: number;
  country_context: string;
  activity_potential: string;
  keywordsInput: string;
}

export default function TopicDetailPage() {
  const params = useParams();
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const [editForm, setEditForm] = useState<EditFormState>({
    topic: "",
    full_description: "",
    short_description: "",
    topic_family_name: "",
    age_min: 5,
    age_max: 7,
    country_context: "",
    activity_potential: "HIGH",
    keywordsInput: "",
  });

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/topics/${params.id}`);
      if (!res.ok) throw new Error("Failed to fetch topic details");
      const json = await res.json();
      setData(json);

      const t = json.topic || {};
      const kwList = json.keywords || [];
      const description =
        t.full_description || t.short_description || t.why_interesting || t.topic_hook || "";

      setEditForm({
        topic: t.topic || "",
        full_description: description,
        short_description: t.short_description || "",
        topic_family_name: json.topic_family_name || "Space Exploration",
        age_min: t.age_min ?? 5,
        age_max: t.age_max ?? 7,
        country_context: t.country_context || "",
        activity_potential: t.activity_potential || "HIGH",
        keywordsInput: kwList.join(", "),
      });
    } catch (err: any) {
      setError(err.message || "Failed to load topic");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      fetchDetail();
    }
  }, [params.id, fetchDetail]);

  const handleStartEdit = () => {
    if (!data) return;
    const t = data.topic || {};
    const kwList = data.keywords || [];
    const description =
      t.full_description || t.short_description || t.why_interesting || t.topic_hook || "";

    setEditForm({
      topic: t.topic || "",
      full_description: description,
      short_description: t.short_description || "",
      topic_family_name: data.topic_family_name || "Space Exploration",
      age_min: t.age_min ?? 5,
      age_max: t.age_max ?? 7,
      country_context: t.country_context || "",
      activity_potential: t.activity_potential || "HIGH",
      keywordsInput: kwList.join(", "),
    });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    if (!data) return;
    const t = data.topic || {};
    const kwList = data.keywords || [];
    const description =
      t.full_description || t.short_description || t.why_interesting || t.topic_hook || "";

    setEditForm({
      topic: t.topic || "",
      full_description: description,
      short_description: t.short_description || "",
      topic_family_name: data.topic_family_name || "Space Exploration",
      age_min: t.age_min ?? 5,
      age_max: t.age_max ?? 7,
      country_context: t.country_context || "",
      activity_potential: t.activity_potential || "HIGH",
      keywordsInput: kwList.join(", "),
    });
    setEditing(false);
  };

  const handleUpdate = async () => {
    setSaving(true);
    setActionError("");

    const keywordsArray = editForm.keywordsInput
      .split(",")
      .map(k => k.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`${API_URL}/api/topics/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: editForm.topic,
          full_description: editForm.full_description,
          short_description: editForm.short_description || editForm.full_description.slice(0, 160),
          why_interesting: editForm.full_description,
          age_min: editForm.age_min,
          age_max: editForm.age_max,
          country_context: editForm.country_context,
          activity_potential: editForm.activity_potential,
          keywords: keywordsArray,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to update topic");
      }

      setEditing(false);
      await fetchDetail();
    } catch (err: any) {
      setActionError(err.message || "Failed to update topic");
    } finally {
      setSaving(false);
    }
  };

  // Rejecting topic: deletes the record from Excel as requested
  const handleReject = async () => {
    if (!confirm("Are you sure you want to reject this topic?\n\nThis will permanently delete the record from Excel.")) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/topics/${params.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to delete topic from Excel");
      }

      router.push("/topics/library");
    } catch (err: any) {
      setActionError(err.message || "Failed to delete topic");
    }
  };

  const handleApprove = async () => {
    setActionError("");
    try {
      const res = await fetch(`${API_URL}/api/topics/${params.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to approve topic");
      }
      await fetchDetail();
    } catch (err: any) {
      setActionError(err.message || "Approval failed");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-32" />
        <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-6 bg-slate-200 rounded-full w-24" />
            <div className="flex gap-2">
              <div className="h-10 bg-slate-200 rounded-xl w-24" />
              <div className="h-10 bg-slate-200 rounded-xl w-24" />
            </div>
          </div>
          <div className="h-9 bg-slate-200 rounded w-2/3" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
            <div className="lg:col-span-2 h-64 bg-slate-100 rounded-2xl" />
            <div className="lg:col-span-1 h-64 bg-slate-100 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Topic Not Found</h2>
        <p className="text-slate-500 text-sm">{error || "The requested topic could not be located."}</p>
        <Link
          href="/topics/library"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#5B50F5] text-white rounded-xl font-semibold text-sm hover:bg-[#4740d4] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Topic Library
        </Link>
      </div>
    );
  }

  const topic = data.topic || {};
  const status = (topic.status || "DRAFT").toUpperCase();
  const keywords: string[] = data.keywords || [];
  const topicFamily = data.topic_family_name || "Space Exploration";

  // Description text: check full_description first, then short_description, why_interesting, topic_hook
  const descriptionText: string =
    topic.full_description || topic.short_description || topic.why_interesting || topic.topic_hook || "";

  const paragraphs: string[] = descriptionText
    ? descriptionText.split(/\n+/).filter(Boolean)
    : [
        "No description provided for this topic yet. Click Edit to add details.",
      ];

  const getStatusIcon = () => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
      case "REVIEW":
        return <Search className="w-3.5 h-3.5 text-blue-500" />;
      case "SELECTED":
        return <Play className="w-3.5 h-3.5 text-indigo-500" />;
      case "REJECTED":
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Back button */}
      <div>
        <Link
          href="/topics/library"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#5B50F5] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Topics</span>
        </Link>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl flex items-center justify-between text-sm shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError("")} className="text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-8 md:p-10 space-y-6">
        {/* Card Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1 space-y-3">
            {/* Status pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-700 shadow-xs">
              {getStatusIcon()}
              <span>{status}</span>
            </div>

            {/* Title: Label in View Mode, Input Box in Edit Mode */}
            {editing ? (
              <div>
                <input
                  type="text"
                  value={editForm.topic}
                  onChange={e => setEditForm({ ...editForm, topic: e.target.value })}
                  placeholder="Topic title..."
                  className="w-full text-2xl md:text-3xl font-extrabold text-slate-900 px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] bg-white shadow-xs transition-all"
                />
              </div>
            ) : (
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {topic.topic}
              </h1>
            )}
          </div>

          {/* Action buttons (top right) */}
          <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
            {editing ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-colors shadow-xs disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-[#5B50F5] hover:bg-[#4740d4] text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Updating..." : "Update"}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                {status !== "APPROVED" && (
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={handleApprove}
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#5B50F5] hover:bg-[#4740d4] text-white font-semibold rounded-xl text-sm transition-colors shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      Approve
                    </button>
                  </div>
                )}

                {/* Reject Button: Deletes record from Excel */}
                <button
                  onClick={handleReject}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-semibold rounded-xl text-sm transition-colors shadow-xs"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>

                {/* Edit Button */}
                <button
                  onClick={handleStartEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-colors shadow-xs"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit topic
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2-Column Body Grid: Same layout in both View and Edit mode */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Left Column: Topic Description (2 cols) */}
          <div className="lg:col-span-2 bg-[#FBFBFF] border border-slate-200/80 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <FileText className="w-5 h-5 text-[#5B50F5]" />
              <span>Topic Description</span>
            </div>

            {editing ? (
              <textarea
                rows={12}
                value={editForm.full_description}
                onChange={e => setEditForm({ ...editForm, full_description: e.target.value })}
                placeholder="Enter detailed topic description and activities..."
                className="w-full p-4 border border-slate-200 rounded-xl bg-white text-slate-700 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#5B50F5] focus:border-[#5B50F5] shadow-xs resize-y transition-all"
              />
            ) : (
              <div className="text-slate-600 text-[15px] leading-relaxed space-y-4">
                {paragraphs.map((p: string, idx: number) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Topic Details (1 col) */}
          <div className="lg:col-span-1 bg-[#FBFBFF] border border-slate-200/80 rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Sliders className="w-5 h-5 text-[#5B50F5]" />
              <span>Topic Details</span>
            </div>

            <div className="space-y-4 pt-1">
              {/* Item 1: Topic Family */}
              <div className="flex items-start gap-3">
                <Layers className="w-4 h-4 text-[#5B50F5] mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Topic Family</p>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.topic_family_name}
                      onChange={e => setEditForm({ ...editForm, topic_family_name: e.target.value })}
                      placeholder="e.g. Space Exploration"
                      className="mt-1 w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {topicFamily}
                    </p>
                  )}
                </div>
              </div>

              {/* Item 2: Learner Age Range */}
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-[#5B50F5] mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Learner Age Range</p>
                  {editing ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="number"
                        min="1"
                        max="18"
                        value={editForm.age_min}
                        onChange={e => setEditForm({ ...editForm, age_min: parseInt(e.target.value) || 0 })}
                        className="w-16 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                      />
                      <span className="text-slate-400 text-sm">–</span>
                      <input
                        type="number"
                        min="1"
                        max="18"
                        value={editForm.age_max}
                        onChange={e => setEditForm({ ...editForm, age_max: parseInt(e.target.value) || 0 })}
                        className="w-16 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                      />
                      <span className="text-xs text-slate-400">years</span>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {topic.age_min ?? 5} – {topic.age_max ?? 7} years
                    </p>
                  )}
                </div>
              </div>

              {/* Item 3: Country / Context */}
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-[#5B50F5] mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Country / Context</p>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.country_context}
                      onChange={e => setEditForm({ ...editForm, country_context: e.target.value })}
                      placeholder="e.g. USA, Universal"
                      className="mt-1 w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {topic.country_context || "USA"}
                    </p>
                  )}
                </div>
              </div>

              {/* Item 4: Activity Potential */}
              <div className="flex items-start gap-3">
                <Zap className="w-4 h-4 text-[#5B50F5] mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Activity Potential</p>
                  {editing ? (
                    <select
                      value={editForm.activity_potential}
                      onChange={e => setEditForm({ ...editForm, activity_potential: e.target.value })}
                      className="mt-1 w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                    >
                      <option value="HIGH">HIGH</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="LOW">LOW</option>
                    </select>
                  ) : (
                    <div className="mt-1">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                        {topic.activity_potential || "HIGH"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Item 5: Keywords */}
              <div className="flex items-start gap-3">
                <Tag className="w-4 h-4 text-[#5B50F5] mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 font-medium">Keywords</p>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.keywordsInput}
                      onChange={e => setEditForm({ ...editForm, keywordsInput: e.target.value })}
                      placeholder="Comma separated, e.g. Space, Rover"
                      className="mt-1 w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5B50F5]"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {keywords.length > 0 ? (
                        keywords.map(kw => (
                          <span
                            key={kw}
                            className="px-2.5 py-1 bg-[#EEF0FF] text-[#5B50F5] rounded-full text-xs font-medium"
                          >
                            {kw}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">No keywords</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Update/Cancel button in edit mode */}
        {editing && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold rounded-xl text-sm transition-colors shadow-xs disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={saving}
              className="px-6 py-2.5 bg-[#5B50F5] hover:bg-[#4740d4] text-white font-semibold rounded-xl text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? "Updating..." : "Update Topic"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
