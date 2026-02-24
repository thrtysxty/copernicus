import { AuthManager } from '../src/main/auth/auth-manager';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock electron safeStorage
process.env.NODE_ENV = 'test';

// Minimal test runner implementation
async function runTests() {
    console.log('🧪 Running AuthManager logic tests...');
    const results = { pass: 0, fail: 0 };

    const expect = (actual: any) => ({
        toBe: (expected: any) => {
            if (actual !== expected) throw new Error(`Expected ${expected}, got ${actual}`);
        },
        rejects: {
            toThrow: async (msg: string) => {
                try {
                    await actual;
                    throw new Error('Expected to throw but succeeded');
                } catch (e: any) {
                    if (e.message !== msg) throw new Error(`Expected error "${msg}", got "${e.message}"`);
                }
            }
        }
    });

    const test = async (name: string, fn: () => Promise<void>) => {
        try {
            // Setup: Clear state before each test
            delete process.env.ANTHROPIC_API_KEY;
            delete process.env.GEMINI_API_KEY;
            delete process.env.GOOGLE_API_KEY;
            delete process.env.OPENAI_API_KEY;
            
            const credPath = path.join(os.homedir(), '.atlas', 'credentials.enc');
            if (fs.existsSync(credPath)) fs.unlinkSync(credPath);
            
            await fn();
            console.log(`✅ PASS: ${name}`);
            results.pass++;
        } catch (e: any) {
            console.log(`❌ FAIL: ${name}\n   ${e.message}`);
            results.fail++;
        }
    };

    // Test Case 1: Resolve from Environment
    await test('Resolve Anthropic key from ENV', async () => {
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test-123';
        const manager = new AuthManager();
        const token = await manager.getToken('anthropic');
        expect(token).toBe('sk-ant-test-123');
    });

    // Test Case 2: Manual Storage
    await test('Manual store and retrieve', async () => {
        const manager = new AuthManager();
        await manager.storeApiKey('anthropic', 'sk-manual-123');
        const token = await manager.getToken('anthropic');
        expect(token).toBe('sk-manual-123');
    });

    // Test Case 3: Revocation
    await test('Revoke key', async () => {
        const manager = new AuthManager();
        await manager.storeApiKey('anthropic', 'val');
        await manager.revoke('anthropic');
        try {
            await manager.getToken('anthropic');
            throw new Error('Should have thrown');
        } catch (e: any) {
            expect(e.message).toBe('No Anthropic credentials found.');
        }
    });

    // Test Case 4: Priority Ladder (ENV > Store)
    await test('Prioritize ENV over stored keys', async () => {
        const manager = new AuthManager();
        await manager.storeApiKey('anthropic', 'stored-val');
        process.env.ANTHROPIC_API_KEY = 'env-val';
        const token = await manager.getToken('anthropic');
        expect(token).toBe('env-val');
    });

    // Test Case 5: Custom Provider
    await test('Handle custom provider via ENV', async () => {
        process.env.OPENAI_API_KEY = 'sk-oa-test';
        const manager = new AuthManager();
        const token = await manager.getToken('openai');
        expect(token).toBe('sk-oa-test');
    });

    console.log(`
Summary: ${results.pass} passed, ${results.fail} failed.`);
    process.exit(results.fail > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test runner failed:', err);
    process.exit(1);
});
