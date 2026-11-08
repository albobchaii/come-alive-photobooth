import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Saat development, request /api diteruskan ke server Express (npm run dev:server).
const API = `http://localhost:${process.env.API_PORT || 3001}`

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API,
      // halaman unduhan softfile (jangan sampai kena /softfile atau /setup)
      '^/s/': API,
    },
  },
})
