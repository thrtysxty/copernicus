# CONFIG_REFERENCE.md — Developer Documentation Suite

This document provides a comprehensive reference for all configuration settings and secrets used by the Copernicus IDE, detailing their purpose, default values, and how to obtain or configure them.

## 1. User Secrets (`~/.secrets`)

The `~/.secrets` file, located in your home directory, is used to store sensitive API keys and tokens. It is sourced by Copernicus scripts and must **not** be committed to version control.

**Location**: `~/.secrets`

**Example Content**:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export JULES_API_KEY="YOUR_JULES_API_KEY"
export GITHUB_TOKEN="ghp_..."
export OPENAI_API_KEY="sk-..."
export OPENROUTER_API_KEY="sk-or-..."
export DEEPINFRA_API_KEY="YOUR_DEEPINFRA_API_KEY"
export GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"
export TAVILY_API_KEY="tvly-..."
```

**Details**:

| Key | Purpose | How to Obtain / Where Used |
| :---------------- | :------------------------------------------------ | :--------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | API key for Anthropic models (Claude). | Obtain from [Anthropic Console](https://console.anthropic.com/). Used for Claude-based inference. |
| `JULES_API_KEY` | API key for the Jules async coding agent. | Obtain from [Jules Console](https://jules.google.com/settings). Used for dispatching stories to Jules. |
| `GITHUB_TOKEN` | GitHub Personal Access Token. | Generate from [GitHub Developer Settings](https://github.com/settings/tokens). Used for GitHub API interactions (e.g., PR creation by Jules). |
| `OPENAI_API_KEY` | API key for OpenAI models (GPT-4, GPT-3.5). | Obtain from [OpenAI Platform](https://platform.openai.com/). Used for OpenAI-based inference. |
| `OPENROUTER_API_KEY` | API key for OpenRouter, aggregating multiple models. | Obtain from [OpenRouter](https://openrouter.ai/keys). Used for routing to various models. |
| `DEEPINFRA_API_KEY` | API key for DeepInfra models. | Obtain from [DeepInfra](https://deepinfra.com/). Used for cost-efficient open-weight inference. |
| `GOOGLE_API_KEY` | API key for Google models (Gemini, PaLM). | Obtain from [Google Cloud Console](https://console.cloud.google.com/apis/credentials). Used for Google-based inference. |
| `TAVILY_API_KEY` | API key for Tavily AI, a search API. | Obtain from [Tavily AI](https://tavily.com/). Used by agents for web search capabilities. |

**To Set Up**: Copy `secrets.example` to `~/.secrets` and populate with your keys.

## 2. Application Configuration (`config.env`)

The `config.env` file contains environment variables that configure the Copernicus application's behavior. This file should also **not** be committed to version control.

**Location**:
-   **macOS**: `~/Library/Application Support/copernicus/config.env`
-   **Linux**: `~/.config/copernicus/config.env`
-   **Windows**: `%APPDATA%/copernicus/config.env`

**Example Content**:
```bash
# Remote Ollama inference server (leave blank for local localhost:11434)
# OLLAMA_BASE_URL=http://your-ollama-server:11434

# Flask backend port (default: 5001)
# COPERNICUS_BACKEND_PORT=5001

# Log level: DEBUG | INFO | WARNING | ERROR (default: INFO)
# COPERNICUS_LOG_LEVEL=INFO

# Jules daemon polling interval in seconds (default: 30)
# JULES_POLL_INTERVAL=30

# Developer hourly rate for CapEx cost attribution in USD (default: 150)
# DEVELOPER_RATE=150
```

**Details**:

| Environment Variable | Default Value | Valid Values | Purpose |
| :------------------- | :------------ | :----------- | :--------------------------------------------------------------------------- |
| `OLLAMA_BASE_URL` | (blank) | Valid URL (e.g., `http://localhost:11434`) | Specifies the URL of a remote Ollama inference server. If blank, it defaults to `http://localhost:11434`. |
| `COPERNICUS_BACKEND_PORT` | `5001` | Any valid unoccupied port number. | The port on which the Flask backend API listens. |
| `COPERNICUS_LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` | Sets the logging verbosity for the Copernicus application. |
| `JULES_POLL_INTERVAL` | `30` | Positive integer (seconds). | The interval at which the `jules_daemon.py` script polls for active Jules sessions. |
| `DEVELOPER_RATE` | `150` | Positive number (USD/hr). | The hourly rate used for calculating CapEx (Capital Expenditure) costs for developer time in the financial telemetry. |

**To Set Up**: The `bash scripts/dev-setup.sh` script typically handles the creation and initial population of this file.

## 3. Compile-Time Constants

Compile-time constants are embedded directly into the Electron main process or renderer build. These are typically defined in TypeScript files within the `copernicus/electron/` directory, often in files named `config.ts` or `constants.ts`, or directly within modules where they are used. Due to their nature, they are not user-configurable at runtime via environment variables in `config.env` or `~/.secrets`.

## 4. MCP Hub Configuration (`claude_mcp_config.json`)

The `claude_mcp_config.json` file (or similar configuration) defines how the Codebase Memory Platform (MCP) hub is registered and interacted with. Following Story 527 (MCP hub as a service), this file would contain the necessary configuration for the Copernicus Electron application to connect to and utilize a single, centralized MCP hub. This typically includes endpoints, authentication details, and project registration information for the MCP server.

## 5. Platform Data Directory Paths

User-specific application data, including databases and configuration files, are stored in platform-specific locations:

-   **macOS**: `~/Library/Application Support/copernicus/`
-   **Linux**: `~/.config/copernicus/`
-   **Windows**: `%APPDATA%/copernicus/`
