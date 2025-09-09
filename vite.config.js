// vite.config.js (o .ts)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,      // puerto del admin
    strictPort: true, // si está ocupado, falla en vez de saltar a otro
    host: true        // opcional: permite acceder desde la red (LAN)
  },
  preview: {
    port: 5175,
    host: true
  }
})
