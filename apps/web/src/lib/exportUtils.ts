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

function cleanStepText(text: string): string {
  let cleaned = String(text || "").trim();
  cleaned = cleaned.replace(/^[•\-\*]\s*/, "");
  // Strip duplicate or redundant "Step X:" prefixes
  cleaned = cleaned.replace(/^Step\s*\d+\s*[:.-]\s*/i, "");
  cleaned = cleaned.replace(/^Step\s*\d+\s*[:.-]\s*/i, "");
  return cleaned.trim();
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return (
    (trimmed.startsWith("|") && trimmed.endsWith("|")) ||
    /^(\|[^\n|]+)+\|$/.test(trimmed) ||
    /^\|?\s*:?-+:?\s*(\||\s*$)/.test(trimmed)
  );
}

function parseMarkdownTableHtml(rows: string[]): string {
  if (rows.length === 0) return "";
  const parsedRows: string[][] = rows.map((r) =>
    r
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim())
  );

  const contentRows = parsedRows.filter(
    (cols) => !cols.every((c) => /^:?-+:?$/.test(c))
  );
  if (contentRows.length === 0) return "";

  const headers = contentRows[0];
  const bodyRows = contentRows.slice(1);

  let html = `<div class="table-scroll"><table class="blueprint-table"><thead><tr>`;
  for (const h of headers) {
    html += `<th>${escapeHtml(h)}</th>`;
  }
  html += `</tr></thead>`;

  if (bodyRows.length > 0) {
    html += `<tbody>`;
    for (const row of bodyRows) {
      html += `<tr>`;
      for (let i = 0; i < headers.length; i++) {
        html += `<td>${escapeHtml(row[i] || "")}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody>`;
  } else {
    // Generate worksheet recording rows for students to write findings on printed blueprints
    html += `<tbody>`;
    for (let r = 0; r < 3; r++) {
      html += `<tr class="fill-in-row">`;
      for (let i = 0; i < headers.length; i++) {
        html += `<td class="fill-in-cell">&nbsp;</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody>`;
  }
  html += `</table></div>`;
  return html;
}

function formatSingleStep(cleaned: string): { text: string; tableHtml?: string } {
  const pipeIndex = cleaned.indexOf("|");
  if (pipeIndex > 0 && cleaned.endsWith("|") && cleaned.split("|").length >= 3) {
    const textPart = cleaned.slice(0, pipeIndex).trim();
    const tablePart = cleaned.slice(pipeIndex).trim();
    return {
      text: textPart,
      tableHtml: parseMarkdownTableHtml([tablePart]),
    };
  }
  return { text: cleaned };
}

function formatProcessSteps(stepsList: any): string {
  if (!stepsList) return "<p class='empty-text'>No process steps recorded.</p>";

  const rawItems: string[] = Array.isArray(stepsList)
    ? stepsList.map((s) => String(s || "").trim()).filter(Boolean)
    : [String(stepsList).trim()];

  if (rawItems.length === 0) return "<p class='empty-text'>No process steps recorded.</p>";

  const stepBlocks: { number: number; text: string; tableHtml?: string }[] = [];
  let currentStepNum = 1;
  let bufferedTableRows: string[] = [];

  const flushTable = () => {
    if (bufferedTableRows.length > 0) {
      const tableHtml = parseMarkdownTableHtml(bufferedTableRows);
      bufferedTableRows = [];
      if (tableHtml) {
        if (stepBlocks.length > 0) {
          stepBlocks[stepBlocks.length - 1].tableHtml =
            (stepBlocks[stepBlocks.length - 1].tableHtml || "") + tableHtml;
        } else {
          stepBlocks.push({ number: currentStepNum++, text: "", tableHtml });
        }
      }
    }
  };

  for (const raw of rawItems) {
    const cleaned = cleanStepText(raw);
    if (!cleaned) continue;

    if (isTableRow(cleaned)) {
      bufferedTableRows.push(cleaned);
    } else {
      flushTable();
      const { text, tableHtml } = formatSingleStep(cleaned);
      stepBlocks.push({
        number: currentStepNum++,
        text,
        tableHtml,
      });
    }
  }

  flushTable();

  return stepBlocks
    .map(
      (s) => `
    <div class="step-card">
      <div class="step-num">${s.number}</div>
      <div class="step-content">
        ${s.text ? `<div class="step-text">${escapeHtml(s.text)}</div>` : ""}
        ${s.tableHtml ? `<div class="step-table-container">${s.tableHtml}</div>` : ""}
      </div>
    </div>`
    )
    .join("");
}

function renderBadgePills(items: string | string[] | undefined | null, badgeClass = "badge-pill"): string {
  const list = Array.isArray(items) ? items : typeof items === "string" ? items.split(",") : [];
  const valid = list.map((s) => String(s).trim()).filter((s) => s && s !== "None" && s !== "—");
  if (valid.length === 0) return `<span class="empty-badge">—</span>`;
  return valid.map((item) => `<span class="${badgeClass}">${escapeHtml(item)}</span>`).join(" ");
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
  const showPage3 = incMappings || incMetadata;
  const totalDocPages = showPage3 ? 3 : 2;

  const title = data.activity_name || data.title || data.activity_title || "OCTAKIDZ Activity";
  const duration =
    data.activity_duration || (data.estimated_duration ? `${data.estimated_duration} minutes` : "30 minutes");
  const topicTitle = data.topic_title || data.topic || "General Topic";
  const topicFamily = data.topic_family_name || "General";
  const ageRange =
    data.age_min !== undefined && data.age_max !== undefined ? `${data.age_min}–${data.age_max} years` : "—";
  const targetClass = data.target_class || "—";
  const country = data.country_context || "—";
  const rawKeywords = Array.isArray(data.keywords) ? data.keywords : typeof data.keywords === "string" ? [data.keywords] : [];

  const mappings = data.mappings || {};
  const userSel = mappings.user_selected || {};
  const sugg = mappings.suggested || {};

  const uIntel = userSel.intelligence || data.user_selected_intelligence || "None (Open Discovery)";
  const uSkills = userSel.skills || data.user_selected_skills || [];
  const uSub = userSel.sub_skills || data.user_selected_sub_skills || [];

  const sIntel = sugg.intelligence || data.suggested_intelligence || "—";
  const sSkills = sugg.skills || data.suggested_skills || [];
  const sSub = sugg.sub_skills || data.suggested_sub_skills || [];

  const pre = data.pre_activity || {};
  const main = data.main_activity || {};
  const post = data.post_activity || {};

  const preDescription = pre.activity_description || data.description || "—";
  const parentsNote = pre.parents_note || "—";
  const parentsGuide = pre.parents_guide || "Adult guidance not required for this activity.";
  const preWarmups =
    Array.isArray(pre.pre_activity_engagement) && pre.pre_activity_engagement.length > 0
      ? pre.pre_activity_engagement.map((item: string) => `<li>${escapeHtml(item)}</li>`).join("")
      : "";
  const whyImportant = pre.why_how_is_this_important || "—";
  const letsGetStarted = pre.lets_get_started || "—";

  const taskTitle = main.activity_step_task_title || "—";
  const scenario = main.scenario_real_life_connection || "";

  const stepsList = main.in_depth_description_and_process || data.instructions || [];
  const formattedStepsHtml = formatProcessSteps(stepsList);

  let reflectionQuestions = "";
  if (Array.isArray(main.reflection_questions) && main.reflection_questions.length > 0) {
    reflectionQuestions = main.reflection_questions.map((q: string) => `<li>${escapeHtml(q)}</li>`).join("");
  }

  const whatsNext = post.whats_next || "—";
  let extendLearning = "";
  if (Array.isArray(post.extend_the_learning) && post.extend_the_learning.length > 0) {
    extendLearning = post.extend_the_learning.map((e: string) => `<li>${escapeHtml(e)}</li>`).join("");
  }
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
    <article class="blueprint-document">
      <!-- ================= PAGE 1: STUDENT & PARENT LAUNCHPAD ================= -->
      <div class="blueprint-page">
        <div class="page-inner-content">
          <!-- HEADER / BANNER -->
          <header class="doc-header">
            <div class="header-brand-row">
              <div class="brand-badge">
                <span class="brand-sparkle">✦</span>
                <span class="brand-title">OCTA KIDS</span>
                <span class="brand-sub">Curriculum Blueprint</span>
              </div>
              <div class="sheet-counter">${totalCount && totalCount > 1 ? `Activity ${index} of ${totalCount} · ` : ""}Page 1 of ${totalDocPages}</div>
            </div>
            <h1 class="activity-title">${escapeHtml(title)}</h1>
            <div class="topic-bar">
              <span class="topic-label">Topic:</span>
              <span class="topic-value">${escapeHtml(topicTitle)}</span>
            </div>

            <div class="meta-pills-row">
              <div class="pill pill-duration">
                <span class="pill-icon">⏱</span>
                <span>${escapeHtml(duration)}</span>
              </div>
              <div class="pill pill-age">
                <span class="pill-icon">🧒</span>
                <span>${escapeHtml(ageRange)}</span>
              </div>
              ${targetClass && targetClass !== "—" ? `
              <div class="pill pill-grade">
                <span class="pill-icon">🎓</span>
                <span>${escapeHtml(targetClass)}</span>
              </div>` : ""}
              <div class="pill pill-intel">
                <span class="pill-icon">💡</span>
                <span>${escapeHtml(uIntel !== "None (Open Discovery)" ? uIntel : sIntel)}</span>
              </div>
              <div class="pill pill-family">
                <span class="pill-icon">📂</span>
                <span>${escapeHtml(topicFamily)}</span>
              </div>
              ${country && country !== "—" ? `
              <div class="pill pill-country">
                <span class="pill-icon">📍</span>
                <span>${escapeHtml(country)}</span>
              </div>` : ""}
            </div>

            ${rawKeywords.length > 0 ? `
            <div class="keywords-row">
              <span class="kw-label">Keywords:</span>
              ${renderBadgePills(rawKeywords, "kw-pill")}
            </div>` : ""}
          </header>

          <!-- SECTION 1: PRE-ACTIVITY -->
          <section class="section-card">
            <div class="section-banner banner-pre">
              <div class="banner-left">
                <span class="banner-num">01</span>
                <h2 class="banner-title">Pre-Activity: Preparation &amp; Engagement</h2>
              </div>
              <span class="banner-subtitle">Warm-up &amp; Context</span>
            </div>
            <div class="section-body">
              <div class="callout-box hook-box">
                <div class="callout-title">Concept &amp; Engagement Hook</div>
                <p class="callout-text">${escapeHtml(preDescription)}</p>
              </div>

              ${incParent ? `
              <div class="parent-grid">
                <div class="parent-card card-note">
                  <div class="card-header">
                    <span class="card-icon">📌</span>
                    <h3>Parent's Note</h3>
                  </div>
                  <p class="card-body">${escapeHtml(parentsNote)}</p>
                </div>
                <div class="parent-card card-guide">
                  <div class="card-header">
                    <span class="card-icon">🧭</span>
                    <h3>Parent's Guide</h3>
                  </div>
                  <p class="card-body">${escapeHtml(parentsGuide)}</p>
                </div>
              </div>` : ""}

              ${preWarmups ? `
              <div class="warmup-wrapper">
                <h4 class="subhead">💬 Warm-Up &amp; Discussion Starters</h4>
                <ul class="styled-list">${preWarmups}</ul>
              </div>` : ""}

              <div class="split-highlight-grid">
                <div class="highlight-item item-why">
                  <h4 class="subhead">🌟 Why / How Is This Important?</h4>
                  <p>${escapeHtml(whyImportant)}</p>
                </div>
                <div class="highlight-item item-rally">
                  <h4 class="subhead">🚀 Let's Get Started!</h4>
                  <p>${escapeHtml(letsGetStarted)}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- FOOTER PAGE 1 -->
        <footer class="sheet-footer">
          <div class="footer-brand">
            <span class="f-dot">●</span>
            <span>OCTA KIDS AI Activity Platform</span>
          </div>
          <div class="footer-center">
            <span>Part 1: Student &amp; Parent Launchpad</span>
          </div>
          <div class="footer-meta">
            <span>Page 1 of ${totalDocPages} · Generated: ${todayStr}</span>
          </div>
        </footer>
      </div>

      <!-- ================= PAGE 2: MAIN & POST-ACTIVITY ================= -->
      <div class="blueprint-page">
        <div class="page-inner-content">
          <!-- RUNNING HEADER -->
          <div class="page-top-bar">
            <div class="top-bar-brand">
              <span class="brand-sparkle">✦</span>
              <span>OCTA<b>KIDS</b> Curriculum Blueprint</span>
            </div>
            <div class="top-bar-title">${escapeHtml(title)}</div>
            <div class="top-bar-page">Page 2 of ${totalDocPages}</div>
          </div>

          <!-- SECTION 2: MAIN ACTIVITY -->
          <section class="section-card">
            <div class="section-banner banner-main">
              <div class="banner-left">
                <span class="banner-num">02</span>
                <h2 class="banner-title">Main Activity: Step-by-Step Experience</h2>
              </div>
              <span class="banner-subtitle">Hands-On Process</span>
            </div>
            <div class="section-body">
              <div class="mission-bar">
                <div class="mission-task">
                  <span class="mission-tag">Activity Task</span>
                  <span class="mission-text">${escapeHtml(taskTitle)}</span>
                </div>
                ${scenario ? `
                <div class="mission-scenario">
                  <span class="mission-tag tag-scenario">Real-Life Connection</span>
                  <span class="mission-text">${escapeHtml(scenario)}</span>
                </div>` : ""}
              </div>

              <div class="steps-wrapper">
                <h4 class="subhead steps-header">🛠 Process &amp; Action Steps</h4>
                <div class="steps-flow">
                  ${formattedStepsHtml}
                </div>
              </div>

              ${reflectionQuestions ? `
              <div class="reflection-wrapper">
                <h4 class="subhead">🤔 Reflection &amp; Critical Thinking</h4>
                <ul class="styled-list reflection-list">${reflectionQuestions}</ul>
              </div>` : ""}
            </div>
          </section>

          <!-- SECTION 3: POST-ACTIVITY -->
          <section class="section-card">
            <div class="section-banner banner-post">
              <div class="banner-left">
                <span class="banner-num">03</span>
                <h2 class="banner-title">Post-Activity: Extension &amp; Reflection</h2>
              </div>
              <span class="banner-subtitle">Growth &amp; Summary</span>
            </div>
            <div class="section-body">
              <div class="post-grid">
                <div class="post-card card-next">
                  <div class="card-header">
                    <span class="card-icon">🔮</span>
                    <h3>What's Next?</h3>
                  </div>
                  <p class="card-body">${escapeHtml(whatsNext)}</p>
                </div>
                <div class="post-card card-levelup">
                  <div class="card-header">
                    <span class="card-icon">🏆</span>
                    <h3>Level-Up Challenge</h3>
                  </div>
                  <p class="card-body">${escapeHtml(howToImprovise)}</p>
                </div>
              </div>

              ${extendLearning ? `
              <div class="extend-wrapper">
                <h4 class="subhead">🌱 Extend the Learning</h4>
                <ul class="styled-list">${extendLearning}</ul>
              </div>` : ""}

              <div class="summary-wrapper">
                <h4 class="subhead">✅ Post-Activity Summary</h4>
                <p class="summary-text">${escapeHtml(postSummary)}</p>
              </div>
            </div>
          </section>
        </div>

        <!-- FOOTER PAGE 2 -->
        <footer class="sheet-footer">
          <div class="footer-brand">
            <span class="f-dot">●</span>
            <span>OCTA KIDS AI Activity Platform</span>
          </div>
          <div class="footer-center">
            <span>Part 2: Hands-On Action Blueprint</span>
          </div>
          <div class="footer-meta">
            <span>Page 2 of ${totalDocPages} · Generated: ${todayStr}</span>
          </div>
        </footer>
      </div>

      ${showPage3 ? `
      <!-- ================= PAGE 3: EDUCATIONAL TAXONOMY & METADATA ================= -->
      <div class="blueprint-page">
        <div class="page-inner-content">
          <!-- RUNNING HEADER -->
          <div class="page-top-bar">
            <div class="top-bar-brand">
              <span class="brand-sparkle">✦</span>
              <span>OCTA<b>KIDS</b> Curriculum Blueprint</span>
            </div>
            <div class="top-bar-title">${escapeHtml(title)}</div>
            <div class="top-bar-page">Page 3 of ${totalDocPages}</div>
          </div>

          ${incMappings ? `
          <!-- SECTION 4: EDUCATIONAL TAXONOMY (CARRIED FORWARD) -->
          <section class="section-card">
            <div class="section-banner banner-taxonomy">
              <div class="banner-left">
                <span class="banner-num">04</span>
                <h2 class="banner-title">Educational Taxonomy &amp; Skill Mapping</h2>
              </div>
              <span class="banner-subtitle">Curriculum Alignment</span>
            </div>
            <div class="section-body">
              <div class="taxonomy-compare-grid">
                <div class="tax-panel tax-user">
                  <div class="tax-panel-title">User-Selected Focus</div>
                  <div class="tax-entry">
                    <span class="tax-key">Intelligence</span>
                    <span class="tax-badge badge-indigo">${escapeHtml(uIntel)}</span>
                  </div>
                  <div class="tax-entry">
                    <span class="tax-key">Skills</span>
                    <div class="tax-pills">${renderBadgePills(uSkills, "skill-pill")}</div>
                  </div>
                  <div class="tax-entry">
                    <span class="tax-key">Sub-Skills</span>
                    <div class="tax-pills">${renderBadgePills(uSub, "subskill-pill")}</div>
                  </div>
                </div>
                <div class="tax-panel tax-ai">
                  <div class="tax-panel-title">AI-Suggested Curriculum Alignment</div>
                  <div class="tax-entry">
                    <span class="tax-key">Intelligence</span>
                    <span class="tax-badge badge-purple">${escapeHtml(sIntel)}</span>
                  </div>
                  <div class="tax-entry">
                    <span class="tax-key">Skills</span>
                    <div class="tax-pills">${renderBadgePills(sSkills, "skill-pill")}</div>
                  </div>
                  <div class="tax-entry">
                    <span class="tax-key">Sub-Skills</span>
                    <div class="tax-pills">${renderBadgePills(sSub, "subskill-pill")}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>` : ""}

          ${incMetadata ? `
          <!-- SECTION 5: METADATA & RESOURCES -->
          <section class="section-card">
            <div class="section-banner banner-meta">
              <div class="banner-left">
                <span class="banner-num">05</span>
                <h2 class="banner-title">Educational Metadata &amp; Resource Guide</h2>
              </div>
              <span class="banner-subtitle">Assessment &amp; Tools</span>
            </div>
            <div class="section-body">
              <div class="metadata-grid">
                <div class="meta-box">
                  <div class="meta-label">Learning Objective</div>
                  <div class="meta-content">${escapeHtml(data.learning_objective || "Students develop hands-on critical thinking and applied subject mastery.")}</div>
                </div>
                <div class="meta-box">
                  <div class="meta-label">Materials Required</div>
                  <div class="meta-content">${escapeHtml(materialsList)}</div>
                </div>
                <div class="meta-box">
                  <div class="meta-label">Assessment Criteria</div>
                  <div class="meta-content">${escapeHtml(data.assessment_criteria || "Evaluated through successful project assembly, observation rigor, and reflection clarity.")}</div>
                </div>
                <div class="meta-box">
                  <div class="meta-label">Difficulty Level</div>
                  <div class="meta-content"><span class="difficulty-tag">${escapeHtml(data.difficulty_level || "Intermediate")}</span></div>
                </div>
              </div>
            </div>
          </section>` : ""}

          <!-- EVALUATOR / FACILITATOR OBSERVATION NOTES -->
          <section class="section-card notes-section">
            <div class="section-banner banner-notes">
              <div class="banner-left">
                <span class="banner-num">📝</span>
                <h2 class="banner-title">Facilitator &amp; Evaluator Notes</h2>
              </div>
              <span class="banner-subtitle">Observations &amp; Feedback</span>
            </div>
            <div class="section-body">
              <div class="lined-notes-area">
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
                <div class="note-line"></div>
              </div>
            </div>
          </section>
        </div>

        <!-- FOOTER PAGE 3 -->
        <footer class="sheet-footer">
          <div class="footer-brand">
            <span class="f-dot">●</span>
            <span>OCTA KIDS AI Activity Platform</span>
          </div>
          <div class="footer-center">
            <span>Part 3: Curriculum Standards &amp; Assessment</span>
          </div>
          <div class="footer-meta">
            <span>Page 3 of ${totalDocPages} · Generated: ${todayStr}</span>
          </div>
        </footer>
      </div>` : ""}
    </article>
  `;
}

const COMMON_PDF_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  @page {
    size: A4 portrait;
    margin: 0;
  }

  * {
    box-sizing: border-box;
  }

  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #0f172a;
    margin: 0;
    padding: 0;
    background: #f1f5f9;
    font-size: 9.5pt;
    line-height: 1.45;
    -webkit-font-smoothing: antialiased;
  }

  /* SCREEN PREVIEW TOOLBAR */
  .preview-toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: #ffffff;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    z-index: 9999;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-logo {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .logo-circle {
    width: 26px;
    height: 26px;
    background: #5B50F5;
    color: #ffffff;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 13px;
  }

  .logo-name {
    font-size: 14px;
    font-weight: 700;
    color: #1e1b4b;
    letter-spacing: -0.2px;
  }

  .logo-name b {
    color: #5B50F5;
  }

  .toolbar-divider {
    color: #cbd5e1;
    font-size: 14px;
  }

  .toolbar-title {
    font-size: 13px;
    color: #475569;
    font-weight: 500;
    max-width: 450px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .btn-print {
    background: #5B50F5;
    color: #ffffff;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    box-shadow: 0 2px 6px rgba(91, 80, 245, 0.3);
    transition: all 0.15s ease;
  }

  .btn-print:hover {
    background: #4740d4;
    transform: translateY(-1px);
  }

  .btn-close {
    background: #f1f5f9;
    color: #475569;
    font-weight: 500;
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.15s ease;
  }

  .btn-close:hover {
    background: #e2e8f0;
  }

  /* DOCUMENT CONTAINER (SCREEN) */
  .doc-container {
    padding: 76px 16px 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #f1f5f9;
    min-height: 100vh;
  }

  .blueprint-document {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
  }

  /* PAGE-PERFECT A4 CONTAINER (IDENTICAL ON SCREEN & PRINT) */
  .blueprint-page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto 32px;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04);
    border: 1px solid #e2e8f0;
    padding: 14mm 16mm 12mm;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    position: relative;
  }

  .page-inner-content {
    flex: 1;
  }

  /* RUNNING TOP BAR FOR PAGES 2 & 3 */
  .page-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 7px;
    margin-bottom: 12px;
    font-size: 8pt;
  }

  .top-bar-brand {
    font-weight: 700;
    color: #4338ca;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .top-bar-brand b {
    color: #5B50F5;
  }

  .top-bar-title {
    font-weight: 600;
    color: #334155;
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .top-bar-page {
    background: #eef2ff;
    color: #4338ca;
    padding: 2px 8px;
    border-radius: 9999px;
    font-weight: 700;
    font-size: 7.5pt;
    border: 1px solid #c7d2fe;
  }

  /* DOCUMENT HEADER (PAGE 1) */
  .doc-header {
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 14px;
    margin-bottom: 14px;
  }

  .header-brand-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }

  .brand-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 9999px;
    padding: 3px 12px;
  }

  .brand-sparkle {
    color: #5B50F5;
    font-size: 11px;
  }

  .brand-title {
    font-size: 11px;
    font-weight: 800;
    color: #3730a3;
    letter-spacing: 0.5px;
  }

  .brand-sub {
    font-size: 11px;
    color: #6366f1;
    font-weight: 500;
  }

  .sheet-counter {
    font-size: 8pt;
    font-weight: 700;
    color: #5B50F5;
    background: #f5f3ff;
    padding: 3px 10px;
    border-radius: 6px;
    border: 1px solid #ddd6fe;
  }

  .activity-title {
    margin: 0 0 4px 0;
    font-size: 17pt;
    font-weight: 800;
    color: #1e1b4b;
    line-height: 1.25;
    letter-spacing: -0.3px;
  }

  .topic-bar {
    font-size: 9.5pt;
    color: #475569;
    margin-bottom: 10px;
  }

  .topic-label {
    font-weight: 700;
    color: #334155;
    margin-right: 4px;
  }

  .topic-value {
    color: #1e293b;
  }

  /* METADATA PILLS ROW */
  .meta-pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 8.5pt;
    font-weight: 600;
    border: 1px solid transparent;
  }

  .pill-duration { background: #fef3c7; color: #92400e; border-color: #fde68a; }
  .pill-age      { background: #ecfdf5; color: #065f46; border-color: #a7f3d0; }
  .pill-grade    { background: #eff6ff; color: #1e40af; border-color: #bfdbfe; }
  .pill-intel    { background: #f5f3ff; color: #5b21b6; border-color: #ddd6fe; }
  .pill-family   { background: #f8fafc; color: #334155; border-color: #cbd5e1; }
  .pill-country  { background: #f0fdfa; color: #115e59; border-color: #99f6e4; }

  .keywords-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    font-size: 8pt;
    margin-top: 6px;
  }

  .kw-label {
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    font-size: 7.5pt;
    letter-spacing: 0.3px;
  }

  .kw-pill {
    background: #f1f5f9;
    color: #475569;
    padding: 1px 7px;
    border-radius: 9999px;
    font-size: 7.5pt;
    font-weight: 500;
  }

  /* SECTION CARDS */
  .section-card {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 11px;
    overflow: hidden;
    background: #ffffff;
  }

  .section-card:last-child {
    margin-bottom: 0;
  }

  .section-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 14px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .banner-pre      { background: #f0fdf4; border-color: #bbf7d0; }
  .banner-main     { background: #eef2ff; border-color: #c7d2fe; }
  .banner-post     { background: #faf5ff; border-color: #e9d5ff; }
  .banner-taxonomy { background: #f8fafc; border-color: #e2e8f0; }
  .banner-meta     { background: #f1f5f9; border-color: #cbd5e1; }
  .banner-notes    { background: #fdf2f8; border-color: #fbcfe8; }

  .banner-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .banner-num {
    background: rgba(0, 0, 0, 0.08);
    color: #1e1b4b;
    font-size: 8pt;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    letter-spacing: 0.5px;
  }

  .banner-title {
    margin: 0;
    font-size: 9.5pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.2px;
  }

  .banner-subtitle {
    font-size: 7.5pt;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .section-body {
    padding: 10px 14px;
  }

  /* CALLOUT BOXES */
  .callout-box {
    padding: 9px 12px;
    border-radius: 6px;
    margin-bottom: 9px;
  }

  .hook-box {
    background: #f5f3ff;
    border: 1px solid #ddd6fe;
    border-left: 4px solid #7c3aed;
  }

  .callout-title {
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #6b21a8;
    margin-bottom: 2px;
    letter-spacing: 0.4px;
  }

  .callout-text {
    margin: 0;
    font-size: 9pt;
    color: #1e1b4b;
    line-height: 1.45;
  }

  /* PARENT GUIDANCE GRID */
  .parent-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 9px;
  }

  .parent-card {
    padding: 9px 11px;
    border-radius: 6px;
    border: 1px solid transparent;
  }

  .card-note  { background: #fffbeb; border-color: #fde68a; border-left: 3.5px solid #d97706; }
  .card-guide { background: #f0f9ff; border-color: #bae6fd; border-left: 3.5px solid #0284c7; }

  .card-header {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-bottom: 3px;
  }

  .card-header h3 {
    margin: 0;
    font-size: 8.5pt;
    font-weight: 700;
    color: #0f172a;
  }

  .card-body {
    margin: 0;
    font-size: 8.5pt;
    color: #334155;
    line-height: 1.4;
  }

  /* LISTS */
  .subhead {
    margin: 0 0 6px 0;
    font-size: 9pt;
    font-weight: 700;
    color: #1e293b;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .styled-list {
    margin: 0;
    padding-left: 16px;
    font-size: 8.5pt;
    color: #334155;
    line-height: 1.45;
  }

  .styled-list li {
    margin-bottom: 3px;
  }

  .warmup-wrapper {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 9px;
  }

  .split-highlight-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .highlight-item {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 11px;
  }

  .highlight-item p {
    margin: 0;
    font-size: 8.5pt;
    color: #334155;
    line-height: 1.4;
  }

  .item-why   { border-left: 3.5px solid #3b82f6; }
  .item-rally { border-left: 3.5px solid #10b981; }

  /* MAIN ACTIVITY MISSION BAR */
  .mission-bar {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 12px;
    margin-bottom: 10px;
  }

  .mission-task, .mission-scenario {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .mission-scenario {
    margin-top: 5px;
    padding-top: 5px;
    border-top: 1px dashed #cbd5e1;
  }

  .mission-tag {
    font-size: 7pt;
    font-weight: 800;
    text-transform: uppercase;
    color: #5B50F5;
    letter-spacing: 0.5px;
  }

  .tag-scenario {
    color: #0284c7;
  }

  .mission-text {
    font-size: 9.5pt;
    color: #0f172a;
    font-weight: 600;
  }

  /* STEP CARDS */
  .steps-wrapper {
    margin-bottom: 10px;
  }

  .steps-header {
    margin-bottom: 7px;
  }

  .steps-flow {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .step-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 7px 11px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }

  .step-num {
    width: 22px;
    height: 22px;
    background: #5B50F5;
    color: #ffffff;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 8pt;
    font-weight: 800;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .step-content {
    flex: 1;
    min-width: 0;
  }

  .step-text {
    font-size: 8.5pt;
    color: #1e293b;
    line-height: 1.4;
  }

  /* TABLES INSIDE STEPS */
  .step-table-container {
    margin-top: 6px;
  }

  .table-scroll {
    overflow-x: auto;
  }

  .blueprint-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8pt;
    margin: 4px 0;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    overflow: hidden;
  }

  .blueprint-table th {
    background: #f1f5f9;
    color: #1e293b;
    font-weight: 700;
    text-align: left;
    padding: 5px 8px;
    border: 1px solid #cbd5e1;
    letter-spacing: 0.2px;
  }

  .blueprint-table td {
    padding: 5px 8px;
    border: 1px solid #cbd5e1;
    color: #334155;
    background: #ffffff;
  }

  .blueprint-table tr:nth-child(even) td {
    background: #f8fafc;
  }

  .blueprint-table tr.fill-in-row td {
    height: 26px;
    background: #ffffff;
    border-bottom: 1px dashed #cbd5e1;
  }

  /* REFLECTION */
  .reflection-wrapper {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 11px;
  }

  /* POST ACTIVITY */
  .post-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 9px;
  }

  .post-card {
    padding: 9px 11px;
    border-radius: 6px;
    border: 1px solid transparent;
  }

  .card-next    { background: #eff6ff; border-color: #bfdbfe; border-left: 3.5px solid #2563eb; }
  .card-levelup { background: #f0fdf4; border-color: #bbf7d0; border-left: 3.5px solid #16a34a; }

  .extend-wrapper {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 11px;
    margin-bottom: 9px;
  }

  .summary-wrapper {
    background: #fdf4ff;
    border: 1px solid #f0abfc;
    border-left: 3.5px solid #c026d3;
    border-radius: 6px;
    padding: 8px 11px;
  }

  .summary-text {
    margin: 0;
    font-size: 8.5pt;
    color: #581c87;
    line-height: 1.4;
  }

  /* TAXONOMY */
  .taxonomy-compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .tax-panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 9px 11px;
  }

  .tax-panel-title {
    font-size: 7.5pt;
    font-weight: 800;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
  }

  .tax-entry {
    margin-bottom: 6px;
  }

  .tax-entry:last-child {
    margin-bottom: 0;
  }

  .tax-key {
    display: block;
    font-size: 7pt;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 2px;
  }

  .tax-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 5px;
    font-size: 8pt;
    font-weight: 600;
  }

  .badge-indigo { background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe; }
  .badge-purple { background: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }

  .tax-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .skill-pill {
    background: #ffffff;
    color: #1e293b;
    border: 1px solid #cbd5e1;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 7.5pt;
    font-weight: 600;
  }

  .subskill-pill {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #e2e8f0;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 7pt;
  }

  .empty-badge {
    color: #94a3b8;
    font-size: 7.5pt;
  }

  /* METADATA GRID */
  .metadata-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .meta-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px 10px;
  }

  .meta-label {
    font-size: 7pt;
    font-weight: 800;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 2px;
    letter-spacing: 0.4px;
  }

  .meta-content {
    font-size: 8.5pt;
    color: #1e293b;
    line-height: 1.35;
  }

  .difficulty-tag {
    display: inline-block;
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
    padding: 1px 6px;
    border-radius: 5px;
    font-weight: 700;
    font-size: 7.5pt;
    text-transform: uppercase;
  }

  /* LINED NOTES AREA (PAGE 3) */
  .notes-section {
    margin-top: 10px;
  }

  .lined-notes-area {
    padding: 4px 0;
  }

  .note-line {
    height: 24px;
    border-bottom: 1px dashed #cbd5e1;
  }

  /* FOOTER */
  .sheet-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1.5px solid #e2e8f0;
    padding-top: 8px;
    margin-top: 12px;
    font-size: 7.5pt;
    color: #64748b;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 5px;
    font-weight: 600;
    color: #475569;
  }

  .f-dot {
    color: #5B50F5;
    font-size: 7pt;
  }

  .footer-center {
    font-weight: 500;
  }

  .footer-meta {
    color: #94a3b8;
  }

  /* ================= PRINT MEDIA OVERRIDES: 1-TO-1 FIDELITY ================= */
  @media print {
    .no-print {
      display: none !important;
    }

    html, body {
      background: #ffffff !important;
      padding: 0 !important;
      margin: 0 !important;
      width: 210mm !important;
    }

    .doc-container {
      padding: 0 !important;
      margin: 0 !important;
      background: transparent !important;
      display: block !important;
      width: 210mm !important;
    }

    .blueprint-document {
      display: block !important;
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .blueprint-page {
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 12mm 15mm 10mm !important;
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: auto !important;
      break-inside: auto !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      box-sizing: border-box !important;
    }

    .blueprint-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }

    /* Print color fidelity */
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

export function exportActivityToPdf(data: ExportData, options?: ExportOptions): void {
  const title = data.activity_name || data.title || data.activity_title || "OCTAKIDZ Activity";
  const printHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} - OCTA KIDS Activity Blueprint</title>
  <style>${COMMON_PDF_CSS}</style>
</head>
<body>
  <div class="no-print preview-toolbar">
    <div class="toolbar-left">
      <div class="brand-logo">
        <span class="logo-circle">O</span>
        <span class="logo-name">OCTA<b>KIDS</b></span>
      </div>
      <span class="toolbar-divider">|</span>
      <span class="toolbar-title">${escapeHtml(title)}</span>
    </div>
    <div class="toolbar-right">
      <button class="btn-print" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Print / Save as PDF
      </button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="doc-container">
    ${renderActivityHtml(data, 1, options, 1)}
  </div>

  <script>
    function triggerPrint() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Auto-print deferred to manual button:', e);
        }
      }, 400);
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      triggerPrint();
    } else {
      window.addEventListener('DOMContentLoaded', triggerPrint);
      window.addEventListener('load', triggerPrint);
    }
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
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OCTA KIDS Batch Activity Export (${activities.length} Activities)</title>
  <style>${COMMON_PDF_CSS}</style>
</head>
<body>
  <div class="no-print preview-toolbar">
    <div class="toolbar-left">
      <div class="brand-logo">
        <span class="logo-circle">O</span>
        <span class="logo-name">OCTA<b>KIDS</b></span>
      </div>
      <span class="toolbar-divider">|</span>
      <span class="toolbar-title">Batch Activity Export (${activities.length} Activities)</span>
    </div>
    <div class="toolbar-right">
      <button class="btn-print" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        Print / Save as PDF
      </button>
      <button class="btn-close" onclick="window.close()">Close</button>
    </div>
  </div>

  <div class="doc-container">
    ${activities.map((act, idx) => renderActivityHtml(act, idx + 1, options, activities.length)).join("\n")}
  </div>

  <script>
    function triggerPrint() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.warn('Auto-print deferred to manual button:', e);
        }
      }, 400);
    }
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      triggerPrint();
    } else {
      window.addEventListener('DOMContentLoaded', triggerPrint);
      window.addEventListener('load', triggerPrint);
    }
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
