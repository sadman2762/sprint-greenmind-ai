import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Optional target supports an isolated demo backend without interrupting another local checkout.
const apiTarget = process.env.GREENMIND_API_TARGET ?? 'http://127.0.0.1:8000';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': { target: apiTarget, ws: true }, '/traffic': apiTarget },
  },
  preview: {
    proxy: { '/api': { target: apiTarget, ws: true }, '/traffic': apiTarget },
  },
})
