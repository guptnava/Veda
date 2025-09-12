import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: 'src/test.setup.tsx'
  },
  optimizeDeps: {
    include: ['chart.js', 'chartjs-chart-matrix'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    }, host: '0.0.0.0',
       port: 5173
  },
});
