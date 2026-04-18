import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const { default: react } = await import('@vitejs/plugin-react')
  return {
    plugins: [
      react(),
      electron([
      {
        // Main process — native addons + chokidar (has native fsevents dep) must be external
        entry: 'electron/main.ts',
        vite: {
          build: {
            commonjsOptions: {
              ignoreDynamicRequires: true,
            },
            rollupOptions: {
              plugins: [
                {
                  // hub.mjs lives at scripts/agent-daemon/lib/ — 3 dirs outside the Vite
                  // root. Rollup's ESM→CJS interop bakes the require() path at build time
                  // using the source file location, producing
                  // require("../../../copernicus/node_modules/js-yaml") which resolves to
                  // the wrong path from dist-electron/ at runtime. Patch post-bundle to a
                  // bare specifier so Node's node_modules walk finds it correctly.
                  name: 'fix-hub-bundled-interop',
                  renderChunk(code: string) {
                    let result = code
                      // js-yaml: Rollup bakes source-relative path for cross-root module
                      // hub.mjs (scripts/agent-daemon/lib/). Wrong at runtime from dist-electron/.
                      .replace(
                        /require\$\d*\(["'][^"']*\/node_modules\/js-yaml["']\)/,
                        'require("js-yaml")'
                      )
                      // hub.mjs constitutional integrity check: when bundled into Electron,
                      // import.meta.url resolves to the bundle path so computeFileHash() can't
                      // find hub.mjs/db.mjs and calls process.exit(2). Remove the exit so the
                      // bundled Electron process isn't killed — hub.mjs integrity is still
                      // enforced when the daemon runs as a standalone child process.
                      .replace(
                        /(console\.error\("CONSTITUTIONAL INTEGRITY FAILURE:[^"]*"\))[,;\s]*process\.exit\(2\)/g,
                        '$1'
                      )
                    return result !== code ? result : null
                  },
                },
              ],
              external: [
                'node-pty', 'sqlite-vec', 'chokidar', 'fsevents', 'bufferutil', 'utf-8-validate',
                'libsql',
                /^@libsql\//,
              ],
            },
          },
        },
      },
      {
        // Preload — single entry so inlineDynamicImports: true produces one self-contained bundle
        entry: path.join(__dirname, 'electron/preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
      {
        // Splash preload — same: single entry, fully inlined
        entry: path.join(__dirname, 'electron/splash-preload.ts'),
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
    ],
  }
})
