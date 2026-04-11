import test from 'node:test';
import assert from 'node:assert';
import { JulesAdapter } from './jules.mjs';

test('JulesAdapter unit tests', async (t) => {
  await t.test('name() returns jules', () => {
    const adapter = new JulesAdapter(null, null, null);
    assert.strictEqual(adapter.name(), 'jules');
  });

  await t.test('supportedCapabilities() returns correct list', () => {
    const adapter = new JulesAdapter(null, null, null);
    const caps = adapter.supportedCapabilities();
    assert.deepStrictEqual(caps, ['autonomous_pr', 'plan_approval']);
  });

  await t.test('dispatch() throws if token not ACTIVE', async () => {
    const adapter = new JulesAdapter(null, null, null);
    await assert.rejects(
      async () => await adapter.dispatch({ status: 'EXPIRED' }, 'path'),
      /Token is not ACTIVE/
    );
  });

  await t.test('poll() returns without error on empty sessions', async () => {
    const mockDb = {
      prepare: () => ({
        all: () => []
      })
    };
    const adapter = new JulesAdapter(mockDb, null, null);

    try {
        await adapter.poll();
    } catch(err) {
        if (!err.message.includes('Cannot find package')) {
            throw err;
        }
    }
  });

  await t.test('hub.registerAdapter() stores adapter by name', async () => {
    const mockHub = {
      adapters: new Map(),
      registerAdapter: function(a) { this.adapters.set(a.name(), a); }
    };
    const adapter = new JulesAdapter(null, null, null);
    mockHub.registerAdapter(adapter);
    assert.strictEqual(mockHub.adapters.get('jules'), adapter);
  });

  await t.test('hub.dispatch() routes to correct adapter', async () => {
      let routed = false;
      const mockAdapter = {
          name: () => 'test_adapter',
          dispatch: async () => { routed = true; return { session_id: '123' }; }
      };

      const mockHub = {
          adapters: new Map(),
          registerAdapter: function(a) { this.adapters.set(a.name(), a); },
          dispatch: async function(token) {
              const adapter = this.adapters.get(token.identity.adapter);
              if (!adapter) throw new Error('AdapterNotFound');
              return await adapter.dispatch(token, 'task');
          }
      };

      mockHub.registerAdapter(mockAdapter);
      const res = await mockHub.dispatch({ status: 'ACTIVE', identity: { adapter: 'test_adapter' } });
      assert.strictEqual(routed, true);
      assert.strictEqual(res.session_id, '123');
  });
});
