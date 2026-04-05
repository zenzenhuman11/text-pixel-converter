import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      path: 'path-browserify',
    },
  },
  preview: {
    port: 3000,
    host: true,
    allowedHosts: true
  },
  server: {
    port: 3000,
    host: true
  }
})
