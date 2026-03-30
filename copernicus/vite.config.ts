import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process — native addons + chokidar (has native fsevents dep) must be external
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'node-pty', 'sqlite-vec', 'chokidar', 'fsevents', 'bufferutil', 'utf-8-validate'],
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
})
