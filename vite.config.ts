import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base: the built game works from any URL or sub-folder on a static host.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // Listen on the LAN so a phone on the same Wi-Fi can open the dev server.
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
  build: {
    // Safari 14+ / Chrome 87+ — covers current and several-years-old phones.
    target: 'es2020',
    sourcemap: false,
    // three.js is large by nature; it is split into a lazy chunk (see App.tsx).
    chunkSizeWarningLimit: 1200,
  },
})
