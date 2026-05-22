# story_721: Security Handlers Tests

**Status:** APPROVED FOR IMPLEMENTATION

## Scope

- `src/tests/security-handlers.test.ts`

## Definition of Done

- Tests pass: `npm run test`
- Zero lint errors

## Acceptance Criteria

### IPC Authentication

- IPC rejects unauthenticated calls
- IPC rejects calls with invalid tokens
- IPC rejects calls with revoked tokens

### Renderer Input Sanitization

- Renderer input sanitized (XSS stripped)
- Script tags sanitized
- Event handlers sanitized
- JavaScript URLs sanitized

### IPC Error Handling

- handleIpc envelope on all error paths
- No stack trace leakage to renderer
- Sanitized error messages
