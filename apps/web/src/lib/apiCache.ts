/**
 * Module-level cache for infrequently-changing API data.
 *
 * Features:
 * - TTL-based cache (5 minutes) — only fetches once per session
 * - In-flight deduplication — concurrent calls share one pending Promise
 * - Error isolation — a failed AI call does not affect topic/other calls
 */

import { API_BASE_URL } from "@/lib/apiBase";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE = new Map<string, CacheEntry<unknown>>();
// In-flight promise deduplication — prevents double-fetch on concurrent calls
const IN_FLIGHT = new Map<string, Promise<unknown>>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

async function cachedFetch<T>(key: string, url: string): Promise<T> {
  const now = Date.now();

  // Return cached value if still fresh
  const entry = CACHE.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) {
    return entry.data;
  }

  // If a fetch for this key is already in flight, reuse that promise
  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key) as Promise<T>;
  }

  // Start a new fetch and register it as in-flight
  const promise = fetch(url)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      const data: T = await res.json();
      CACHE.set(key, { data, expiresAt: Date.now() + TTL_MS });
      return data;
    })
    .finally(() => {
      IN_FLIGHT.delete(key);
    });

  IN_FLIGHT.set(key, promise);
  return promise as Promise<T>;
}

/** Force a fresh fetch next time (e.g., after a user-initiated change). */
export function invalidateCache(key: string) {
  CACHE.delete(key);
  IN_FLIGHT.delete(key);
}

// ─── Typed helpers ───────────────────────────────────────────────────────────

export interface HealthData {
  status: string;
  ai?: { configured: boolean };
}

export interface AiSettings {
  model: string;
  provider: string;
  temperature: number;
  max_tokens: number;
}

/** Health endpoint — used only to determine if AI is configured. */
export function fetchHealth(): Promise<HealthData> {
  return cachedFetch<HealthData>("health", `${API_BASE_URL}/api/health`);
}

/** AI settings — model name, provider, etc. */
export function fetchAiSettings(): Promise<AiSettings> {
  return cachedFetch<AiSettings>("ai_settings", `${API_BASE_URL}/api/settings/ai`);
}

/** Available model list for the model switcher. */
export function fetchAiModels(): Promise<{ models: string[] }> {
  return cachedFetch<{ models: string[] }>("ai_models", `${API_BASE_URL}/api/settings/ai/models`);
}

export interface MasterIntelligence {
  intelligence_id: string;
  name: string;
  description?: string | null;
}

export interface MasterSkill {
  skill_id: string;
  intelligence_id: string;
  name: string;
  description?: string | null;
}

export interface MasterSubSkill {
  sub_skill_id: string;
  skill_id: string;
  name: string;
  description?: string | null;
}

export interface MasterTopicFamily {
  topic_family_id: string;
  name: string;
  description?: string | null;
}

export interface MasterDataResponse {
  topicFamilies: MasterTopicFamily[];
  intelligences: MasterIntelligence[];
  skills: MasterSkill[];
  subSkills: MasterSubSkill[];
}

export const DEFAULT_INTELLIGENCES: MasterIntelligence[] = [
  {
    intelligence_id: "INT-AT",
    name: "Artistic",
    description: "Visual arts, craftsmanship, styling, and aesthetic expression",
  },
  {
    intelligence_id: "INT-AR",
    name: "Arithmetic",
    description: "Data analysis, financial literacy, calculations, and mathematical thinking",
  },
  {
    intelligence_id: "INT-CM",
    name: "Communication",
    description: "Listening, verbal storytelling, and written expression",
  },
  {
    intelligence_id: "INT-CO",
    name: "Cognitive",
    description: "Critical thinking, conceptualization, logical reasoning, and observation",
  },
  {
    intelligence_id: "INT-CR",
    name: "Creative",
    description: "Abstract thinking, curiosity, experimentation, and imaginative world-building",
  },
  {
    intelligence_id: "INT-EM",
    name: "Emotional",
    description: "Mindfulness, self-awareness, motivation, and emotional self-regulation",
  },
  {
    intelligence_id: "INT-EN",
    name: "Environmental",
    description: "Eco-awareness, conservation, ecosystems, and spatial environmental awareness",
  },
  {
    intelligence_id: "INT-SO",
    name: "Social",
    description: "Collaboration, leadership, empathy, conflict resolution, and trust-building",
  },
];

