import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import copy from 'rollup-plugin-copy';

export default defineConfig({
  plugins: [
    devtools(),
    solid(),
    copy({
      targets: [
        { src: '_redirects', dest: 'dist' }
      ],
      hook: 'writeBundle' // important to set this
    })
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
