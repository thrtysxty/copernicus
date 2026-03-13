#!/usr/bin/env python3
import sys
import os
import json
import subprocess
import argparse
import re

def run_tsc(workspace_root, file_filter=None):
    copernicus_dir = os.path.join(workspace_root, 'copernicus')
    if not os.path.exists(copernicus_dir):
        return []
    
    cmd = ["npx", "tsc", "--noEmit", "--pretty", "false"]
    try:
        # tsc exits with 2 if there are errors, 0 if clean
        result = subprocess.run(cmd, cwd=copernicus_dir, capture_output=True, text=True)
        output = result.stdout
    except Exception as e:
        return [{"file": "", "line": 0, "col": 0, "severity": "error", "message": f"Failed to run tsc: {e}", "code": "system"}]

    diagnostics = []
    # format: file(line,col): error TSxxxx: message
    # or sometimes Warning ...
    pattern = re.compile(r"^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+([A-Z0-9]+):\s+(.+)$")
    
    for line in output.splitlines():
        line = line.strip()
        if not line:
            continue
        
        match = pattern.match(line)
        if match:
            file_path = match.group(1)
            line_num = match.group(2)
            col_num = match.group(3)
            severity = match.group(4)
            code = match.group(5)
            message = match.group(6)
            
            if file_filter and file_filter not in file_path:
                continue
                
            diagnostics.append({
                "file": file_path,
                "line": int(line_num),
                "col": int(col_num),
                "severity": severity.lower(),
                "code": code,
                "message": message
            })
    
    return diagnostics

def run_ruff(workspace_root, file_filter=None):
    cmd = ["ruff", "check", "--output-format", "json"]
    try:
        result = subprocess.run(cmd, cwd=workspace_root, capture_output=True, text=True)
        output = result.stdout
        
        if not output.strip():
            return []
            
        data = json.loads(output)
        diagnostics = []
        for item in data:
            file_path = item.get("filename", "")
            
            if file_filter and file_filter not in file_path:
                continue
                
            location = item.get("location", {})
            diagnostics.append({
                "file": file_path,
                "line": location.get("row", 0),
                "col": location.get("column", 0),
                "severity": "error",
                "code": item.get("code", ""),
                "message": item.get("message", "")
            })
        return diagnostics
    except Exception as e:
        return []

def main():
    parser = argparse.ArgumentParser(description="Get workspace diagnostics")
    parser.add_argument("--file", type=str, help="Filter diagnostics by file path", default=None)
    
    args = parser.parse_args()
    workspace_root = os.environ.get("COPERNICUS_WORKSPACE", ".")
    
    tsc_diagnostics = run_tsc(workspace_root, args.file)
    ruff_diagnostics = run_ruff(workspace_root, args.file)
    
    all_diagnostics = tsc_diagnostics + ruff_diagnostics
    
    errors = [d for d in all_diagnostics if d.get("severity") == "error"]
    warnings = [d for d in all_diagnostics if d.get("severity") == "warning"]
    
    response = {
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "errors": errors,
        "warnings": warnings
    }
    
    print(json.dumps(response))

if __name__ == "__main__":
    main()
