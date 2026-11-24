/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { API_BASE_URL } from "@/lib/apiBase";

export interface TopicDiscoveryRequest {
  keywords: string[];
  age_min: number;
  age_max: number;
  target_class?: string;
  country_context?: string;
  topic_family_id?: string;
  intelligence_id?: string;
  intelligence_name?: string;
  skill_id?: string;
  skill_name?: string;
  sub_skill_id?: string;
  sub_skill_name?: string;
  requested_count: number;
}

export interface TopicCandidate {
  topic: string;
  short_description: string;
  full_description: string;
  activity_potential: string;
  age_suitability: string;
  keywords: string[];
  suggested_intelligence?: string;
  suggested_skills?: string[];
  suggested_sub_skills?: string[];
  user_selected_intelligence?: string;
  user_selected_skills?: string[];
  user_selected_sub_skills?: string[];
}

export interface TopicDiscoveryResult {
  session_id: string;
  candidates: TopicCandidate[];
  research_sources: any[];
  user_selections?: {
    intelligence_id?: string;
    intelligence_name?: string;
    skill_id?: string;
    skill_name?: string;
    sub_skill_id?: string;
    sub_skill_name?: string;
  };
}

export async function discoverTopics(request: TopicDiscoveryRequest): Promise<TopicDiscoveryResult> {
  const res = await fetch(`${API_BASE_URL}/api/topics/discover`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    let errorMsg = "Failed to discover topics";
    try {
      const errData = await res.json();
      errorMsg = errData.detail || errorMsg;
    } catch (e) {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return await res.json();
}

export async function keepCandidate(sessionId: string, index: number): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/topics/discovery/${sessionId}/keep/${index}`, {
    method: "POST"
  });
  if (!res.ok) {
    let errorMsg = "Failed to keep topic";
    try {
      const errData = await res.json();
      errorMsg = errData.detail || errorMsg;
    } catch(e) {}
    throw new Error(errorMsg);
  }
  return await res.json();
}

export async function editCandidate(
  sessionId: string,
  index: number,
  updates: { topic?: string; short_description?: string; full_description?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/topics/discovery/${sessionId}/candidate/${index}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    let errorMsg = "Failed to update candidate";
    try {
      const errData = await res.json();
      errorMsg = errData.detail || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }
  return await res.json();
}

export async function rejectCandidate(sessionId: string, index: number): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/topics/discovery/${sessionId}/reject/${index}`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to reject topic");
  return await res.json();
}

export async function keepAllCandidates(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/topics/discovery/${sessionId}/keep-all`, {
    method: "POST"
  });
  if (!res.ok) throw new Error("Failed to keep all topics");
  return await res.json();
}
