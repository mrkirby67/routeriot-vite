import { resolve } from 'path';
import { defineConfig } from 'vite';
import copy from 'rollup-plugin-copy';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, '.')
    }
  },
  build: {
    rollupOptions: {
      input: {
        // Existing Route Riot pages
        main: resolve(__dirname, 'index.html'),
        control: resolve(__dirname, 'control.html'),
        player: resolve(__dirname, 'player.html'),
        pewControl: resolve(__dirname, 'pew/control.html'),
        pewPlayer: resolve(__dirname, 'pew/player.html'),

        // ✅ Fastest Finger pages
        ff_control: resolve(__dirname, 'ff/ff_control.html'),
        ff_player: resolve(__dirname, 'ff/ff_player.html')
      }
    }
  },
  plugins: [
    copy({
      targets: [
        // ✅ Copy the Fastest Finger app
        { src: 'ff', dest: 'dist' },

        // ✅ Copy the shared config folder that ff/firebaseApp.js depends on
        { src: 'modules', dest: 'dist' }
      ],
      hook: 'writeBundle'
    })
  ]
});
