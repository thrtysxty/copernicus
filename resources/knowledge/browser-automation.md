# Browser Automation

Copernicus includes Playwright integration for web automation — navigate, screenshot, click, fill forms, and evaluate JavaScript, all through IPC.

## Available Commands

| Channel | Action |
|---------|--------|
| `browser:launch` | Open a browser instance |
| `browser:navigate` | Go to a URL |
| `browser:screenshot` | Capture a screenshot |
| `browser:click` | Click an element |
| `browser:fill` | Fill a form field |
| `browser:evaluate` | Run JavaScript in the page |
| `browser:close` | Close the browser |

## Using in Workflows

Add a **Tool** node to your workflow with a browser command:

```yaml
type: tool
action: browser:navigate
args:
  url: "https://example.com"
```

Chain with a **Decision** node to check the result:

```yaml
type: decision
condition: "exitCode === 0"
```

## Using in Chat

Ask an agent to browse:
- "Take a screenshot of the production homepage"
- "Fill in the form at /checkout with test data"
- "Check if the deploy succeeded by visiting /health"

## Security

Browser instances run in isolated contexts. The SandboxManager prevents agents from navigating to internal URLs or accessing local files through the browser.
