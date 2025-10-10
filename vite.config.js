import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        control: resolve(__dirname, 'control.html'),
        player: resolve(__dirname, 'player.html'),
      },
    },
  },
});
