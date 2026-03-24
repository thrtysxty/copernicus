# GOOGLE_OAUTH_SETUP.md — Developer Documentation Suite

This guide provides a comprehensive walkthrough for setting up Google OAuth 2.0 credentials for Copernicus, specifically for integrating with the Generative Language API (e.g., Gemini models). These steps are crucial for enabling Google-powered features within the IDE.

## 1. GCP Project Creation

1.  **Go to Google Cloud Console**: Open your web browser and navigate to [console.cloud.google.com](https://console.cloud.google.com/).
2.  **Log In**: Sign in with your Google account.
3.  **Create New Project**:
    *   In the top bar, click on the project selector dropdown (usually showing "My First Project" or your current project name).
    *   Click "New Project".
    *   Enter a **Project name** (e.g., `Copernicus-IDE-Integration`).
    *   (Optional) Choose an Organization and Location.
    *   Click "Create".

## 2. Enable Generative Language API

1.  **Navigate to APIs & Services**: Once your project is created and selected, go to the left-hand navigation menu, select "APIs & Services", then "Dashboard".
2.  **Enable API**:
    *   Click "+ Enable APIs and Services" at the top.
    *   Search for "Generative Language API".
    *   Select "Generative Language API" from the results.
    *   Click "Enable".

## 3. Create OAuth 2.0 Client ID

Copernicus is a local desktop application, requiring a "Desktop app" type for its OAuth client ID.

1.  **Go to Credentials**: In the "APIs & Services" menu, select "Credentials".
2.  **Configure Consent Screen**: If you haven't configured the OAuth consent screen before, you will be prompted to do so.
    *   Choose "External" for User Type (unless you are part of a Google Workspace organization and want internal users only).
    *   Click "Create".
    *   Fill in the **App name** (e.g., `Copernicus IDE`), **User support email**, and **Developer contact information**.
    *   Click "Save and Continue".
    *   (Optional) Add scopes if you need more than the basic user profile and email. For Generative Language API, typical scopes are handled automatically. Click "Save and Continue".
    *   (Optional) Add test users during development.
    *   Review the summary and "Back to Dashboard".
3.  **Create Credentials**:
    *   On the Credentials page, click "+ Create Credentials".
    *   Select "OAuth client ID".
    *   For **Application type**, choose "Desktop app".
    *   Enter a **Name** (e.g., `Copernicus-Desktop-Client`).
    *   Click "Create".
4.  **Download Credentials**: A dialog will appear showing your **Client ID** and **Client Secret**.
    *   Click "DOWNLOAD JSON". Save this JSON file to a secure location. You will need this for configuring Copernicus. **Do not share your client secret publicly.**

## 4. Configure Copernicus with the Client ID

Copernicus will prompt you for the OAuth credentials during its initial setup or via the settings panel.

1.  **Open Copernicus Settings**: Navigate to the Authentication/Providers section in the Copernicus IDE settings.
2.  **Provide Credentials**: Input your **Client ID** and **Client Secret** (from the downloaded JSON file) into the designated fields for Google OAuth configuration.
3.  **Save**: Save the settings.

## 5. Completing the Browser Authentication Flow

When Copernicus initiates the Google OAuth process (e.g., when you first try to use a Google model), it will:

1.  Open your default web browser to a Google authentication page.
2.  You will be prompted to sign in to your Google account (if not already signed in).
3.  You will be asked to grant Copernicus permission to access your Google account (specifically for the Generative Language API, if configured correctly).
4.  After granting permission, your browser will redirect to a local URL (e.g., `http://localhost:XXXX/oauth/callback`). Copernicus will listen on this port to capture the authentication token.
5.  Once the token is received, the browser tab will close (or show a success message), and Copernicus will be authenticated.

## 6. Troubleshooting

-   **`redirect_uri_mismatch` Error**:
    *   **Cause**: The redirect URI used by Copernicus does not match an authorized redirect URI configured in your Google Cloud project. For "Desktop app" client IDs, default redirect URIs like `urn:ietf:wg:oauth:2.0:oob` and `http://localhost` are often included.
    *   **Solution**: Ensure Copernicus is using a `http://localhost` URI for its callback. If you explicitly set custom URIs in GCP, ensure `http://localhost` (or the specific port Copernicus uses) is listed under "Authorized redirect URIs" for your OAuth 2.0 Client ID.
-   **`access_blocked` / "This app isn't verified" Warning**:
    *   **Cause**: Your GCP project's OAuth consent screen is in "Testing" status, and you are trying to authenticate with a Google account not listed as a "Test user".
    *   **Solution**: Either add the Google account you're using to the "Test users" list in the OAuth consent screen configuration, or publish your OAuth consent screen to "Production" status (which may require verification by Google if your app is public-facing).
-   **`quota exceeded` Error**:
    *   **Cause**: You have exceeded the free tier or enabled quota limits for the Generative Language API in your GCP project.
    *   **Solution**: Check your API quotas in the Google Cloud Console ("APIs & Services" -> "Quotas") and request an increase if necessary, or upgrade your billing account.
-   **`expired tokens`**:
    *   **Cause**: OAuth access tokens are temporary. If Copernicus isn't refreshing them correctly, or if your refresh token is invalid/revoked, you'll lose authentication.
    *   **Solution**: Try re-authenticating through Copernicus settings. If the problem persists, review Copernicus's token management logic or recreate your OAuth client ID in GCP.
