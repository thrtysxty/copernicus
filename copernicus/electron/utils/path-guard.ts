import path from 'path';
import os from 'os';

/**
 * Resolves path and asserts it is within one of the allowed roots.
 * Returns the absolute resolved path.
 * Throws Error if path is outside allowed roots.
 */
export function assertSafePath(p: string, allowedRoots?: string[]): string {
  const roots = allowedRoots || [
    path.join(os.homedir(), 'Projects'),
    '/tmp/copernicus',
    path.resolve(__dirname, '../../..') // Current project root
  ];

  const resolved = path.resolve(p);
  const absRoots = roots.map(r => path.resolve(r));

  const isSafe = absRoots.some(root => {
    // Check if it's the root itself or a subdirectory
    return resolved === root || resolved.startsWith(root + path.sep);
  });

  if (!isSafe) {
    throw new Error(`Path outside allowed roots: ${resolved}`);
  }

  return resolved;
}
