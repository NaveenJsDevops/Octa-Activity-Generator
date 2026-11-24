"use client";

import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/apiBase";

interface ActivityEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityData: any; // Activity or Concept
  onSaveSuccess: () => void;
  isTemporaryConcept?: boolean;
  sessionId?: string;
  conceptId?: string;
}

export default function ActivityEditModal({
  isOpen,
  onClose,
  activityData,
  onSaveSuccess,
  isTemporaryConcept = false,
  sessionId,
  conceptId,
}: ActivityEditModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "pre" | "main" | "post" | "metadata" | "taxonomy">("general");
  const [formData, setFormData] = useState<any>({});
  const [materialsText, setMaterialsText] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [warmupsText, setWarmupsText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [reflectionText, setReflectionText] = useState("");
  const [extendLearningText, setExtendLearningText] = useState("");
  const [userSkillsText, setUserSkillsText] = useState("");
  const [userSubSkillsText, setUserSubSkillsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activityData && isOpen) {
      const act = activityData.activity || activityData;
      const pre = act.pre_activity || {};
      const main = act.main_activity || {};
      const post = act.post_activity || {};

      setFormData({
        activity_name: act.activity_name || act.title || act.activity_title || "",
        activity_duration: act.activity_duration || "30 minutes",
        estimated_duration: act.estimated_duration ?? 30,
        age_min: act.age_min ?? 10,
        age_max: act.age_max ?? 12,
        target_class: act.target_class || "Grade 6",
        country_context: act.country_context || "India",
        topic_family_name: act.topic_family_name || "General",
        difficulty_level: act.difficulty_level || "Intermediate",
        learning_objective: act.learning_objective || "",
        assessment_criteria: act.assessment_criteria || "",
        user_selected_intelligence: act.user_selected_intelligence || "",
        suggested_intelligence: act.suggested_intelligence || "",
        // Pre-activity
        pre_description: pre.activity_description || act.description || "",
        parents_note: pre.parents_note || "",
        parents_guide: pre.parents_guide || "",
        why_important: pre.why_how_is_this_important || "",
        lets_get_started: pre.lets_get_started || "",
        // Main activity
        task_title: main.activity_step_task_title || "",
        scenario: main.scenario_real_life_connection || "",
        // Post activity
        whats_next: post.whats_next || "",
        how_to_improvise: post.how_to_improvise_or_level_up || "",
        post_summary: post.post_activity_summary || act.expected_output || "",
      });

      // Format materials
      const mats = Array.isArray(act.materials)
        ? act.materials.join(", ")
        : typeof act.materials === "string"
        ? act.materials
        : "";
      setMaterialsText(mats);

      // Keywords
      const kws = Array.isArray(act.keywords)
        ? act.keywords.join(", ")
        : typeof act.keywords === "string"
        ? act.keywords
        : "";
      setKeywordsText(kws);

      // Warmups
      const wList = Array.isArray(pre.pre_activity_engagement)
        ? pre.pre_activity_engagement.join("\n")
        : "";
      setWarmupsText(wList);

      // Steps
      const sList = Array.isArray(main.in_depth_description_and_process)
        ? main.in_depth_description_and_process.join("\n")
        : typeof act.instructions === "string"
        ? act.instructions
        : "";
      setStepsText(sList);

      // Reflection
      const rList = Array.isArray(main.reflection_questions)
        ? main.reflection_questions.join("\n")
        : "";
      setReflectionText(rList);

      // Extend learning
      const eList = Array.isArray(post.extend_the_learning)
        ? post.extend_the_learning.join("\n")
        : "";
      setExtendLearningText(eList);

      // Skills
      const uSkills = Array.isArray(act.user_selected_skills)
        ? act.user_selected_skills.join(", ")
        : "";
      setUserSkillsText(uSkills);

      const uSub = Array.isArray(act.user_selected_sub_skills)
        ? act.user_selected_sub_skills.join(", ")
        : "";
      setUserSubSkillsText(uSub);

      setError(null);
    }
  }, [activityData, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const act = activityData.activity || activityData;
    const actId = act.activity_id;

    try {
      const parsedMaterials = materialsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedKeywords = keywordsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedWarmups = warmupsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedSteps = stepsText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedReflection = reflectionText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedExtend = extendLearningText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedUserSkills = userSkillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const parsedUserSubSkills = userSubSkillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const preActivityPayload = {
        activity_description: formData.pre_description,
        parents_note: formData.parents_note,
        parents_guide: formData.parents_guide,
        pre_activity_engagement: parsedWarmups,
        why_how_is_this_important: formData.why_important,
        lets_get_started: formData.lets_get_started,
      };

      const mainActivityPayload = {
        activity_step_task_title: formData.task_title,
        scenario_real_life_connection: formData.scenario,
        in_depth_description_and_process: parsedSteps,
        reflection_questions: parsedReflection,
      };

      const postActivityPayload = {
        whats_next: formData.whats_next,
        extend_the_learning: parsedExtend,
        how_to_improvise_or_level_up: formData.how_to_improvise,
        post_activity_summary: formData.post_summary,
      };

      if (isTemporaryConcept && sessionId && conceptId) {
        // Edit temporary ideation concept
        const patchPayload = {
          activity_title: formData.activity_name,
          activity_name: formData.activity_name,
          estimated_duration: Number(formData.estimated_duration),
          activity_duration: formData.activity_duration,
          age_min: Number(formData.age_min),
          age_max: Number(formData.age_max),
          target_class: formData.target_class,
          topic_family_name: formData.topic_family_name,
          country_context: formData.country_context,
          learning_objective: formData.learning_objective,
          materials: parsedMaterials,
          assessment_criteria: formData.assessment_criteria,
          difficulty_level: formData.difficulty_level,
          pre_activity: preActivityPayload,
          main_activity: mainActivityPayload,
          post_activity: postActivityPayload,
        };

        const res = await fetch(
          `${API_BASE_URL}/api/activity-ideation/sessions/${sessionId}/concepts/${conceptId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchPayload),
          }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to update concept: ${text}`);
        }
      } else {
        // Edit approved activity in library
        const updatePayload = {
          activity_name: formData.activity_name,
          title: formData.activity_name,
          activity_duration: formData.activity_duration,
          estimated_duration: Number(formData.estimated_duration),
          age_min: Number(formData.age_min),
          age_max: Number(formData.age_max),
          target_class: formData.target_class,
          country_context: formData.country_context,
          topic_family_name: formData.topic_family_name,
          difficulty_level: formData.difficulty_level,
          learning_objective: formData.learning_objective,
          assessment_criteria: formData.assessment_criteria,
          materials: parsedMaterials,
          keywords: parsedKeywords,
          user_selected_intelligence: formData.user_selected_intelligence,
          user_selected_skills: parsedUserSkills,
          user_selected_sub_skills: parsedUserSubSkills,
          pre_activity: preActivityPayload,
          main_activity: mainActivityPayload,
          post_activity: postActivityPayload,
        };

        const res = await fetch(`${API_BASE_URL}/api/activities/${actId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to update activity: ${text}`);
        }
      }

      onSaveSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !activityData) return null;
  const act = activityData.activity || activityData;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {isTemporaryConcept ? "Edit Activity Concept" : "Edit Complete Activity Specification"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                ID: {act.activity_id || act.concept_id || "New Concept"}
              </p>
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

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-100 bg-white overflow-x-auto">
          {[
            { id: "general", label: "1. Overview & Setup" },
            { id: "pre", label: "2. Pre-Activity" },
            { id: "main", label: "3. Main Steps" },
            { id: "post", label: "4. Post-Activity" },
            { id: "metadata", label: "5. Educational Metadata" },
            { id: "taxonomy", label: "6. Taxonomy & Skills" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all ${
                activeTab === tab.id
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
              <span className="text-rose-600 font-bold">⚠</span> {error}
            </div>
          )}

          {/* TAB 1: GENERAL */}
          {activeTab === "general" && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Activity Name / Title *</label>
                <input
                  type="text"
                  required
                  value={formData.activity_name || ""}
                  onChange={(e) => setFormData({ ...formData, activity_name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration Text</label>
                  <input
                    type="text"
                    value={formData.activity_duration || ""}
                    onChange={(e) => setFormData({ ...formData, activity_duration: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. 30 minutes"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={formData.estimated_duration ?? 30}
                    onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Difficulty Level</label>
                  <select
                    value={formData.difficulty_level || "Intermediate"}
                    onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Age</label>
                  <input
                    type="number"
                    min={3}
                    max={18}
                    value={formData.age_min ?? 10}
                    onChange={(e) => setFormData({ ...formData, age_min: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Target Class / Grade</label>
                  <input
                    type="text"
                    value={formData.target_class || ""}
                    onChange={(e) => setFormData({ ...formData, target_class: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. Grade 6"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Country Context</label>
                  <input
                    type="text"
                    value={formData.country_context || ""}
                    onChange={(e) => setFormData({ ...formData, country_context: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. India"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Keywords (Comma-separated)</label>
                <input
                  type="text"
                  value={keywordsText}
                  onChange={(e) => setKeywordsText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. English, Analysis, Dialect, India"
                />
              </div>
            </div>
          )}

          {/* TAB 2: PRE-ACTIVITY */}
          {activeTab === "pre" && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Activity Hook / Description *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.pre_description || ""}
                  onChange={(e) => setFormData({ ...formData, pre_description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parent's Note</label>
                  <textarea
                    rows={2}
                    value={formData.parents_note || ""}
                    onChange={(e) => setFormData({ ...formData, parents_note: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Preparation guidelines for parents"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Parent's Guide</label>
                  <textarea
                    rows={2}
                    value={formData.parents_guide || ""}
                    onChange={(e) => setFormData({ ...formData, parents_guide: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Adult supervision required / not required"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pre-Activity Engagement / Warmup Prompts (One per line)
                </label>
                <textarea
                  rows={3}
                  value={warmupsText}
                  onChange={(e) => setWarmupsText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xs"
                  placeholder="e.g. Can you say 'the quick brown fox' in three different accents?&#10;Why do people have different accents?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Why/How is this Important?</label>
                  <textarea
                    rows={2}
                    value={formData.why_important || ""}
                    onChange={(e) => setFormData({ ...formData, why_important: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Let's Get Started (Call to action)</label>
                  <textarea
                    rows={2}
                    value={formData.lets_get_started || ""}
                    onChange={(e) => setFormData({ ...formData, lets_get_started: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MAIN ACTIVITY */}
          {activeTab === "main" && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Activity Step Task Title *</label>
                <input
                  type="text"
                  required
                  value={formData.task_title || ""}
                  onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Scenario / Real-Life Connection</label>
                <textarea
                  rows={2}
                  value={formData.scenario || ""}
                  onChange={(e) => setFormData({ ...formData, scenario: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Real-life situation connecting to this activity"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  In-Depth Description &amp; Process Steps (One step per line) *
                </label>
                <textarea
                  rows={6}
                  required
                  value={stepsText}
                  onChange={(e) => setStepsText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xs"
                  placeholder="Step 1: Contact 2-3 adults...&#10;Step 2: Listen to recordings...&#10;Step 3: Create a comparison table..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reflection Questions (One question per line)
                </label>
                <textarea
                  rows={3}
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xs"
                  placeholder="Did you notice vowel sounds that changed?&#10;How does listening improve communication?"
                />
              </div>
            </div>
          )}

          {/* TAB 4: POST-ACTIVITY */}
          {activeTab === "post" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">What's Next?</label>
                  <textarea
                    rows={3}
                    value={formData.whats_next || ""}
                    onChange={(e) => setFormData({ ...formData, whats_next: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">How to Improvise / Level Up</label>
                  <textarea
                    rows={3}
                    value={formData.how_to_improvise || ""}
                    onChange={(e) => setFormData({ ...formData, how_to_improvise: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Extend the Learning (One challenge per line)
                </label>
                <textarea
                  rows={3}
                  value={extendLearningText}
                  onChange={(e) => setExtendLearningText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xs"
                  placeholder="Research historical origins...&#10;Record a mock dialect podcast..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Post-Activity Summary *</label>
                <textarea
                  rows={3}
                  required
                  value={formData.post_summary || ""}
                  onChange={(e) => setFormData({ ...formData, post_summary: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          )}

          {/* TAB 5: EDUCATIONAL METADATA */}
          {activeTab === "metadata" && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Learning Objective *</label>
                <textarea
                  rows={2}
                  value={formData.learning_objective || ""}
                  onChange={(e) => setFormData({ ...formData, learning_objective: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Students identify and analyze regional variations..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Materials Required (Comma-separated)</label>
                <textarea
                  rows={2}
                  value={materialsText}
                  onChange={(e) => setMaterialsText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Recording device, Notebook, Pen, Map"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Assessment Criteria</label>
                <textarea
                  rows={2}
                  value={formData.assessment_criteria || ""}
                  onChange={(e) => setFormData({ ...formData, assessment_criteria: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Evaluated through precision of phonetic notes..."
                />
              </div>
            </div>
          )}

          {/* TAB 6: TAXONOMY & SKILLS */}
          {activeTab === "taxonomy" && (
            <div className="space-y-4 animate-fadeIn">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">User Selected Intelligence</label>
                <input
                  type="text"
                  value={formData.user_selected_intelligence || ""}
                  onChange={(e) => setFormData({ ...formData, user_selected_intelligence: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Communicative"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">User Selected Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={userSkillsText}
                  onChange={(e) => setUserSkillsText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Active Expression, Oral Analysis, Critical Thinking"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">User Selected Sub-Skills (Comma-separated)</label>
                <input
                  type="text"
                  value={userSubSkillsText}
                  onChange={(e) => setUserSubSkillsText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g. Adapting Idioms, Graphing and Charting, Idioms"
                />
              </div>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-400">All modifications are version-tracked automatically.</span>
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
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
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
