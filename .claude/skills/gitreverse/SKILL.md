---
name: gitreverse
description: Given a GitHub repo URL, reverse-engineers it into a scaffolding prompt a novice can use to build something similar from scratch.
---

# /gitreverse

Given a GitHub repository URL, analyze the repo's structure and purpose, then produce a clean scaffolding prompt that would generate a comparable project from scratch. Useful for learning from existing projects, onboarding to unfamiliar patterns, or giving a novice a launchpad.

## Input

The argument is a GitHub repo URL. Examples:
- `/gitreverse https://github.com/filiksyos/gitreverse`
- `/gitreverse https://github.com/owner/repo`

If no URL is provided, ask the user for one before proceeding.

## Steps

1. **Fetch repo metadata** using `mcp__tavily__tavily_extract` on the GitHub URL to get the README and repo description. If Tavily is unavailable, use `WebFetch` on `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/README.md`.

2. **Fetch file tree** via the GitHub API:
   ```
   https://api.github.com/repos/<owner>/<repo>/git/trees/HEAD?recursive=1
   ```
   Use `WebFetch` to get this. Extract the `tree` array and filter to files only (not subtrees) — keep paths, ignore blobs.

3. **Analyze** the repo:
   - Primary language and framework (from file extensions + README)
   - Top-level directory structure and what each folder represents
   - Key config files (package.json, pyproject.toml, Makefile, Dockerfile, etc.)
   - Core entry points (main file, index, app.py, etc.)
   - Notable patterns (monorepo, MVC, layered architecture, CLI, library, etc.)
   - External dependencies (parse package.json/requirements.txt/Cargo.toml if available)

4. **Generate the scaffolding prompt** — a self-contained prompt a novice could paste into Claude or Copernicus to build something structurally similar. The prompt should:
   - Open with a one-sentence description of what the project does
   - Specify the stack, directory structure, and key files to create
   - Include setup instructions (install deps, run dev server, etc.)
   - Name the key abstractions and how they relate
   - Be under 400 words — dense but not exhausting
   - Be written as if explaining to someone building it for the first time

5. **Output** to the user:
   - A brief summary of what the repo is (2-3 sentences)
   - The full scaffolding prompt in a fenced code block (so it's easy to copy)
   - One line noting what's interesting or novel about the approach (optional, skip if nothing stands out)

## Notes

- Do not include the original repo's specific business logic or domain content — the prompt should produce a *structurally similar* blank-slate project, not a clone.
- If the repo is private or returns a 404, say so and stop.
- If the tree fetch fails, work from the README alone — note the limitation.
- Keep the generated prompt language-agnostic where possible; when the stack is specific, match it.
