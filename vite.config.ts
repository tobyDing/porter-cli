import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'porter-ci',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      external: ['node:child_process', 'node:fs/promises', 'node:path', 'commander', 'inquirer'],
      output: {
        banner: '#!/usr/bin/env node',
        exports: 'named'
      }
    },
    emptyOutDir: true
  }
})
