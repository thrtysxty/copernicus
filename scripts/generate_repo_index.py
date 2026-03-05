#!/usr/bin/env python3
import os
import json
import sys

# Directory to ignore to keep the index clean and lightweight
IGNORE_DIRS = {
    '.git', 'node_modules', 'dist', 'dist-electron', 'release', 
    '__pycache__', '.ruff_cache', '.vscode', '.gemini', 'tmp'
}

def build_tree(root_path):
    """
    Recursively builds a tree of the repository.
    """
    tree = {
        "name": os.path.basename(root_path) or ".",
        "type": "directory",
        "children": []
    }
    
    try:
        entries = os.listdir(root_path)
    except PermissionError:
        return None

    for entry in sorted(entries):
        if entry in IGNORE_DIRS:
            continue
            
        full_path = os.path.join(root_path, entry)
        
        if os.path.isdir(full_path):
            child_tree = build_tree(full_path)
            if child_tree:
                tree["children"].append(child_tree)
        else:
            tree["children"].append({
                "name": entry,
                "type": "file"
            })
            
    return tree

def get_logical_clusters(root_path):
    """
    Identifies key logical clusters in the repo to provide high-level context.
    """
    clusters = {
        "Electron Backend (Main)": "copernicus/electron",
        "Frontend (Renderer)": "copernicus/src/renderer",
        "Backend API (Python)": "backend",
        "Scripts & Tools": "scripts",
        "Documentation & Stories": "docs"
    }
    
    available = {}
    for name, path in clusters.items():
        if os.path.exists(os.path.join(root_path, path)):
            available[name] = path
            
    return available

def main():
    root = os.getcwd()
    print(f"Generating index for {root}...")
    
    index = {
        "project_name": os.path.basename(root),
        "logical_clusters": get_logical_clusters(root),
        "structure": build_tree(root)
    }
    
    output_path = os.path.join(root, "repo_index.json")
    with open(output_path, "w") as f:
        json.dump(index, f, indent=2)
        
    print(f"Index successfully written to {output_path}")

if __name__ == "__main__":
    main()
