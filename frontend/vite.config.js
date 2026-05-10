import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Même machine que le backend Django (change si run-dev utilise un autre port).
const API_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000'
const WS_TARGET = API_TARGET.replace(/^http/, 'ws')

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    mockReset: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        // 127.0.0.1 évite parfois des soucis IPv6/localhost sous Windows
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        // Uploads multi-fichiers (DICOM) : défaut court → ECONNRESET / « Network Error » côté client
        timeout: 900000,
        proxyTimeout: 900000,
        rewrite: path => path.replace(/^\/api/, '/api'),
      },
      '/media': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: WS_TARGET,
        ws: true,
        changeOrigin: true,
        secure: false,
        // Recalage 3D peut prendre plusieurs minutes — évite ECONNRESET côté proxy
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