export const DEFAULT_SKILLS: MasterSkill[] = [
  // Artistic (INT-AT)
  { skill_id: "SK-AT01", intelligence_id: "INT-AT", name: "Artistic Expression", description: "Expressing ideas through diverse artistic styles and visual forms" },
  { skill_id: "SK-AT02", intelligence_id: "INT-AT", name: "Craftsmanship", description: "Technique, mastery of materials, and artwork analysis" },

  // Arithmetic (INT-AR)
  { skill_id: "SK-AR01", intelligence_id: "INT-AR", name: "Data Analysis", description: "Analyzing data, charts, probability, and statistics" },
  { skill_id: "SK-AR02", intelligence_id: "INT-AR", name: "Financial Literacy", description: "Budgeting, investing, savings, and financial concepts" },
  { skill_id: "SK-AR03", intelligence_id: "INT-AR", name: "Mathematical Thinking & Calculations", description: "Mental math, numerical problem-solving, and time management" },
  { skill_id: "SK-AR04", intelligence_id: "INT-AR", name: "Numerical Patterns", description: "Recognizing numerical patterns and sequences" },

  // Communication (INT-CM)
  { skill_id: "SK-CM01", intelligence_id: "INT-CM", name: "Listening", description: "Active listening, feedback mechanisms, and non-verbal cues" },
  { skill_id: "SK-CM02", intelligence_id: "INT-CM", name: "Verbal Expression", description: "Storytelling, spoken dialogue, and audience adaptation" },
  { skill_id: "SK-CM03", intelligence_id: "INT-CM", name: "Written Expression", description: "Structuring information, essay writing, and style comparison" },

  // Cognitive (INT-CO)
  { skill_id: "SK-CO01", intelligence_id: "INT-CO", name: "Conceptualization", description: "Abstract thinking, mind mapping, and divergence/convergence" },
  { skill_id: "SK-CO02", intelligence_id: "INT-CO", name: "Critical Thinking", description: "Analysis, bias detection, evaluation, questioning, and synthesis" },
  { skill_id: "SK-CO03", intelligence_id: "INT-CO", name: "Decision-Making", description: "Decision trees and risk assessment" },
  { skill_id: "SK-CO04", intelligence_id: "INT-CO", name: "Logical Reasoning", description: "Abductive reasoning, analogies, coding-decoding, and puzzles" },
  { skill_id: "SK-CO05", intelligence_id: "INT-CO", name: "Observation", description: "Comparing context, identifying similarities/differences, and pattern recognition" },
  { skill_id: "SK-CO06", intelligence_id: "INT-CO", name: "Systems Thinking", description: "Understanding interconnected systems and resource management" },

  // Creative (INT-CR)
  { skill_id: "SK-CR01", intelligence_id: "INT-CR", name: "Abstract Thinking", description: "Metaphorical, symbolic, and analogical reasoning" },
  { skill_id: "SK-CR02", intelligence_id: "INT-CR", name: "Adaptability", description: "Iterative thinking, perspective shifting, and strategic flexibility" },
  { skill_id: "SK-CR03", intelligence_id: "INT-CR", name: "Curiosity", description: "In-depth exploration and investigating anomalies" },
  { skill_id: "SK-CR04", intelligence_id: "INT-CR", name: "Experimentation", description: "Hypothesis testing, learning from mistakes, and prototyping" },
  { skill_id: "SK-CR05", intelligence_id: "INT-CR", name: "Exploration", description: "Conceptual mapping and cross-disciplinary inquiry" },
  { skill_id: "SK-CR06", intelligence_id: "INT-CR", name: "Imagination", description: "Idea generation, narrative thinking, and world-building" },
  { skill_id: "SK-CR07", intelligence_id: "INT-CR", name: "Lateral Thinking", description: "Divergent thinking, non-linear problem solving, and unconventional approaches" },

  // Emotional (INT-EM)
  { skill_id: "SK-EM01", intelligence_id: "INT-EM", name: "Mindfulness", description: "Mental clarity and present-moment awareness" },
  { skill_id: "SK-EM02", intelligence_id: "INT-EM", name: "Positive Reinforcement", description: "Celebrating achievements and recognition of effort" },
  { skill_id: "SK-EM03", intelligence_id: "INT-EM", name: "Self-Awareness", description: "Recognizing emotions, understanding triggers, and self-reflection" },
  { skill_id: "SK-EM04", intelligence_id: "INT-EM", name: "Self-Motivation", description: "Intrinsic motivation, focus, and overcoming obstacles" },
  { skill_id: "SK-EM05", intelligence_id: "INT-EM", name: "Self-Regulation", description: "Impulse control, stress management, and goal orientation" },

  // Environmental (INT-EN)
  { skill_id: "SK-EN01", intelligence_id: "INT-EN", name: "Eco-Awareness", description: "Biodiversity, ecosystems, sustainable resource management, and policy" },
  { skill_id: "SK-EN02", intelligence_id: "INT-EN", name: "Spatial Awareness", description: "Geospatial mapping, habitat changes, and land use" },

  // Social (INT-SO)
  { skill_id: "SK-SO01", intelligence_id: "INT-SO", name: "Collaboration", description: "Role distribution, shared goal setting, and teamwork strategies" },
  { skill_id: "SK-SO02", intelligence_id: "INT-SO", name: "Conflict Resolution", description: "Mediation, negotiation, and win-win solutions" },
  { skill_id: "SK-SO03", intelligence_id: "INT-SO", name: "Constructive Feedback", description: "Constructive criticism and growth-oriented feedback" },
  { skill_id: "SK-SO04", intelligence_id: "INT-SO", name: "Empathy", description: "Emotional sensitivity, perspective-taking, and understanding others" },
  { skill_id: "SK-SO05", intelligence_id: "INT-SO", name: "Group Dynamics", description: "Consensus building, team behavior, and team roles" },
  { skill_id: "SK-SO06", intelligence_id: "INT-SO", name: "Leadership", description: "Leading by example, leadership styles, and team coordination" },
  { skill_id: "SK-SO07", intelligence_id: "INT-SO", name: "Trust-Building", description: "Accountability, reliability, and consistency in actions" },
];

