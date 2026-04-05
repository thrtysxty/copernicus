import { connect } from '@google/jules-sdk';
import {
  updateSessionState,
  updateSessionPr,
  updateSessionReview,
  updateSessionMerged,
  getStoryPath,
  writeVerificationRecord,
  writeStatus,
  writeEpisode,
  stampStoryId
} from '../lib/db.mjs';
import { getPrState, mergePr, getPrCommit } from '../lib/github.mjs';
import { reviewPr } from '../lib/review.mjs';
import { execSync } from 'child_process';

function getJulesApiKey() {
  let key = process.env.JULES_API_KEY;
  if (!key) {
    try {
      const out = execSync('bash -c "source ~/.secrets 2>/dev/null && echo $JULES_API_KEY"', { encoding: 'utf-8' });
      key = out.trim();
    } catch (e) {
      // ignore
    }
  }
  if (!key) {
    throw new Error("JULES_API_KEY not set — add it to ~/.secrets");
  }
  return key;
}

export default {
  name: 'jules',
  owns(row) {
    return row.agent === 'jules';
  },
  async attach(row, db) {
    const { session_id, story, title, state, review_state } = row;
    console.log(`Attaching Jules handler to session ${session_id} (Story ${story}: ${title})`);

    let client;
    try {
      client = await connect({ apiKey: getJulesApiKey() });
    } catch (e) {
      console.error(`Failed to connect to Jules SDK: ${e.message}`);
      return;
    }

    const session = client.session(session_id);
    let sessionState = state;
    let prUrl = row.pr_url;
    let prNumber = row.pr_number;

    // Fast-path review handling if already completed
    if (sessionState === 'COMPLETED' && prNumber && !row.merged) {
      await handleCompletedPr(row, db, prNumber, story, session);
      return;
    }

    try {
      for await (const activity of session.stream()) {
        const type = activity.type;

        if (type === 'stateChange') {
          sessionState = activity.stateChange.newState;
          console.log(`Story ${story} [${session_id.substring(0,12)}...] state changed: ${sessionState}`);

          if (sessionState === 'awaitingPlanApproval') {
            try {
              const res = await session.approve();
              console.log(`  ✓ Plan approved`);
              updateSessionState(db, session_id, sessionState, true);
            } catch (e) {
              console.warn(`  ❌ Plan approval failed: ${e.message}`);
              updateSessionState(db, session_id, sessionState);
            }
          } else if (sessionState === 'sessionCompleted') {
             updateSessionState(db, session_id, 'COMPLETED');
          } else {
             updateSessionState(db, session_id, sessionState);
          }
        } else if (type === 'pullRequest') {
           prUrl = activity.pullRequest.url;
           prNumber = parseInt(prUrl.replace(/\/$/, '').split('/').pop(), 10);
           console.log(`  PR ready: ${prUrl}`);
           updateSessionPr(db, session_id, sessionState, prUrl, prNumber);
        } else if (type === 'planGenerated') {
          const steps = activity.planGenerated.plan?.steps || [];
          console.log(`  Plan (${steps.length} steps):`);
          for (const s of steps) {
            console.log(`    ${s.index + 1}. ${s.title}`);
          }
        }

        // If completed and we have a PR, handle review
        if ((sessionState === 'sessionCompleted' || sessionState === 'COMPLETED') && prNumber && !row.merged) {
          // Re-fetch row state before reviewing to get freshest data
          const freshRow = db.prepare('SELECT * FROM jules_sessions WHERE session_id=?').get(session_id);
          await handleCompletedPr(freshRow, db, prNumber, story, session);
          break; // Done watching this stream
        }
      }
    } catch (e) {
       console.error(`Stream error for session ${session_id}: ${e.message}`);
    }
  }
};

