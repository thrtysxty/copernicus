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
