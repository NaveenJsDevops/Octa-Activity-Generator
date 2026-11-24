"use client";

import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/apiBase";

interface TopicEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: any;
  onSaveSuccess: () => void;
}

export default function TopicEditModal({
  isOpen,
  onClose,
  topic,
  onSaveSuccess,
}: TopicEditModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [keywordsText, setKeywordsText] = useState("");
  const [userSkillsText, setUserSkillsText] = useState("");
  const [userSubSkillsText, setUserSubSkillsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (topic && isOpen) {
      setFormData({
        topic: topic.topic || "",
        topic_hook: topic.topic_hook || topic.short_description || "",
        topic_family_id: topic.topic_family_id || "FAM-HUMAN",
        age_min: topic.age_min ?? 10,
        age_max: topic.age_max ?? 12,
        target_class: topic.target_class || "Grade 6",
        country_context: topic.country_context || "India",
        activity_potential: topic.activity_potential || "HIGH",
        user_selected_intelligence: topic.user_selected_intelligence || "",
        suggested_intelligence: topic.suggested_intelligence || "",
        status: topic.status || "APPROVED",
      });

      const kws = Array.isArray(topic.keywords)
        ? topic.keywords.join(", ")
        : typeof topic.keywords === "string"
        ? topic.keywords
        : "";
      setKeywordsText(kws);

      const uSkills = Array.isArray(topic.user_selected_skills)
        ? topic.user_selected_skills.join(", ")
        : typeof topic.user_selected_skills === "string"
        ? topic.user_selected_skills
        : "";
      setUserSkillsText(uSkills);

      const uSub = Array.isArray(topic.user_selected_sub_skills)
        ? topic.user_selected_sub_skills.join(", ")
        : typeof topic.user_selected_sub_skills === "string"
        ? topic.user_selected_sub_skills
        : "";
      setUserSubSkillsText(uSub);

      setError(null);
    }
  }, [topic, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic?.topic_id) return;

    setSaving(true);
    setError(null);

    try {
      const keywordsArray = keywordsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const userSkillsArray = userSkillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const userSubSkillsArray = userSubSkillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        topic: formData.topic,
        topic_hook: formData.topic_hook,
        short_description: formData.topic_hook,
        topic_family_id: formData.topic_family_id,
        age_min: Number(formData.age_min),
        age_max: Number(formData.age_max),
        target_class: formData.target_class,
        country_context: formData.country_context,
        activity_potential: formData.activity_potential,
        user_selected_intelligence: formData.user_selected_intelligence,
        user_selected_skills: userSkillsArray,
        user_selected_sub_skills: userSubSkillsArray,
        keywords: keywordsArray,
      };

      const res = await fetch(`${API_BASE_URL}/api/topics/${topic.topic_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to update topic: ${text}`);
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !topic) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Edit Topic Parameters</h3>
              <p className="text-xs text-slate-500 font-medium">Topic ID: {topic.topic_id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
              <span className="text-rose-600 font-bold">⚠</span> {error}
            </div>
          )}

          {/* Section 1: Core Details */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">1. Basic Information</h4>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Topic Title *</label>
              <input
                type="text"
                required
                value={formData.topic || ""}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Topic Hook / Short Description *</label>
              <textarea
                rows={3}
                required
                value={formData.topic_hook || ""}
                onChange={(e) => setFormData({ ...formData, topic_hook: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Topic Family</label>
                <select
                  value={formData.topic_family_id || "FAM-HUMAN"}
                  onChange={(e) => setFormData({ ...formData, topic_family_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="FAM-HUMAN">Human &amp; Society</option>
                  <option value="FAM-NATURE">Nature &amp; Environment</option>
                  <option value="FAM-SCIENCE">Science &amp; Technology</option>
                  <option value="FAM-ARTS">Arts &amp; Culture</option>
                  <option value="FAM-SPACE">Space &amp; Universe</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Activity Potential</label>
                <select
                  value={formData.activity_potential || "HIGH"}
                  onChange={(e) => setFormData({ ...formData, activity_potential: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="HIGH">High Potential</option>
                  <option value="MEDIUM">Medium Potential</option>
                  <option value="LOW">Low Potential</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Audience & Demographics */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">2. Age, Grade &amp; Regional Context</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Min Age</label>
                <input
                  type="number"
                  min={3}
                  max={18}
                  value={formData.age_min ?? 10}
                  onChange={(e) => setFormData({ ...formData, age_min: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Max Age</label>
                <input
                  type="number"
                  min={3}
                  max={18}
                  value={formData.age_max ?? 12}
                  onChange={(e) => setFormData({ ...formData, age_max: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Target Class / Grade</label>
                <input
                  type="text"
                  value={formData.target_class || ""}
                  onChange={(e) => setFormData({ ...formData, target_class: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Grade 6"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Country Context</label>
                <input
                  type="text"
                  value={formData.country_context || ""}
                  onChange={(e) => setFormData({ ...formData, country_context: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. India"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Intelligence & Skills Mapping */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">3. Intelligence &amp; Skills Taxonomy</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Intelligence Focus</label>
                <input
                  type="text"
                  value={formData.user_selected_intelligence || ""}
                  onChange={(e) => setFormData({ ...formData, user_selected_intelligence: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Communicative"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keywords (Comma-separated)</label>
                <input
                  type="text"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. English, Analysis, Dialect, India"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Skills (Comma-separated)</label>
              <input
                type="text"
                value={userSkillsText}
                onChange={(e) => setUserSkillsText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Active Expression, Oral Analysis, Critical Thinking"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Skills (Comma-separated)</label>
              <input
                type="text"
                value={userSubSkillsText}
                onChange={(e) => setUserSubSkillsText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Adapting Idioms, Graphing and Charting, Idioms"
              />
            </div>
          </div>

          {/* Footer inside form */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">Saving creates an automatic snapshot in version history.</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  "Save & Track Version"
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
