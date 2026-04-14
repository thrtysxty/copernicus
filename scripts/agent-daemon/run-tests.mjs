import { run } from 'node:test';
import { spec } from 'node:test/reporters';
import glob from 'glob';

glob.sync('lib/**/*.test.mjs').forEach(file => {
  console.log(`Testing ${file}`);
});
