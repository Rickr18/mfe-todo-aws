import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __VERSION__: JSON.stringify(version) },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    // index-[hash].js / index-[hash].css: caché larga en CloudFront
    // config.json y registry.json (carpeta public/) se copian tal cual
  },
});
