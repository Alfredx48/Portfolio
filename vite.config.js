import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import copy from 'vite-plugin-copy';

export default defineConfig({
  plugins: [
        /* 
    Uncomment the following line to enable solid-devtools.
    For more info see https://github.com/thetarnav/solid-devtools/tree/main/packages/extension#readme
    */
    devtools(),
    solid(),
    copy({
      targets: [
        { src: '_redirects', dest: 'dist' }
      ]
    })
  ],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
