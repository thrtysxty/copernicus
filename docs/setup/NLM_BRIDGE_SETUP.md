# NotebookLM MCP Bridge Setup

The COPERNICUS IDE uses an unofficial MCP bridge to interact with Google's NotebookLM for querying business intelligence documents, strategies, and plans directly from your agent context.

Because there is no official API from Google, this uses `teng-lin/notebooklm-py`, which relies on cookie-based authentication. This bridge works best as a best-effort intelligence augmentation layer.

## Prerequisites

1. **Python 3.10+**
2. **Pip**

## Installation

Run the following command to install the `notebooklm-py` package:

```bash
pip install notebooklm-py
```

## Authentication

NotebookLM uses your Google account's session cookies. We need to perform a one-time Playwright-based login to export these cookies to `~/.secrets/nlm-cookies.json`.

1. Ensure the `~/.secrets` directory exists:
   ```bash
   mkdir -p ~/.secrets
   ```

2. Run the authentication command. A Playwright browser will open:
   ```bash
   python3 -m notebooklm auth
   ```

3. Follow the Google login steps in the opened browser. Once you are successfully logged into NotebookLM, the script will capture the cookies and save them to `~/.secrets/nlm-cookies.json`.

You only need to repeat this step if your session expires or if you sign out from the browser session.

## Configuration in COPERNICUS

The `claude_mcp_config.json` inside COPERNICUS is automatically configured to point to `python3 -m notebooklm mcp` with the `NLM_COOKIE_FILE` environment variable set to your generated cookie file.

### Finding Notebook IDs

To register a notebook in the IDE's Intelligence Manager, you need its Notebook ID.

1. Go to your [NotebookLM Dashboard](https://notebooklm.google.com/)
2. Open the notebook you want to link
3. Check the URL in your browser:
   `https://notebooklm.google.com/notebook/12345abcd-6789-efgh-ijkl-mnopqrstuvwx`
4. The Notebook ID is the part after `/notebook/`, in this case `12345abcd-6789-efgh-ijkl-mnopqrstuvwx`.
