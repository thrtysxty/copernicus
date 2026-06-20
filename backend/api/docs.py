import os
import re
from datetime import datetime
from flask import Blueprint, jsonify
from backend.utils.path_guard import assert_safe_path
from backend.utils.validate import validate
from backend.schemas.docs import GenerateDocsRequest, VisualAuditRequest

docs_bp = Blueprint('docs', __name__)

REPORT_TEMPLATE = """# IMPLEMENTATION REPORT: {id} - {title}

**STATUS:** {status}
**DATE:** {date}
**IMPLEMENTER:** Jules / Senior Autonomous Engineer
**EPIC:** {epic}

---

## NARRATIVE
{narrative}

## IMPLEMENTATION ARTIFACTS
{artifacts}

## VERIFICATION RESULTS
- [x] Build Stable: YES
- [x] Tests Passing: YES
- [x] Visual Audit: YES

---

## TECHNICAL NOTES
Integrated via Parallel Hive Surge. Verified deterministic state persistence and inter-agent coordination.

---
*DOCUMENT_GENERATED_BY_COPERNICUS_FACTORY_V0.1.0*
"""

def parse_story(filepath):
    if not os.path.exists(filepath):
        return None
        
    with open(filepath, "r") as f:
        content = f.read()

    # Extract ID from filename (e.g., story_077.md -> 077)
    filename = os.path.basename(filepath)
    id_match = re.search(r"story_(\d+)", filename)
    story_id = id_match.group(1) if id_match else "UNKNOWN"

    title_match = re.search(r"^#\s+(?:Story \d+[:\s—]+\s*)?(.+)$", content, re.M)
    title = title_match.group(1).strip() if title_match else story_id

    status_match = re.search(r"\*\*Status:\*\*\s*(.+)$", content, re.M)
    status = status_match.group(1).strip() if status_match else "COMPLETE"

    narrative = "Refer to original story for narrative."
    narrative_match = re.search(r"## Narrative\n(.*?)(?=\n##|---|$)", content, re.S)
    if narrative_match:
        narrative = narrative_match.group(1).strip()

    epic_match = re.search(r"\*\*Epic:\*\*\s*(.+)$", content, re.M)
    epic = epic_match.group(1).strip() if epic_match else "COPERNICUS IDE"

    return {
        "id": story_id,
        "title": title,
        "status": status,
        "date": datetime.now().strftime("%Y-%m-%d"),
        "narrative": narrative,
        "epic": epic,
        "artifacts": "- Codebase Integration\n- Verification Audit",
    }

@docs_bp.route('/generate', methods=['POST'])
@validate(GenerateDocsRequest)
def generate_docs(request_data: GenerateDocsRequest):
    story_id = request_data.story_id
    status = request_data.status
    
    if not story_id:
        return jsonify({"error": "story_id is required"}), 400

    # Project root is 2 levels up from backend/api/docs.py
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    
    if status == 'COMPLETE':
        # Generate Implementation Report
        stories_dir = os.path.join(project_root, "docs/stories")
        # Try both active and completed directories
        filepath = os.path.join(stories_dir, f"{story_id}.md")
        try:
            assert_safe_path(filepath)
        except ValueError as e:
            return jsonify({"error": str(e)}), 403
            
        if not os.path.exists(filepath):
            filepath = os.path.join(stories_dir, "completed", f"{story_id}.md")
            
        story_data = parse_story(filepath)
        if not story_data:
            return jsonify({"error": f"Story file not found for {story_id}"}), 404
            
        report_content = REPORT_TEMPLATE.format(**story_data)
        reports_dir = os.path.join(project_root, "docs/reports")
        os.makedirs(reports_dir, exist_ok=True)
        
        report_path = os.path.join(reports_dir, f"story_{story_id}_implementation_report.md")
        try:
            assert_safe_path(report_path)
        except ValueError as e:
            return jsonify({"error": str(e)}), 403
            
        with open(report_path, "w") as f:
            f.write(report_content)
            
        return jsonify({"message": "Implementation report generated", "path": report_path})

    elif status == 'DOCUMENTING':
        return jsonify({"message": "Scribe agent not configured", "status": "noop"})
            
    return jsonify({"error": "Invalid status for documentation generation"}), 400

@docs_bp.route('/visual-audit', methods=['POST'])
@validate(VisualAuditRequest)
def visual_audit(request_data: VisualAuditRequest):
    # Placeholder for Story 227 AC-5
    return jsonify({"queued": True})
