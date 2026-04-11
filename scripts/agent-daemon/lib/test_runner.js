import { run } from 'node:test';
import { resolve } from 'path';

run({ files: [resolve('lib/hub.test.mjs')] })
  .on('test:fail', () => { process.exitCode = 1; })
  .pipe(process.stdout);