export const DEFAULT_SUBSKILLS: MasterSubSkill[] = [
  // Artistic (AT01 - AT08)
  { sub_skill_id: "AT01", skill_id: "SK-AT01", name: "Comparing Different Art Styles in Texts", description: null },
  { sub_skill_id: "AT02", skill_id: "SK-AT01", name: "Emotional Expression", description: null },
  { sub_skill_id: "AT03", skill_id: "SK-AT01", name: "Exploring Visual Art Techniques", description: null },
  { sub_skill_id: "AT04", skill_id: "SK-AT01", name: "Figurative Expression", description: null },
  { sub_skill_id: "AT05", skill_id: "SK-AT01", name: "Naturalistic Expression", description: null },
  { sub_skill_id: "AT06", skill_id: "SK-AT01", name: "Spatial Elemental Expressions", description: null },
  { sub_skill_id: "AT07", skill_id: "SK-AT01", name: "Surrealistic Expression", description: null },
  { sub_skill_id: "AT08", skill_id: "SK-AT02", name: "Analyzing Elements of Artwork", description: null },

  // Arithmetic (AR01 - AR09)
  { sub_skill_id: "AR01", skill_id: "SK-AR01", name: "Graphing and Charting", description: null },
  { sub_skill_id: "AR02", skill_id: "SK-AR01", name: "Probability & Statistics", description: null },
  { sub_skill_id: "AR03", skill_id: "SK-AR02", name: "Budgeting", description: null },
  { sub_skill_id: "AR04", skill_id: "SK-AR02", name: "Investing", description: null },
  { sub_skill_id: "AR05", skill_id: "SK-AR02", name: "Savings", description: null },
  { sub_skill_id: "AR06", skill_id: "SK-AR03", name: "Mental Math Strategies", description: null },
  { sub_skill_id: "AR07", skill_id: "SK-AR03", name: "Problem Solving with Numbers", description: null },
  { sub_skill_id: "AR08", skill_id: "SK-AR03", name: "Time Management & Scheduling", description: null },
  { sub_skill_id: "AR09", skill_id: "SK-AR04", name: "Recognizing Numerical Patterns & Sequences", description: null },

  // Communication (CM01 - CM15)
  { sub_skill_id: "CM01", skill_id: "SK-CM01", name: "Active Listening", description: null },
  { sub_skill_id: "CM02", skill_id: "SK-CM01", name: "Feedback Mechanisms", description: null },
  { sub_skill_id: "CM03", skill_id: "SK-CM01", name: "Non-Verbal Cues", description: null },
  { sub_skill_id: "CM04", skill_id: "SK-CM02", name: "Adapting Stories for Different Audiences", description: null },
  { sub_skill_id: "CM05", skill_id: "SK-CM02", name: "Expressing Emotion in Stories", description: null },
  { sub_skill_id: "CM06", skill_id: "SK-CM02", name: "Improvising a Story", description: null },
  { sub_skill_id: "CM07", skill_id: "SK-CM02", name: "Structuring a Story", description: null },
  { sub_skill_id: "CM08", skill_id: "SK-CM02", name: "Telling Engaging Stories", description: null },
  { sub_skill_id: "CM09", skill_id: "SK-CM02", name: "Using Dialogue Effectively", description: null },
  { sub_skill_id: "CM10", skill_id: "SK-CM03", name: "Comparing Different Writing Styles", description: null },
  { sub_skill_id: "CM11", skill_id: "SK-CM03", name: "Comparing Technical Language with Everyday Language", description: null },
  { sub_skill_id: "CM12", skill_id: "SK-CM03", name: "Organizing Information for Clarity", description: null },
  { sub_skill_id: "CM13", skill_id: "SK-CM03", name: "Simplifying Complex Ideas into Plain Language", description: null },
  { sub_skill_id: "CM14", skill_id: "SK-CM03", name: "Structuring Information Logically", description: null },
  { sub_skill_id: "CM15", skill_id: "SK-CM03", name: "Writing Clear and Organized Essays", description: null },

  // Cognitive (CO01 - CO22)
  { sub_skill_id: "CO01", skill_id: "SK-CO01", name: "Abstract vs Concrete Thinking", description: null },
  { sub_skill_id: "CO02", skill_id: "SK-CO01", name: "Divergence & Convergence", description: null },
  { sub_skill_id: "CO03", skill_id: "SK-CO01", name: "Mind Maps", description: null },
  { sub_skill_id: "CO04", skill_id: "SK-CO02", name: "Analysis", description: null },
  { sub_skill_id: "CO05", skill_id: "SK-CO02", name: "Biases", description: null },
  { sub_skill_id: "CO06", skill_id: "SK-CO02", name: "Evaluation", description: null },
  { sub_skill_id: "CO07", skill_id: "SK-CO02", name: "Questioning", description: null },
  { sub_skill_id: "CO08", skill_id: "SK-CO02", name: "Synthesis", description: null },
  { sub_skill_id: "CO09", skill_id: "SK-CO03", name: "Decision Trees", description: null },
  { sub_skill_id: "CO10", skill_id: "SK-CO03", name: "Risk Assessment", description: null },
  { sub_skill_id: "CO11", skill_id: "SK-CO04", name: "Abductive Reasoning", description: null },
  { sub_skill_id: "CO12", skill_id: "SK-CO04", name: "Analogies", description: null },
  { sub_skill_id: "CO13", skill_id: "SK-CO04", name: "Blood Relations", description: null },
  { sub_skill_id: "CO14", skill_id: "SK-CO04", name: "Cause & Effect", description: null },
  { sub_skill_id: "CO15", skill_id: "SK-CO04", name: "Coding-Decoding", description: null },
  { sub_skill_id: "CO16", skill_id: "SK-CO04", name: "Logical Diagrams & Puzzles", description: null },
  { sub_skill_id: "CO17", skill_id: "SK-CO04", name: "Problem-Solving Puzzles", description: null },
  { sub_skill_id: "CO18", skill_id: "SK-CO05", name: "Comparing Content & Context", description: null },
  { sub_skill_id: "CO19", skill_id: "SK-CO05", name: "Identifying Similarities & Differences", description: null },
  { sub_skill_id: "CO20", skill_id: "SK-CO05", name: "Pattern Recognition", description: null },
  { sub_skill_id: "CO21", skill_id: "SK-CO06", name: "Interconnected Systems", description: null },
  { sub_skill_id: "CO22", skill_id: "SK-CO06", name: "Resource Management", description: null },

  // Creative (CR01 - CR29)
  { sub_skill_id: "CR01", skill_id: "SK-CR01", name: "Abstract Problem-Solving", description: null },
  { sub_skill_id: "CR02", skill_id: "SK-CR01", name: "Analogical Thinking", description: null },
  { sub_skill_id: "CR03", skill_id: "SK-CR01", name: "Conceptual Differentiation", description: null },
  { sub_skill_id: "CR04", skill_id: "SK-CR01", name: "Metaphorical Reasoning", description: null },
  { sub_skill_id: "CR05", skill_id: "SK-CR01", name: "Symbolic Thinking", description: null },
  { sub_skill_id: "CR06", skill_id: "SK-CR02", name: "Iterative Thinking", description: null },
  { sub_skill_id: "CR07", skill_id: "SK-CR02", name: "Perspective Shifting", description: null },
  { sub_skill_id: "CR08", skill_id: "SK-CR02", name: "Problem-Solving Variability", description: null },
  { sub_skill_id: "CR09", skill_id: "SK-CR02", name: "Resilience in Creativity", description: null },
  { sub_skill_id: "CR10", skill_id: "SK-CR02", name: "Scenario Flexibility", description: null },
  { sub_skill_id: "CR11", skill_id: "SK-CR02", name: "Strategic Thinking", description: null },
  { sub_skill_id: "CR12", skill_id: "SK-CR03", name: "Exploring the Unknown", description: null },
  { sub_skill_id: "CR13", skill_id: "SK-CR03", name: "In-depth Exploration", description: null },
  { sub_skill_id: "CR14", skill_id: "SK-CR03", name: "Investigating Anomalies", description: null },
  { sub_skill_id: "CR15", skill_id: "SK-CR04", name: "Hypothesis Testing", description: null },
  { sub_skill_id: "CR16", skill_id: "SK-CR04", name: "Learning from Mistakes", description: null },
  { sub_skill_id: "CR17", skill_id: "SK-CR04", name: "Prototyping", description: null },
  { sub_skill_id: "CR18", skill_id: "SK-CR05", name: "Conceptual Mapping", description: null },
  { sub_skill_id: "CR19", skill_id: "SK-CR05", name: "Cross-Disciplinary Thinking", description: null },
  { sub_skill_id: "CR20", skill_id: "SK-CR05", name: "Unconventional Exploration", description: null },
  { sub_skill_id: "CR21", skill_id: "SK-CR06", name: "Alternative Thinking", description: null },
  { sub_skill_id: "CR22", skill_id: "SK-CR06", name: "Idea Generation", description: null },
  { sub_skill_id: "CR23", skill_id: "SK-CR06", name: "Practicing Narrative Thinking", description: null },
  { sub_skill_id: "CR24", skill_id: "SK-CR06", name: "Sensory Imagination", description: null },
  { sub_skill_id: "CR25", skill_id: "SK-CR06", name: "Speculative Thinking", description: null },
  { sub_skill_id: "CR26", skill_id: "SK-CR06", name: "World-Building", description: null },
  { sub_skill_id: "CR27", skill_id: "SK-CR07", name: "Divergent Thinking", description: null },
  { sub_skill_id: "CR28", skill_id: "SK-CR07", name: "Non-linear Problem Solving", description: null },
  { sub_skill_id: "CR29", skill_id: "SK-CR07", name: "Unconventional Approaches", description: null },

  // Emotional (EM01 - EM13)
  { sub_skill_id: "EM01", skill_id: "SK-EM01", name: "Mental Clarity", description: null },
  { sub_skill_id: "EM02", skill_id: "SK-EM01", name: "Present Moment Awareness", description: null },
  { sub_skill_id: "EM03", skill_id: "SK-EM02", name: "Celebrating Achievements", description: null },
  { sub_skill_id: "EM04", skill_id: "SK-EM02", name: "Recognition of Effort", description: null },
  { sub_skill_id: "EM05", skill_id: "SK-EM03", name: "Recognizing Emotions", description: null },
  { sub_skill_id: "EM06", skill_id: "SK-EM03", name: "Reflecting on Personal Experiences", description: null },
  { sub_skill_id: "EM07", skill_id: "SK-EM03", name: "Understanding Triggers", description: null },
  { sub_skill_id: "EM08", skill_id: "SK-EM04", name: "Intrinsic Motivation", description: null },
  { sub_skill_id: "EM09", skill_id: "SK-EM04", name: "Maintaining Focus", description: null },
  { sub_skill_id: "EM10", skill_id: "SK-EM04", name: "Overcoming Obstacles", description: null },
  { sub_skill_id: "EM11", skill_id: "SK-EM05", name: "Controlling Impulses", description: null },
  { sub_skill_id: "EM12", skill_id: "SK-EM05", name: "Goal-Oriented Behavior", description: null },
  { sub_skill_id: "EM13", skill_id: "SK-EM05", name: "Managing Stress", description: null },

  // Environmental (EN01 - EN11)
  { sub_skill_id: "EN01", skill_id: "SK-EN01", name: "Biodiversity and Conservation", description: null },
  { sub_skill_id: "EN02", skill_id: "SK-EN01", name: "Environmental Impact", description: null },
  { sub_skill_id: "EN03", skill_id: "SK-EN01", name: "Environmental Policy & Ethics", description: null },
  { sub_skill_id: "EN04", skill_id: "SK-EN01", name: "Interconnected Ecology", description: null },
  { sub_skill_id: "EN05", skill_id: "SK-EN01", name: "Sustainable Resource Management", description: null },
  { sub_skill_id: "EN06", skill_id: "SK-EN01", name: "Understanding Ecosystems", description: null },
  { sub_skill_id: "EN07", skill_id: "SK-EN02", name: "Climate and Habitat Changes", description: null },
  { sub_skill_id: "EN08", skill_id: "SK-EN02", name: "Geospatial Mapping", description: null },
  { sub_skill_id: "EN09", skill_id: "SK-EN02", name: "Indigenous Spatial Knowledge", description: null },
  { sub_skill_id: "EN10", skill_id: "SK-EN02", name: "Natural Resource Distribution", description: null },
  { sub_skill_id: "EN11", skill_id: "SK-EN02", name: "Urbanization and Land Use", description: null },

  // Social (SO01 - SO20)
  { sub_skill_id: "SO01", skill_id: "SK-SO01", name: "Role Distribution", description: null },
  { sub_skill_id: "SO02", skill_id: "SK-SO01", name: "Shared Goal Setting", description: null },
  { sub_skill_id: "SO03", skill_id: "SK-SO01", name: "Teamwork Strategies", description: null },
  { sub_skill_id: "SO04", skill_id: "SK-SO02", name: "Mediation Techniques", description: null },
  { sub_skill_id: "SO05", skill_id: "SK-SO02", name: "Negotiation Skills", description: null },
  { sub_skill_id: "SO06", skill_id: "SK-SO02", name: "Win-Win Solutions", description: null },
  { sub_skill_id: "SO07", skill_id: "SK-SO03", name: "Constructive Criticism", description: null },
  { sub_skill_id: "SO08", skill_id: "SK-SO03", name: "Growth-Oriented Feedback", description: null },
  { sub_skill_id: "SO09", skill_id: "SK-SO04", name: "Emotional Sensitivity", description: null },
  { sub_skill_id: "SO10", skill_id: "SK-SO04", name: "Perspective-Taking", description: null },
  { sub_skill_id: "SO11", skill_id: "SK-SO04", name: "Understanding Others' Emotions", description: null },
  { sub_skill_id: "SO12", skill_id: "SK-SO05", name: "Consensus Building", description: null },
  { sub_skill_id: "SO13", skill_id: "SK-SO05", name: "Team Behavior", description: null },
  { sub_skill_id: "SO14", skill_id: "SK-SO05", name: "Understanding Team Roles", description: null },
  { sub_skill_id: "SO15", skill_id: "SK-SO06", name: "Leading by Example", description: null },
  { sub_skill_id: "SO16", skill_id: "SK-SO06", name: "Leadership Styles", description: null },
  { sub_skill_id: "SO17", skill_id: "SK-SO06", name: "Setting Roles for Team", description: null },
  { sub_skill_id: "SO18", skill_id: "SK-SO07", name: "Accountability", description: null },
  { sub_skill_id: "SO19", skill_id: "SK-SO07", name: "Consistency in Actions", description: null },
  { sub_skill_id: "SO20", skill_id: "SK-SO07", name: "Reliability", description: null },
];

/** Master data endpoint — topic families, intelligences, skills, and subskills. */
export function fetchMasterData(): Promise<MasterDataResponse> {
  return cachedFetch<MasterDataResponse>("master_data", `${API_BASE_URL}/api/master`);
}
