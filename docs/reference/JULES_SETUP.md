# Google Jules Setup

Jules is Google's autonomous coding agent. Given a task and a GitHub repository, Jules reads your codebase, writes a plan, implements changes, and opens a pull request — unattended.

Copernicus integrates Jules via the `@google/jules-sdk`. You dispatch stories directly from the Kanban board; Jules handles the rest.

---

## 1. Prerequisites

- A Google account with Jules access (currently invite/waitlist)
- A GitHub repository connected to your Copernicus project (Settings → Providers → GitHub)
- Your Jules API key from the [Jules dashboard](https://jules.google.com)

---

## 2. Authentication

Jules uses an API key — no `gcloud` CLI or OAuth flow required.

**In Copernicus:**
1. Go to **Settings → Providers**
2. Locate the **Jules** tile
3. Paste your API key and click **Save**

The key is stored encrypted via Electron's `safeStorage`. It is never written to disk in plaintext.

**Alternative (environment variable):**
If you prefer not to store the key in Copernicus settings, set it in your shell environment before launching:
```bash
export JULES_API_KEY=your-api-key-here
```

---

## 3. Connecting Your Repository

Jules operates on GitHub repositories. Your repo must be:
- Accessible by the Google account that owns your Jules API key
- Connected in Copernicus: Settings → Providers → GitHub (Personal Access Token with `repo` scope)

When you dispatch a story to Jules from the Kanban board, Copernicus passes the repo in `owner/repo` format and the target branch automatically.

---

## 4. Dispatching a Story

1. Open a story card on the Kanban board
2. Set **Assigned to: Jules** in the story inspector
3. Click **→ Jules** on the card

Jules will:
1. Read the story acceptance criteria as its prompt
2. Browse the repository for context
3. Generate a plan (optionally shown for your approval)
4. Implement the changes
5. Open a pull request

The story card badge updates in real time:
```
● QUEUED   main
● RUNNING  main
● DONE     PR #42 → main
```

---

## 5. Plan Approval

By default Jules operates in **auto mode** — it creates the PR without pausing for approval.

To review Jules's plan before it starts coding, enable **Require Plan Approval** in the story inspector before dispatching. The card will pause at `AWAITING APPROVAL` and Copernicus will notify you. Approve or reject from the story inspector.

---

## 6. Limits

Jules session limits depend on your Google account tier. Check your current quota in the [Jules dashboard](https://jules.google.com). The Command Center shows all active sessions so you can monitor concurrency at a glance.

---

## 7. Troubleshooting

**"Jules API key not configured"**
Go to Settings → Providers → Jules and verify the key is saved.

**"Jules API 401"**
The key is invalid or expired. Regenerate it from the Jules dashboard and update it in Settings.

**"Story not found"**
The story ID could not be resolved. Ensure the story is saved before dispatching.

**Session stuck at QUEUED**
Jules may be at capacity. Check the Jules dashboard for account status. You can retry the session from the story inspector.

**PR opened but story not updated**
The Jules monitor polls for PR status. Allow 30–60 seconds. If the card doesn't update, reload the Kanban board — the status will sync on next poll.

---

## Related

- `docs/reference/STITCH_SETUP.md` — Design-to-code integration
- `docs/reference/USER_WORKFLOW.md` — Full sprint workflow including Jules dispatch
