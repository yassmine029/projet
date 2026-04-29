import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        // Uploads multi-fichiers (DICOM) : défaut court → ECONNRESET / « Network Error » côté client
        timeout: 900000,
        proxyTimeout: 900000,
        rewrite: path => path.replace(/^\/api/, '/api'),
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
