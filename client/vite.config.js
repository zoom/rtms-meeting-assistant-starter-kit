import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy configuration for LOCAL DEVELOPMENT ONLY (npm run dev on port 5173)
    // For production/ngrok: Build with 'npm run build' and serve from Express on port 3000
    // See NGROK_SETUP.md for details
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/search': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/recordings': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/meeting-summary': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/meeting-summary-files': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
