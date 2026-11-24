/* eslint-disable @typescript-eslint/no-explicit-any */
import { API_BASE_URL } from "@/lib/apiBase";

export interface ExportOptions {
  includeEducationalMetadata?: boolean;
  includeParentGuidance?: boolean;
  includeCarriedForwardMappings?: boolean;
}

export interface ExportData {
  activity_id?: string;
  activity_name?: string | null;
  title?: string | null;
  activity_title?: string | null;
  activity_duration?: string | null;
  estimated_duration?: number | null;
  topic_title?: string | null;
  topic?: string | null;
  topic_family_name?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  target_class?: string | null;
  country_context?: string | null;
  keywords?: string[];
  mappings?: {
    user_selected?: {
      intelligence?: string | null;
      skills?: string[];
      sub_skills?: string[];
    };
    suggested?: {
      intelligence?: string | null;
      skills?: string[];
      sub_skills?: string[];
    };
  };
  user_selected_intelligence?: string | null;
  user_selected_skills?: string[];
  user_selected_sub_skills?: string[];
  suggested_intelligence?: string | null;
  suggested_skills?: string[];
  suggested_sub_skills?: string[];
  pre_activity?: any;
  main_activity?: any;
  post_activity?: any;
  description?: string | null;
  instructions?: any;
  expected_output?: string | null;
  learning_objective?: string | null;
  materials?: any;
  assessment_criteria?: string | null;
  difficulty_level?: string | null;
}

