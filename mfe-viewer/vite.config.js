import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    lib: {
      entry: 'src/main.js',
      formats: ['es'],
      // nombre con hash: este archivo se cachea un año en CloudFront
      fileName: () => 'assets/todo-viewer-[hash].js',
    },
  },
});
