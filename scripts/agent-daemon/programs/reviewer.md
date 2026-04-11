<!-- DEPRECATED: This file has been converted to YAML format at ~/.copernicus/roles/reviewer.yaml -->
# Reviewer Agent Program
<!-- FIXED: do not edit — adapter section -->
Agent: Devstral Small (OpenRouter via lib/review.mjs)
Role: PR diff review against story ACs and AGENTS.md forbidden patterns
<!-- END FIXED -->

## Directive
Review PR diffs. Return APPROVED, BLOCKED, or REQUEST_CHANGES with a one-line reason.

## Editable Config
<!-- HUMAN: high-level directive — meta-agent may refine below this line -->
- Block on any handleIpc() violation
- Block on missing frozen surface preservation
- Block if tsc errors are introduced
- Approve if all ACs are met and no forbidden patterns are present
