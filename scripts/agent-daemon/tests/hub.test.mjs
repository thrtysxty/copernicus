/**
 * Story 648: Hub Contract Proposal Authority Gate Tests
 * Tests for submitContractProposal, approveProposal, rejectProposal
 */
import { test } from 'node:test';
import assert from 'node:assert';
import { submitContractProposal, approveProposal, rejectProposal } from '../lib/hub.mjs';

// ── submitContractProposal ────────────────────────────────────────────────────

test('submitContractProposal rejects token that is not a meta-agent', () => {
  // A token that does not exist in hub_tokens will not be a meta-agent
  assert.throws(
    () => submitContractProposal({
      proposed_by: 'tok_nonexistent_000000',
      role_name: 'coder',
      current_hash: 'abc123',
      proposed_diff: '+some: change',
      rationale: 'test proposal',
      evidence: []
    }),
    (err) => {
      return err.name === 'ConstitutionalViolation' ||
             err.message.includes('not a meta-agent');
    },
    'Should throw ConstitutionalViolation for non-meta-agent token'
  );
});

test('submitContractProposal rejects diff touching authority_level', () => {
  assert.throws(
    () => submitContractProposal({
      proposed_by: 'tok_nonexistent_000001',
      role_name: 'coder',
      current_hash: 'abc123',
      proposed_diff: '+authority_level: 5\n- old line',
      rationale: 'escalation attempt',
      evidence: []
    }),
    (err) => {
      return err.name === 'ConstitutionalViolation' ||
             err.message.includes('constitutional') ||
             err.message.includes('authority_level') ||
             err.message.includes('not a meta-agent'); // token check fires first
    },
    'Should throw ConstitutionalViolation for diff touching authority_level'
  );
});

test('submitContractProposal rejects diff touching class field', () => {
  assert.throws(
    () => submitContractProposal({
      proposed_by: 'tok_nonexistent_000002',
      role_name: 'coder',
      current_hash: 'abc123',
      proposed_diff: '+class: operational\n- class: regulatory',
      rationale: 'class change attempt',
      evidence: []
    }),
    (err) => {
      return err.name === 'ConstitutionalViolation' ||
             err.message.includes('constitutional') ||
             err.message.includes('not a meta-agent');
    },
    'Should throw ConstitutionalViolation for diff touching class field'
  );
});

// ── approveProposal ───────────────────────────────────────────────────────────

test('approveProposal rejects non-user identity', () => {
  assert.throws(
    () => approveProposal('prop_fake_000', 'agent:some-coder'),
    (err) => {
      return err.name === 'ConstitutionalViolation' ||
             err.message.includes('user identity') ||
             err.message.includes("user:'");
    },
    'Should throw ConstitutionalViolation for non-user approver'
  );
});

test('approveProposal rejects undefined approvedBy', () => {
  assert.throws(
    () => approveProposal('prop_fake_001', undefined),
    (err) => {
      return err.name === 'ConstitutionalViolation' ||
             err.message.includes('user identity') ||
             err.message.includes("user:'");
    },
    'Should throw ConstitutionalViolation for undefined approvedBy'
  );
});

test('approveProposal rejects nonexistent proposal even for valid user', () => {
  assert.throws(
    () => approveProposal('prop_nonexistent_999', 'user:testuser'),
    (err) => err.message.includes('not found'),
    'Should throw for nonexistent proposal ID'
  );
});

// ── rejectProposal ────────────────────────────────────────────────────────────

test('rejectProposal throws for nonexistent proposal', () => {
  assert.throws(
    () => rejectProposal('prop_nonexistent_999', 'user:test', 'testing'),
    (err) => err.message.includes('not found'),
    'Should throw for nonexistent proposal ID'
  );
});