async function handleCompletedPr(row, db, prNumber, storyId, session) {
  const sessionId = row.session_id;
  console.log(`Handling completed PR #${prNumber} for story ${storyId}`);

  if (row.review_state === 'APPROVED') {
    console.log(`  ✓ PR #${prNumber} already APPROVED. Proceeding to merge.`);
    await performMerge(row, db, prNumber, storyId);
    return;
  }

  const currentPrState = getPrState(prNumber);
  if (['CLOSED', 'MERGED'].includes(currentPrState)) {
    console.log(`  PR #${prNumber} is ${currentPrState} on GitHub — marking finished, skipping review.`);
    updateSessionMerged(db, sessionId, currentPrState);
    writeEpisode(db, sessionId);
    return;
  }

  // Decide whether to review
  let doReview = false;
  if (!row.review_state || row.review_state === 'FAILED') {
    doReview = true;
  } else if (['BLOCKED', 'REQUEST_CHANGES'].includes(row.review_state)) {
    // Retry review logic
    if (row.reviewed) {
      const lastReviewed = new Date(row.reviewed).getTime();
      const now = Date.now();
      const timeSince = (now - lastReviewed) / 1000;
      if (timeSince > 3600) {
         console.log(`  PR #${prNumber} was ${row.review_state}, retrying review.`);
         doReview = true;
      } else {
         console.log(`  PR #${prNumber} ${row.review_state}. Skipping merge. Will re-review in ${Math.round((3600 - timeSince)/60)} min.`);
      }
    } else {
      doReview = true;
    }
  }

  if (doReview) {
    const verdict = await reviewPr(prNumber, storyId);
    updateSessionReview(db, sessionId, verdict);

    if (verdict.verdict === 'APPROVED') {
      console.log(`  ✓ Review APPROVED — ${verdict.summary}`);
      await performMerge(row, db, prNumber, storyId, verdict);
    } else {
      console.warn(`  ❌ Review ${verdict.verdict} — ${verdict.summary}`);
      if (verdict.acs_missing?.length) {
        for (const ac of verdict.acs_missing) {
           console.warn(`   • AC not met: ${ac}`);
        }
      }

      // Send rework prompt via session.ask() or sendMessage() (per AC)
      // AC says `session.ask()`
      const reworkPrompt = `Your PR was reviewed and requires changes.
Verdict: ${verdict.verdict}
Summary: ${verdict.summary}
Missing ACs:
${verdict.acs_missing.map(a => '- ' + a).join('\\n')}

Please fix these issues and update the PR.`;

      try {
         await session.ask(reworkPrompt);
         console.log(`  Sent rework prompt to Jules.`);
      } catch (e) {
         console.error(`  Failed to send rework prompt: ${e.message}`);
      }
    }
  }
}

async function performMerge(row, db, prNumber, storyId, verdictObj = null) {
  const { ok, error } = mergePr(prNumber);
  if (ok) {
    const mergeSha = getPrCommit(prNumber);

    // Fallback if we don't have the fresh verdict passed
    let vData = verdictObj;
    if (!vData) {
      const freshRow = db.prepare('SELECT review_verdict FROM jules_sessions WHERE session_id=?').get(row.session_id);
      if (freshRow && freshRow.review_verdict) {
         try { vData = JSON.parse(freshRow.review_verdict); } catch (e) {}
      }
      if (!vData) vData = { verdict: 'APPROVED', reviewer_model: 'unknown', reviewed_at: new Date().toISOString(), acs_met: [], acs_missing: [], summary: 'Manually approved or fallback' };
    }

    vData.merge_sha = mergeSha || 'unknown';

    const storyPath = getStoryPath(storyId);
    if (storyPath) {
      writeVerificationRecord(storyPath, vData);
      writeStatus(storyPath, 'COMPLETE');
    } else {
      console.warn(`  ❌ Story file for story ${storyId} not found. Cannot write verification record.`);
    }

    console.log(`  ✓ Merged PR #${prNumber} ${mergeSha ? `(${mergeSha.substring(0,8)})` : ''}`);
    updateSessionMerged(db, row.session_id, mergeSha);

    const mergeTs = new Date().toISOString();
    stampStoryId(storyId.toString(), row.dispatched || mergeTs, mergeTs);
    writeEpisode(db, row.session_id);

  } else {
    console.warn(`  ❌ Merge failed: ${error}`);
  }
}
