import { defineConfig } from 'vite';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: path.resolve(__dirname, 'src/template'),
          dest: '.',
        },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'porter',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: [
        'node:child_process',
        'node:fs/promises',
        'node:fs',
        'node:path',
        'node:readline',
        'commander',
        'inquirer',
      ],
      output: {
        banner: '#!/usr/bin/env node',
        exports: 'named',
      },
    },
    emptyOutDir: true,
  },
});
