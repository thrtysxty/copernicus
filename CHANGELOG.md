# Changelog

All notable changes to Copernicus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-05-18

### Added
- Initial community release of Copernicus
- Agentic IDE with Electron + React + Vite frontend and Python Flask backend
- 7 LLM providers: Anthropic, OpenAI, Google Gemini, Ollama, DeepSeek, OpenRouter, local MLX
- Workflow engine with state machine, role-based agent dispatch, and worktree isolation
- Episodic memory with time-decay scoring and importance weighting
- Context management with RAG injection, budget-aware truncation, and hybrid retrieval
- Jules integration with async PR agent, deduplication, and monitoring
- CapEx analytics with composite scoring
- Extension system with trust store and capability enforcement
- Security layer: path traversal protection, env sanitization, pattern detection, HMAC verification
- Rate limiting: 200/min default, 30/min for LLM, 10/min for research
- Electron sandbox enabled: contextIsolation, no nodeIntegration

### Security
- Fixed CORS wildcard in Socket.IO — now uses configurable ALLOWED_ORIGINS
- Added React ErrorBoundary for crash resilience
- Fixed empty catch blocks with proper error logging
- Added PR validation CI workflow

### Changed
- Made ALLOWED_ORIGINS configurable via environment variable
- Removed personal paths and references from codebase
- Gitignored development artifacts (sessions, sprints, stories, personas, etc.)

### Infrastructure
- Added CODE_OF_CONDUCT.md (Contributor Covenant v2.1)
- Added SECURITY.md with vulnerability reporting process
- Added PR validation GitHub Actions workflow
- Added .gitignore patterns for env.local and config.env
