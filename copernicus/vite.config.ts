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
        // Main process — native addons must be external (never bundled by Rollup)
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'node-pty', 'sqlite-vec'],
            },
          },
        },
      },
      {
        // Preload scripts — multiple inputs require inlineDynamicImports: false
        entry: {
          preload: path.join(__dirname, 'electron/preload.ts'),
          'splash-preload': path.join(__dirname, 'electron/splash-preload.ts'),
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                inlineDynamicImports: false,
              },
            },
          },
        },
      },
    ]),
  ],
})
