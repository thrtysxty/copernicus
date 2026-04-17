import { submitContractProposal } from '../lib/hub.mjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

class ImprovementHandler {
  constructor() {
    this.name = 'ImprovementHandler';
  }

  owns(session) {
    return false; // Does not own standard jules/ccr sessions.
  }

  async attach(session, db, activeSet) {
    // No-op for sessions
  }

  /**
   * We will expose a method to handle the IPC channel logic.
   * In a real implementation this would tie into an event listener.
   */
  handleImprovementLog(logEntry, db) {
    const isHubProposalsEnabled = process.env.IMPROVEMENT_HUB_PROPOSALS === 'true';

    if (isHubProposalsEnabled && logEntry && logEntry.diff && logEntry.role) {
      try {
        // Meta-agent token typically issues this. We will query it or use 'system'.
        // The story mentions "Validates the proposing token is a Meta-Agent token".
        // In the daemon context, we must mint or find the meta-agent token.
        let metaToken = db.prepare('SELECT token_id FROM hub_tokens WHERE role_name=? AND state=?').get('meta-agent', 'ACTIVE');
        if (!metaToken) {
           console.warn('[ImprovementHandler] No active meta-agent token found, cannot submit proposal.');
           return;
        }

        submitContractProposal({
           proposed_by: metaToken.token_id,
           role_name: logEntry.role,
           current_hash: crypto.createHash('sha256').update(logEntry.currentProgram || '').digest('hex'),
           proposed_diff: logEntry.diff,
           rationale: 'Proposed by Meta-Agent loop',
           evidence: {
             scoreBefore: logEntry.scoreBefore,
             scoreAfter: logEntry.scoreAfter,
             kept: logEntry.kept
           }
        });
        console.log('[ImprovementHandler] Submitted contract proposal via Hub.');
      } catch(e) {
        console.error('[ImprovementHandler] Failed to submit proposal:', e.message);
      }
    } else {
        // Fallback or disabled
        console.log('[ImprovementHandler] Hub proposals disabled or invalid log entry. Falling back to old behavior.');
    }
  }
}

export default new ImprovementHandler();
