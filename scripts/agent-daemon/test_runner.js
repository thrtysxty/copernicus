import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  process.env.NODE_ENV = 'test';

  try {
    execSync('rm -rf ~/.copernicus/hub-integrity.json', { stdio: 'ignore' });
  } catch (e) {}

  const testDir = path.join(__dirname, 'tests');
  console.log('Running tests in', testDir);

  execSync(`node --test ${testDir}/*.test.mjs`, { stdio: 'inherit' });
  console.log('All tests passed.');
} catch (e) {
  console.error('Test execution failed');
  process.exit(1);
}