export async function exportActivityToExcel(
  data: ExportData,
  filenamePrefix = "OctaKids_Activity",
  options?: ExportOptions
): Promise<void> {
  const payload = {
    ...data,
    activity_name: data.activity_name || data.title || data.activity_title || "OCTAKIDZ Activity",
    topic_title: data.topic_title || data.topic || "",
    options: options || {},
  };

  const res = await fetch(`${API_BASE_URL}/api/activities/export/excel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Export failed");
    throw new Error(`Failed to export Excel: ${errorText}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (payload.activity_name || "activity").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
  a.download = `${filenamePrefix}_${safeName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export async function exportBatchActivitiesToExcel(
  activities: ExportData[],
  filenamePrefix = "OctaKids_Batch_Export",
  options?: ExportOptions
): Promise<void> {
  if (!activities || activities.length === 0) {
    throw new Error("No activities selected for export");
  }

  const payload = {
    activities: activities.map((data) => ({
      ...data,
      activity_name: data.activity_name || data.title || data.activity_title || "OCTAKIDZ Activity",
      topic_title: data.topic_title || data.topic || "",
    })),
    options: options || {},
  };

  const res = await fetch(`${API_BASE_URL}/api/activities/export/excel/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "Batch export failed");
    throw new Error(`Failed to export batch Excel: ${errorText}`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}_${activities.length}_Activities.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function renderActivityHtml(
  data: ExportData,
  index?: number,
  options?: ExportOptions,
  totalCount?: number
): string {
  const opts = options || {};
  const incMetadata = opts.includeEducationalMetadata !== false;
  const incParent = opts.includeParentGuidance !== false;
  const incMappings = opts.includeCarriedForwardMappings !== false;

  const title = data.activity_name || data.title || data.activity_title || "OCTAKIDZ Activity";
  const duration =
    data.activity_duration || (data.estimated_duration ? `${data.estimated_duration} minutes` : "30 minutes");
  const topicTitle = data.topic_title || data.topic || "General";
  const topicFamily = data.topic_family_name || "General";
  const ageRange =
    data.age_min !== undefined && data.age_max !== undefined ? `${data.age_min}–${data.age_max} years` : "—";
  const targetClass = data.target_class || "—";
  const country = data.country_context || "—";
  const keywords = Array.isArray(data.keywords) ? data.keywords.join(", ") : data.keywords || "—";

  const mappings = data.mappings || {};
  const userSel = mappings.user_selected || {};
  const sugg = mappings.suggested || {};

  const uIntel = userSel.intelligence || data.user_selected_intelligence || "None (Open Discovery)";
  const uSkills = (userSel.skills || data.user_selected_skills || []).join(", ") || "None";
  const uSub = (userSel.sub_skills || data.user_selected_sub_skills || []).join(", ") || "None";

  const sIntel = sugg.intelligence || data.suggested_intelligence || "—";
  const sSkills = (sugg.skills || data.suggested_skills || []).join(", ") || "—";
  const sSub = (sugg.sub_skills || data.suggested_sub_skills || []).join(", ") || "—";

  const pre = data.pre_activity || {};
  const main = data.main_activity || {};
  const post = data.post_activity || {};

  const preDescription = pre.activity_description || data.description || "—";
  const parentsNote = pre.parents_note || "—";
  const parentsGuide = pre.parents_guide || "Not required";
  const preWarmups =
    Array.isArray(pre.pre_activity_engagement) && pre.pre_activity_engagement.length > 0
      ? pre.pre_activity_engagement.map((item: string) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li>None</li>";
  const whyImportant = pre.why_how_is_this_important || "—";
  const letsGetStarted = pre.lets_get_started || "—";

  const taskTitle = main.activity_step_task_title || "—";
  const scenario = main.scenario_real_life_connection || "Not applicable";

  let mainSteps = "";
  const stepsList = main.in_depth_description_and_process || data.instructions || [];
  if (Array.isArray(stepsList)) {
    mainSteps = stepsList
      .map((step: string, i: number) => `<li><strong>Step ${i + 1}:</strong> ${escapeHtml(step)}</li>`)
      .join("");
  } else if (typeof stepsList === "string") {
    mainSteps = `<li>${escapeHtml(stepsList)}</li>`;
  }

  let reflectionQuestions = "";
  if (Array.isArray(main.reflection_questions) && main.reflection_questions.length > 0) {
    reflectionQuestions = main.reflection_questions.map((q: string) => `<li>${escapeHtml(q)}</li>`).join("");
  } else {
    reflectionQuestions = "<li>None recorded</li>";
  }

  const whatsNext = post.whats_next || "—";
  const extendLearning =
    Array.isArray(post.extend_the_learning) && post.extend_the_learning.length > 0
      ? post.extend_the_learning.map((e: string) => `<li>${escapeHtml(e)}</li>`).join("")
      : "<li>None recorded</li>";
  const howToImprovise = post.how_to_improvise_or_level_up || "—";
  const postSummary = post.post_activity_summary || data.expected_output || "—";

  let materialsList = "—";
  if (Array.isArray(data.materials) && data.materials.length > 0) {
    materialsList = data.materials.join(" · ");
  } else if (typeof data.materials === "string") {
    materialsList = data.materials;
  }

  const todayStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `
    <div class="activity-sheet">
      <div class="banner">
        ${index !== undefined ? `<div class="badge">Activity ${index}${totalCount ? ` of ${totalCount}` : ""}</div>` : ""}
        <h1>OCTAKIDZ AI ACTIVITY SPECIFICATION</h1>
        <p>Complete 5-Section Activity Specification &amp; Educational Blueprint</p>
      </div>

      <div class="section">
        <h2>1. Activity Overview</h2>
        <div class="grid">
          <div class="field-row"><div class="field-label">Activity Name</div><div class="field-value">${escapeHtml(title)}</div></div>
          <div class="field-row"><div class="field-label">Duration</div><div class="field-value">${escapeHtml(duration)}</div></div>
          <div class="field-row"><div class="field-label">Topic</div><div class="field-value">${escapeHtml(topicTitle)}</div></div>
          <div class="field-row"><div class="field-label">Topic Family</div><div class="field-value">${escapeHtml(topicFamily)}</div></div>
          <div class="field-row"><div class="field-label">Target Age Range</div><div class="field-value">${escapeHtml(ageRange)}</div></div>
          <div class="field-row"><div class="field-label">Target Class / Grade</div><div class="field-value">${escapeHtml(targetClass)}</div></div>
          <div class="field-row"><div class="field-label">Country / Context</div><div class="field-value">${escapeHtml(country)}</div></div>
          <div class="field-row"><div class="field-label">Keywords</div><div class="field-value">${escapeHtml(keywords)}</div></div>
        </div>
      </div>

      ${incMappings ? `
      <div class="section">
        <h2>2. Carried-Forward Intelligence, Skills &amp; Sub-Skills</h2>
        <div class="grid">
          <div class="field-row"><div class="field-label">User-Selected Intelligence</div><div class="field-value">${escapeHtml(uIntel)}</div></div>
          <div class="field-row"><div class="field-label">AI-Suggested Intelligence</div><div class="field-value">${escapeHtml(sIntel)}</div></div>
          <div class="field-row"><div class="field-label">User-Selected Skills</div><div class="field-value">${escapeHtml(uSkills)}</div></div>
          <div class="field-row"><div class="field-label">AI-Suggested Skills</div><div class="field-value">${escapeHtml(sSkills)}</div></div>
          <div class="field-row"><div class="field-label">User-Selected Sub-Skills</div><div class="field-value">${escapeHtml(uSub)}</div></div>
          <div class="field-row"><div class="field-label">AI-Suggested Sub-Skills</div><div class="field-value">${escapeHtml(sSub)}</div></div>
        </div>
      </div>` : ""}

      <div class="section">
        <h2>3. Pre-Activity (Preparation &amp; Engagement)</h2>
        <div class="field-row">
          <div class="field-label">Activity Description</div>
          <div class="field-value">${escapeHtml(preDescription)}</div>
        </div>
        ${incParent ? `
        <div class="grid" style="margin-top: 10px;">
          <div class="field-row"><div class="field-label">Parent's Note</div><div class="field-value">${escapeHtml(parentsNote)}</div></div>
          <div class="field-row"><div class="field-label">Parent's Guide</div><div class="field-value">${escapeHtml(parentsGuide)}</div></div>
        </div>` : ""}
        <div class="field-row" style="margin-top: 10px;">
          <div class="field-label">Pre-Activity Engagement</div>
          <ul class="steps-list">${preWarmups}</ul>
        </div>
        <div class="grid" style="margin-top: 10px;">
          <div class="field-row"><div class="field-label">Why / How Is This Important?</div><div class="field-value">${escapeHtml(whyImportant)}</div></div>
          <div class="field-row"><div class="field-label">Let's Get Started!</div><div class="field-value">${escapeHtml(letsGetStarted)}</div></div>
        </div>
      </div>

      <div class="section">
        <h2>4. Main Activity (Step-by-Step Process)</h2>
        <div class="field-row">
          <div class="field-label">Activity Step / Task Title</div>
          <div class="field-value">${escapeHtml(taskTitle)}</div>
        </div>
        <div class="field-row" style="margin-top: 8px;">
          <div class="field-label">Scenario / Real-Life Connection</div>
          <div class="field-value">${escapeHtml(scenario)}</div>
        </div>
        <div class="field-row" style="margin-top: 10px;">
          <div class="field-label">Process &amp; Steps</div>
          <ol class="steps-list">${mainSteps}</ol>
        </div>
        <div class="field-row" style="margin-top: 10px;">
          <div class="field-label">Reflection Questions</div>
          <ul class="steps-list">${reflectionQuestions}</ul>
        </div>
      </div>

      <div class="section">
        <h2>5. Post-Activity (Extension &amp; Reflection)</h2>
        <div class="grid">
          <div class="field-row"><div class="field-label">What's Next</div><div class="field-value">${escapeHtml(whatsNext)}</div></div>
          <div class="field-row"><div class="field-label">How to Improvise / Level Up</div><div class="field-value">${escapeHtml(howToImprovise)}</div></div>
        </div>
        <div class="field-row" style="margin-top: 10px;">
          <div class="field-label">Extend the Learning</div>
          <ul class="steps-list">${extendLearning}</ul>
        </div>
        <div class="field-row" style="margin-top: 10px;">
          <div class="field-label">Post-Activity Summary</div>
          <div class="field-value">${escapeHtml(postSummary)}</div>
        </div>
      </div>

      ${incMetadata ? `
      <div class="section">
        <h2>6. Educational Metadata &amp; Resources</h2>
        <div class="grid">
          <div class="field-row"><div class="field-label">Learning Objective</div><div class="field-value">${escapeHtml(data.learning_objective || "—")}</div></div>
          <div class="field-row"><div class="field-label">Materials Required</div><div class="field-value">${escapeHtml(materialsList)}</div></div>
          <div class="field-row"><div class="field-label">Assessment Criteria</div><div class="field-value">${escapeHtml(data.assessment_criteria || "—")}</div></div>
          <div class="field-row"><div class="field-label">Difficulty Level</div><div class="field-value">${escapeHtml(data.difficulty_level || "—")}</div></div>
        </div>
      </div>` : ""}

      <div class="sheet-footer">
        <span>OCTAKIDZ AI Activity Specification</span>
        <span>${index !== undefined ? `Sheet ${index}${totalCount ? ` of ${totalCount}` : ""}` : "Standard Activity Blueprint"}</span>
        <span>Generated: ${todayStr}</span>
      </div>
    </div>
  `;
}

const COMMON_PDF_CSS = `
  @page {
    margin: 12mm 15mm 15mm 15mm;
    size: A4 portrait;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    margin: 0;
    padding: 0;
    background: #ffffff;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .activity-sheet {
    page-break-after: always;
    break-after: page;
    margin-bottom: 28px;
  }
  .activity-sheet:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .banner {
    background: #5B50F5;
    color: #ffffff;
    padding: 16px 20px;
    border-radius: 8px;
    margin-bottom: 14px;
    text-align: center;
    position: relative;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .banner .badge {
    position: absolute;
    top: 12px;
    left: 16px;
    background: rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 9pt;
    font-weight: bold;
    text-transform: uppercase;
  }
  .banner h1 {
    margin: 0;
    font-size: 15pt;
    letter-spacing: 0.5px;
  }
  .banner p {
    margin: 4px 0 0 0;
    font-size: 9pt;
    opacity: 0.9;
  }
  .section {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px 16px;
    margin-bottom: 12px;
    page-break-inside: auto;
    break-inside: auto;
  }
  .section h2 {
    margin: 0 0 8px 0;
    font-size: 11pt;
    color: #4338ca;
    background: #eef0ff;
    padding: 6px 10px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .field-row {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .field-label {
    font-size: 8.5pt;
    font-weight: bold;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 2px;
  }
  .field-value {
    font-size: 10pt;
    color: #0f172a;
    white-space: pre-line;
    word-break: break-word;
  }
  .steps-list {
    margin: 4px 0 0 0;
    padding-left: 20px;
    font-size: 10pt;
  }
  .steps-list li {
    margin-bottom: 5px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .sheet-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
    margin-top: 16px;
    font-size: 8pt;
    color: #94a3b8;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  @media print {
    body {
      background: none;
    }
    .banner {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .section h2 {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
`;

export function exportActivityToPdf(data: ExportData, options?: ExportOptions): void {
  const title = data.activity_name || data.title || data.activity_title || "OCTAKIDZ Activity";
  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} - OCTAKIDZ Activity Sheet</title>
  <style>${COMMON_PDF_CSS}</style>
</head>
<body>
  ${renderActivityHtml(data, 1, options, 1)}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
}

export function exportBatchActivitiesToPdf(activities: ExportData[], options?: ExportOptions): void {
  if (!activities || activities.length === 0) {
    alert("No activities selected for PDF export");
    return;
  }

  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>OCTAKIDZ Batch Activity Export (${activities.length} Activities)</title>
  <style>${COMMON_PDF_CSS}</style>
</head>
<body>
  ${activities.map((act, idx) => renderActivityHtml(act, idx + 1, options, activities.length)).join("\n")}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
  }
}

function escapeHtml(text: any): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
