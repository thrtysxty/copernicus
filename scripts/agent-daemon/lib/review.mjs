import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getStoryPath } from './db.mjs';
import { getPrDiff } from './github.mjs';
import { callStructured, ReviewVerdictSchema } from './llm.mjs';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

const REVIEW_MODEL = 'mistralai/devstral-small';

export async function reviewPr(prNumber, storyId) {
  const defaultVerdict = {
    verdict: "BLOCKED",
    acs_met: [],
    acs_missing: [],
    summary: "Failed to get a valid review verdict.",
    reviewer_model: REVIEW_MODEL,
    reviewed_at: new Date().toISOString(),
    merge_sha: "unknown"
  };

  let diff;
  try {
    console.log(`  Fetching PR #${prNumber} diff...`);
    diff = getPrDiff(prNumber);
  } catch (e) {
    console.error(`  Failed to fetch PR diff: ${e.message}`);
    defaultVerdict.summary = "Failed to fetch PR diff.";
    return defaultVerdict;
  }

  let storyContent = "Story file not found.";
  const storyFile = getStoryPath(storyId);
  if (storyFile) {
    try {
      storyContent = readFileSync(join(REPO_ROOT, storyFile), 'utf8');
    } catch (e) {
      console.error(`  Failed to read story file ${storyFile}: ${e.message}`);
    }
  }

  let forbiddenPatterns = "Forbidden patterns section not found in AGENTS.md.";
  try {
    const agentsMdContent = readFileSync(join(REPO_ROOT, 'AGENTS.md'), 'utf8');
    const startIdx = agentsMdContent.indexOf('## Forbidden');
    if (startIdx !== -1) {
      forbiddenPatterns = agentsMdContent.slice(startIdx).trim();
    }
  } catch (e) {
    console.error(`  Failed to read AGENTS.md or extract forbidden patterns: ${e.message}`);
  }

  const prompt = `
You are a senior code reviewer. Review this PR diff against the story's Acceptance Criteria and the project's forbidden patterns.

REVIEW SCOPE RULES (apply these before evaluating):
1. Evaluate whether the code changes correctly implement each AC — not whether runtime evidence was produced. The implementer is a headless agent that cannot run the app or produce log output. Do NOT require screenshots, log samples, test run output, or benchmark results.
2. AC ordering in a story describes logical sequence within the implementation, not a requirement for separate commits or PRs. A single PR that implements AC1 + AC2 together is acceptable as long as both are correctly implemented in the code.
3. Correction Notes in the story describe what was wrong in a previous PR. They guide what the implementer should fix — they are not additional ACs. Do not add new blocking requirements based on Correction Note wording unless they map to a stated AC.
4. Only block on issues that are verifiable from the diff itself: missing code, wrong logic, forbidden patterns, TypeScript errors, IPC violations. Do not block on hypothetical runtime behavior or missing evidence the agent cannot provide.
5. Do NOT request Playwright test runs, E2E test execution, browser automation, or any script execution from Jules. Jules is a headless code-writing agent — it cannot run interactive applications, start servers, or execute test frameworks. Any verdict that requires Jules to run Playwright or any other runtime test is invalid.

STORY ACCEPTANCE CRITERIA:
${storyContent}

FORBIDDEN PATTERNS (never allowed):
${forbiddenPatterns}

PR DIFF:
${diff}
`;

  console.log(`  Calling LLM (${REVIEW_MODEL}) for PR review...`);
  try {
    const messages = [
        {
          role: 'system',
          content: `You are an expert code reviewer evaluating a headless agent's work. Output ONLY a valid JSON object matching the provided schema.`
        },
        { role: 'user', content: prompt }
    ];

    const verdict = await callStructured({
        model: REVIEW_MODEL,
        messages: messages,
        schema: ReviewVerdictSchema,
        provider: 'openrouter' // Use explicit provider or let it resolve
    });

    return {
      verdict: verdict.verdict,
      acs_met: verdict.acs_met || [],
      acs_missing: verdict.acs_missing || [],
      summary: verdict.summary || '',
      reviewer_model: REVIEW_MODEL,
      reviewed_at: new Date().toISOString(),
      merge_sha: "unknown"
    };
  } catch (e) {
    console.error(`  LLM PR review error: ${e.message}`);
    defaultVerdict.summary = `LLM PR review error: ${e.message}`;
    return defaultVerdict;
  }
}
