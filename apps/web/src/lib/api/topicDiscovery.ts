/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { API_BASE_URL } from "@/lib/apiBase";

export interface TopicDiscoveryRequest {
  keywords: string[];

  age_min: number;
  age_max: number;
  target_class?: string;
  country_context?: string;
  requested_count: number;
}

export interface TopicCandidate {
  topic: string;
  short_description: string;
  full_description: string;
  activity_potential: string;
  age_suitability: string;

  keywords: string[];
}

export interface TopicDiscoveryResult {
  session_id: string;
  candidates: TopicCandidate[];
  research_sources: any[];
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
