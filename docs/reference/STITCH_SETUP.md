# Google Stitch Setup

*Version: 2.0*
*Date: 2026-03-28*

Google Stitch exposes an SDK-based integration that gives any connected agent access to real design specs — HTML/CSS exports, design token DNA (fonts, colors, spacing), screenshots, and route maps.

## 1. Prerequisites
- Access to the Google Stitch dashboard.

## 2. Authentication
To authenticate your local machine:
- Navigate to the Google Stitch dashboard.
- Generate and copy a new Stitch API key.

## 3. Finding your IDs
- **Google Cloud Project ID:** Locate this in the Google Cloud Console dashboard. This is the alphanumeric string (e.g. `my-project-123456`).
- **Screen ID:** Navigate to the specific screen in the Stitch dashboard. The screen ID is the unique identifier found in the URL.

## 4. Usage in Copernicus
- Go to Settings > Providers.
- Locate the "Google Stitch" tile.
- Enter your Stitch API key directly and click **Test Connection** to verify setup.
- In the **Designer** panel, use the new **Import from Stitch** to fetch ghost code based on a Screen ID, or **Verify with Stitch** to compare your current implementation against the design spec using the integrated Chat Assistant.
- You can also manually attach Stitch Screenshots within the Chat Panel by selecting the **Stitch Screenshot** option from the attachment menu (paperclip).

## 5. Migration Note
If you are an existing user who previously set up Stitch via `gcloud`:
- The new API key authentication entirely replaces `gcloud` credentials.
- The `GOOGLE_CLOUD_PROJECT` environment variable is no longer required and can be safely removed from your environment.
