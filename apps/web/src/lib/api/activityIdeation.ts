import { API_BASE_URL } from "@/lib/apiBase";

export interface TopicDetail {
  topic: {
    topic_id: string;
    topic: string;
    short_description?: string;
    full_description?: string;
    age_min: number;
    age_max: number;
    target_class?: string;
    country_context?: string;
    status: string;
  };
  topic_family_name: string;
  keywords: string[];
  skills: Array<{
    skill_id: string;
    skill_name: string;
    sub_skill_id: string;
    sub_skill_name: string;
  }>;
}

export interface PreActivity {
  activity_description: string;
  parents_note: string;
  parents_guide: string | null;
  pre_activity_engagement: string[];
  why_how_is_this_important: string;
  lets_get_started: string;
}

export interface MainActivity {
  activity_step_task_title: string;
  scenario_real_life_connection: string | null;
  in_depth_description_and_process: string[];
  reflection_questions: string[];
}

export interface PostActivity {
  whats_next: string;
  extend_the_learning: string[];
  how_to_improvise_or_level_up: string;
  post_activity_summary: string;
}

export interface ActivityConcept {
  concept_id: string;
  topic_id: string;
  topic_title?: string;
  activity_title: string;
  activity_type_id: string;
  activity_concept: string;
  learner_task: string;
  expected_output: string;
  primary_skill_id?: string | null;
  primary_sub_skill_id?: string | null;
  why_engaging?: string;
  status: string;
  created_at: string;
  generation_id?: string | null;
  learning_objective?: string;
  materials: string[];
  instructions: string[];
  assessment_criteria?: string;
  estimated_duration?: number;
  difficulty_level?: string;
  age_min?: number;
  age_max?: number;
  target_class?: string;
  activity_name?: string;
  activity_duration?: string;
  pre_activity?: PreActivity | null;
  main_activity?: MainActivity | null;
  post_activity?: PostActivity | null;
}

export interface ActivityIdeationResult {
  topic_id: string;
  session_id: string;
  generated_count: number;
  accepted_count: number;
  duplicate_count: number;
  rejected_count: number;
  concepts: ActivityConcept[];
  rejected_candidates: Array<{ candidate: unknown; reason: string }>;
}

export interface ActivityRecord {
  activity_id: string;
  concept_id: string;
  topic_id: string;
  title: string;
  description: string;
  instructions: string;
  expected_output: string;
  age_min: number;
  age_max: number;
  estimated_duration: number;
  status: string;
  created_at: string;
  updated_at: string;
  learning_objective?: string;
  target_class?: string;
  materials: string[];
  assessment_criteria?: string;
  difficulty_level?: string;
  activity_type_id?: string;
  activity_name?: string | null;
  activity_duration?: string | null;
  pre_activity?: PreActivity | null;
  main_activity?: MainActivity | null;
  post_activity?: PostActivity | null;
}

export interface ActivityLibraryItem {
  activity: ActivityRecord;
  topic_title: string;
  skills: Array<{
    skill_id: string;
    skill_name?: string;
    sub_skill_id: string;
    sub_skill_name?: string;
  }>;
}

async function responseError(res: Response, fallback: string): Promise<Error> {
  const data = await res.json().catch(() => null);
  const detail = typeof data?.detail === "string" ? data.detail : null;
  return new Error(detail || `${fallback} (${res.status})`);
}

export async function getApprovedTopics(search = ""): Promise<TopicDetail[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/topics?${params}`);
  if (!res.ok) throw await responseError(res, "Failed to fetch approved topics");
  const data = await res.json();
  return data.topics;
}

export async function getConcepts(topicId: string, status?: string): Promise<ActivityConcept[]> {
  const params = new URLSearchParams({ topic_id: topicId });
  if (status) params.set("status", status);
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/concepts?${params}`);
  if (!res.ok) throw await responseError(res, "Failed to fetch concepts");
  return res.json();
}

export async function selectConcept(conceptId: string): Promise<ActivityConcept> {
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/concepts/${conceptId}/select`, {
    method: "POST",
  });
  if (!res.ok) throw await responseError(res, "Failed to select the saved concept");
  return res.json();
}

export async function generateIdeas(topicId: string, requestedCount = 5): Promise<ActivityIdeationResult> {
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic_id: topicId, requested_count: requestedCount }),
  });
  if (!res.ok) throw await responseError(res, "Activity generation failed");
  return res.json();
}

export async function getReviewSession(sessionId: string): Promise<ActivityIdeationResult> {
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/sessions/${sessionId}`);
  if (!res.ok) throw await responseError(res, "Failed to restore the activity review session");
  return res.json();
}

export async function updateConcept(
  sessionId: string,
  conceptId: string,
  updates: Partial<ActivityConcept>,
): Promise<ActivityConcept> {
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/sessions/${sessionId}/concepts/${conceptId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw await responseError(res, "Failed to save activity changes");
  return res.json();
}

export async function regenerateConcept(sessionId: string, conceptId: string): Promise<ActivityConcept> {
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/sessions/${sessionId}/concepts/${conceptId}/regenerate`, {
    method: "POST",
  });
  if (!res.ok) throw await responseError(res, "Failed to regenerate activity");
  return res.json();
}

export async function approveConcept(sessionId: string, conceptId: string): Promise<ActivityConcept> {
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/sessions/${sessionId}/concepts/${conceptId}/approve`, {
    method: "POST",
  });
  if (!res.ok) throw await responseError(res, "Failed to approve activity");
  return res.json();
}

export async function rejectConcept(sessionId: string, conceptId: string): Promise<ActivityConcept> {
  const res = await fetch(`${API_BASE_URL}/api/activity-ideation/sessions/${sessionId}/concepts/${conceptId}/reject`, {
    method: "POST",
  });
  if (!res.ok) throw await responseError(res, "Failed to reject activity");
  return res.json();
}

export async function getActivities(search = "", topicId = ""): Promise<ActivityLibraryItem[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  if (topicId) params.set("topic_id", topicId);
  const res = await fetch(`${API_BASE_URL}/api/activities?${params}`);
  if (!res.ok) throw await responseError(res, "Failed to fetch activity library");
  return res.json();
}
