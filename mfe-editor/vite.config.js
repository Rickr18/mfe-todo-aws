import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./package.json', 'utf8'));

export default defineConfig({
  // Los .ce.vue compilan sus <style> dentro del Shadow DOM del Custom Element
  plugins: [vue({ customElement: /\.ce\.vue$/ })],
  define: {
    __VERSION__: JSON.stringify(version),
    // en modo librería Vite no reemplaza esto solo y Vue lo necesita
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    lib: {
      entry: 'src/main.js',
      formats: ['es'],
      // nombre con hash: este archivo se cachea un año en CloudFront
      fileName: () => 'assets/todo-editor-[hash].js',
    },
  },
});
