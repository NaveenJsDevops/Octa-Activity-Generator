import io
import re
from typing import Any, Dict, List, Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

def _sanitize_filename(name: str) -> str:
    """Sanitizes filename against path traversal, CRLF injection, and illegal characters."""
    cleaned = re.sub(r'[\r\n\\/*?:"<>|\x00-\x1f]', "", str(name))
    return cleaned.strip()[:60] or "activity"

def _sanitize_sheet_title(name: str, index: int) -> str:
    """Sanitizes and bounds Excel sheet titles strictly within 31 characters."""
    cleaned = re.sub(r'[\r\n\\/*?:"<>|\[\]\'\x00-\x1f]', "", str(name)).strip()
    prefix = f"{index}. "
    max_len = max(5, 31 - len(prefix))
    truncated = cleaned[:max_len].strip() if cleaned else f"Activity {index}"
    sheet_title = f"{prefix}{truncated}"
    return sheet_title[:31]

def _write_activity_sheet(ws, data: Dict[str, Any], options: Optional[Dict[str, bool]] = None):
    """Writes a complete OCTAKIDZ activity specification into a worksheet with optional section controls."""
    opts = options or {}
    inc_mappings = opts.get("include_carried_forward_mappings", True)
    inc_parent = opts.get("include_parent_guidance", True)
    inc_metadata = opts.get("include_educational_metadata", True)

    ws.views.sheetView[0].showGridLines = True

    font_family = "Segoe UI"
    banner_fill = PatternFill(start_color="5B50F5", end_color="5B50F5", fill_type="solid")
    banner_font = Font(name=font_family, size=14, bold=True, color="FFFFFF")

    section_fill = PatternFill(start_color="EEF0FF", end_color="EEF0FF", fill_type="solid")
    section_font = Font(name=font_family, size=11, bold=True, color="4338CA")

    label_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    label_font = Font(name=font_family, size=10, bold=True, color="475569")
    value_font = Font(name=font_family, size=10, color="1E293B")

    thin_border_side = Side(border_style="thin", color="E2E8F0")
    border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    # Title Banner
    ws.merge_cells("A1:B1")
    cell_a1 = ws["A1"]
    cell_a1.value = "OCTAKIDZ AI ACTIVITY SPECIFICATION"
    cell_a1.font = banner_font
    cell_a1.fill = banner_fill
    cell_a1.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 36

    current_row = 3

    def write_section_header(title: str):
        nonlocal current_row
        ws.merge_cells(f"A{current_row}:B{current_row}")
        cell = ws[f"A{current_row}"]
        cell.value = title.upper()
        cell.font = section_font
        cell.fill = section_fill
        cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        ws.row_dimensions[current_row].height = 24
        current_row += 1

    def write_field(label: str, value: Any):
        nonlocal current_row
        val_str = ""
        if isinstance(value, list):
            val_str = "\n".join(f"• {item}" for item in value if item)
        elif value is not None:
            val_str = str(value).strip()
        if not val_str:
            val_str = "—"

        cell_lbl = ws[f"A{current_row}"]
        cell_lbl.value = label
        cell_lbl.font = label_font
        cell_lbl.fill = label_fill
        cell_lbl.alignment = Alignment(horizontal="left", vertical="top")
        cell_lbl.border = border

        cell_val = ws[f"B{current_row}"]
        cell_val.value = val_str
        cell_val.font = value_font
        cell_val.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True)
        cell_val.border = border

        # Defensive dynamic row-height calculation (clamped between 20 and 400)
        lines = val_str.count("\n") + (len(val_str) // 80) + 1
        ws.row_dimensions[current_row].height = max(20, min(lines * 17, 400))
        current_row += 1

    # 1. Activity Overview
    write_section_header("1. Activity Overview")
    title = data.get("activity_name") or data.get("title") or data.get("activity_title") or "Activity"
    write_field("Activity Name", title)
    duration = data.get("activity_duration") or f"{data.get('estimated_duration', 30)} minutes"
    write_field("Duration", duration)
    write_field("Topic", data.get("topic_title") or data.get("topic") or "—")
    write_field("Topic Family", data.get("topic_family_name") or "—")
    age_min = data.get("age_min")
    age_max = data.get("age_max")
    if age_min is not None and age_max is not None:
        write_field("Target Age Range", f"{age_min}–{age_max} years")
    write_field("Target Class / Grade", data.get("target_class") or "—")
    write_field("Country / Context", data.get("country_context") or "—")
    if data.get("keywords"):
        kw = data.get("keywords")
        write_field("Keywords", kw if isinstance(kw, list) else [kw])

    # 2. Carried-Forward Parameters & Intelligence Mapping (Optional)
    if inc_mappings:
        current_row += 1
        write_section_header("2. Carried-Forward Intelligence, Skills & Sub-Skills")
        mappings = data.get("mappings") or {}
        user_sel = mappings.get("user_selected") or {}
        sugg = mappings.get("suggested") or {}

        u_intel = user_sel.get("intelligence") or data.get("user_selected_intelligence") or "None (Open Discovery)"
        u_skills = user_sel.get("skills") or data.get("user_selected_skills") or []
        u_sub_skills = user_sel.get("sub_skills") or data.get("user_selected_sub_skills") or []
        write_field("User-Selected Intelligence", u_intel)
        write_field("User-Selected Skills", u_skills if u_skills else "None")
        write_field("User-Selected Sub-Skills", u_sub_skills if u_sub_skills else "None")

        s_intel = sugg.get("intelligence") or data.get("suggested_intelligence") or "—"
        s_skills = sugg.get("skills") or data.get("suggested_skills") or []
        s_sub_skills = sugg.get("sub_skills") or data.get("suggested_sub_skills") or []
        write_field("AI-Suggested Intelligence", s_intel)
        write_field("AI-Suggested Skills", s_skills if s_skills else "—")
        write_field("AI-Suggested Sub-Skills", s_sub_skills if s_sub_skills else "—")

    # 3. Pre-Activity
    current_row += 1
    write_section_header("3. Pre-Activity (Preparation & Engagement)")
    pre = data.get("pre_activity") or {}
    write_field("Activity Description", pre.get("activity_description") or data.get("description") or "—")
    if inc_parent:
        write_field("Parent's Note", pre.get("parents_note") or "—")
        write_field("Parent's Guide", pre.get("parents_guide") or "Not required")
    write_field("Pre-Activity Engagement", pre.get("pre_activity_engagement") or [])
    write_field("Why/How Is This Important?", pre.get("why_how_is_this_important") or data.get("why_engaging") or "—")
    write_field("Let's Get Started!", pre.get("lets_get_started") or data.get("learner_task") or "—")

    # 4. Main Activity
    current_row += 1
    write_section_header("4. Main Activity (Step-by-Step Process)")
    main = data.get("main_activity") or {}
    write_field("Activity Step / Task Title", main.get("activity_step_task_title") or data.get("learner_task") or "—")
    write_field("Scenario / Real-Life Connection", main.get("scenario_real_life_connection") or "—")
    
    in_depth = main.get("in_depth_description_and_process") or data.get("instructions") or []
    if isinstance(in_depth, list):
        steps_formatted = [f"Step {idx + 1}: {step}" for idx, step in enumerate(in_depth)]
        write_field("Process & Steps", steps_formatted)
    else:
        write_field("Process & Steps", in_depth)

    write_field("Reflection Questions", main.get("reflection_questions") or [])

    # 5. Post-Activity
    current_row += 1
    write_section_header("5. Post-Activity (Extension & Reflection)")
    post = data.get("post_activity") or {}
    write_field("What's Next", post.get("whats_next") or "—")
    write_field("Extend the Learning", post.get("extend_the_learning") or [])
    write_field("How to Improvise / Level Up", post.get("how_to_improvise_or_level_up") or "—")
    write_field("Post-Activity Summary", post.get("post_activity_summary") or data.get("expected_output") or "—")

    # 6. Additional Metadata (Optional)
    if inc_metadata:
        current_row += 1
        write_section_header("6. Educational Metadata & Resources")
        write_field("Learning Objective", data.get("learning_objective") or "—")
        materials = data.get("materials") or []
        if isinstance(materials, str):
            try:
                import json
                materials = json.loads(materials)
            except Exception:
                materials = [materials]
        write_field("Materials Required", materials)
        write_field("Assessment Criteria", data.get("assessment_criteria") or "—")
        write_field("Difficulty Level", data.get("difficulty_level") or "—")

    # Set Column Widths
    ws.column_dimensions["A"].width = 32
    ws.column_dimensions["B"].width = 85

def generate_activity_excel(data: Dict[str, Any], options: Optional[Dict[str, bool]] = None) -> io.BytesIO:
    """Generates an Excel workbook for a single activity with optional section toggles."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "OCTAKIDZ Activity"
    _write_activity_sheet(ws, data, options)
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output

def generate_batch_activities_excel(
    activities: List[Dict[str, Any]],
    options: Optional[Dict[str, bool]] = None
) -> io.BytesIO:
    """Generates a comprehensive multi-worksheet Excel workbook for multiple activities with optional section toggles."""
    wb = openpyxl.Workbook()
    
    # 1. Summary Sheet
    summary_ws = wb.active
    summary_ws.title = "Activities Overview"
    summary_ws.views.sheetView[0].showGridLines = True

    font_family = "Segoe UI"
    header_fill = PatternFill(start_color="5B50F5", end_color="5B50F5", fill_type="solid")
    header_font = Font(name=font_family, size=11, bold=True, color="FFFFFF")
    
    row_font = Font(name=font_family, size=10, color="1E293B")
    thin_border_side = Side(border_style="thin", color="E2E8F0")
    border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)

    # Title block
    summary_ws.merge_cells("A1:H1")
    title_cell = summary_ws["A1"]
    title_cell.value = f"OCTAKIDZ EXPORTED ACTIVITIES BATCH ({len(activities)} ACTIVITIES)"
    title_cell.font = Font(name=font_family, size=14, bold=True, color="FFFFFF")
    title_cell.fill = header_fill
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    summary_ws.row_dimensions[1].height = 36

    headers = [
        ("#", 6),
        ("Activity Title", 35),
        ("Topic", 30),
        ("Duration", 16),
        ("Target Age", 16),
        ("Grade / Class", 18),
        ("Intelligence", 20),
        ("Skills", 30),
    ]

    summary_ws.row_dimensions[3].height = 24
    for col_idx, (col_name, col_width) in enumerate(headers, start=1):
        cell = summary_ws.cell(row=3, column=col_idx)
        cell.value = col_name
        cell.font = header_font
        cell.fill = PatternFill(start_color="4338CA", end_color="4338CA", fill_type="solid")
        cell.alignment = Alignment(horizontal="center" if col_idx in [1, 4, 5] else "left", vertical="center")
        cell.border = border
        col_letter = get_column_letter(col_idx)
        summary_ws.column_dimensions[col_letter].width = col_width

    for row_idx, act in enumerate(activities, start=4):
        summary_ws.row_dimensions[row_idx].height = 22
        title = act.get("activity_name") or act.get("title") or act.get("activity_title") or "Activity"
        topic = act.get("topic_title") or act.get("topic") or "—"
        duration = act.get("activity_duration") or f"{act.get('estimated_duration', 30)} mins"
        age = f"{act.get('age_min', '')}–{act.get('age_max', '')} yrs" if act.get("age_min") is not None else "—"
        grade = act.get("target_class") or "—"
        
        mappings = act.get("mappings") or {}
        user_sel = mappings.get("user_selected") or {}
        sugg = mappings.get("suggested") or {}
        intel = user_sel.get("intelligence") or act.get("user_selected_intelligence") or sugg.get("intelligence") or act.get("suggested_intelligence") or "—"
        
        skills = user_sel.get("skills") or act.get("user_selected_skills") or sugg.get("skills") or act.get("suggested_skills") or []
        if isinstance(skills, list):
            skills_str = ", ".join(skills)
        else:
            skills_str = str(skills)

        row_vals = [
            row_idx - 3,
            title,
            topic,
            duration,
            age,
            grade,
            intel,
            skills_str or "—",
        ]

        for col_idx, val in enumerate(row_vals, start=1):
            cell = summary_ws.cell(row=row_idx, column=col_idx)
            cell.value = val
            cell.font = row_font
            cell.alignment = Alignment(horizontal="center" if col_idx in [1, 4, 5] else "left", vertical="center")
            cell.border = border
            if (row_idx % 2) == 1:
                cell.fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")

    # 2. Individual Activity Sheets
    for idx, act in enumerate(activities, start=1):
        title = act.get("activity_name") or act.get("title") or act.get("activity_title") or f"Activity {idx}"
        sheet_title = _sanitize_sheet_title(title, idx)
        ws = wb.create_sheet(title=sheet_title)
        _write_activity_sheet(ws, act, options)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output
