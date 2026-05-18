# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Copernicus, please report it
responsibly by emailing **security@copernicus.dev** (or opening a private
security advisory on GitHub).

**Please do not report security vulnerabilities through public GitHub issues.**

## Response Timeline

- **Acknowledgment**: Within 48 hours of receiving your report
- **Initial assessment**: Within 5 business days
- **Fix and disclosure**: We aim to release fixes within 30 days, coordinated
  with the reporter

## What to Include

When reporting a vulnerability, please include:

1. **Description** of the vulnerability and its impact
2. **Steps to reproduce** the issue
3. **Affected versions** of Copernicus
4. **Possible mitigations** if you have suggestions

## Scope

The following are considered in scope for security reports:

- The Copernicus Electron application and its IPC layer
- The Flask backend API and its authentication/authorization mechanisms
- Extension loading and sandboxing
- Credential storage (Keychain / encrypted storage)
- WebSocket connections and CORS policies

The following are considered out of scope:

- Issues in third-party dependencies (report to the respective maintainer)
- Social engineering or phishing attacks
- Denial of service attacks against the backend API
- Issues in development-only tools or configurations

## Supported Versions

| Version | Supported |
| ------- | --------- |
| main    | Yes       |
| < 0.1   | No        |

## Security Best Practices for Contributors

- Never commit secrets, API keys, or credentials
- Use environment variables for all configuration
- Follow the principle of least privilege for extensions
- Report any security concerns you encounter during development
