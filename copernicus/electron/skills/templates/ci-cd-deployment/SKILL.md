Use when deploying, automating pull requests, or working with Jules/Gemini agent orchestration for {{PROJECT_NAME}}.

## Instructions

When working in {{REPO_ROOT}} with {{STACK}} on CI/CD and deployment tasks:
1. Ensure the Jules/Gemini dispatch pattern follows the guidelines.
2. For long-running sessions, observe the babysit protocol.
3. Verify test runs, code quality checks (`tsc --noEmit`), and e2e testing before merging any agent patches.

## Notes

- Before you merge a branch manually, check the PR status and run all tests locally.
- Use `git remote pull --session <SESSION_ID> --apply` to apply Jules patches carefully, ensuring no conflicts exist.
