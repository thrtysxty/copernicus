# Google Stitch MCP Setup

Google Stitch exposes an MCP server that gives any connected agent access to real design specs — HTML/CSS exports, design token DNA (fonts, colors, spacing), screenshots, and route maps.

## 1. Prerequisites
- `gcloud` CLI installed and authenticated.
- Google Cloud project with the Stitch API enabled.
- `GOOGLE_CLOUD_PROJECT` environment variable set or explicitly provided in the settings panel.

## 2. Authentication
Run the following to authenticate your local machine:
```bash
gcloud auth login
gcloud auth application-default login
```

## 3. Finding your IDs
- **Google Cloud Project ID:** Locate this in the Google Cloud Console dashboard. This is the alphanumeric string (e.g. `my-project-123456`).
- **Screen ID:** Navigate to the specific screen in the Stitch dashboard. The screen ID is the unique identifier found in the URL.

## 4. Usage in Copernicus
- Go to Settings > MCP Servers.
- Locate the "Google Stitch MCP" tile.
- Enter your Google Cloud Project ID and click **Test Connection** to verify setup.
- In the **Designer** panel, use the new **Import from Stitch** to fetch ghost code based on a Screen ID, or **Verify with Stitch** to compare your current implementation against the design spec using the integrated Chat Assistant.
- You can also manually attach Stitch Screenshots within the Chat Panel by selecting the **Stitch Screenshot** option from the attachment menu (paperclip).
