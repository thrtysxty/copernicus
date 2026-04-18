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
                  name: 'fix-hub-yaml-interop',
                  renderChunk(code: string) {
                    const fixed = code.replace(
                      /require\$\d*\(["'][^"']*\/node_modules\/js-yaml["']\)/,
                      'require("js-yaml")'
                    )
                    return fixed !== code ? fixed : null
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
