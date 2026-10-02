import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const frontendRoot = path.resolve(process.cwd(), 'frontend');

export default defineConfig({
  root: frontendRoot,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: path.resolve(process.cwd(), 'public'),
    emptyOutDir: false,
  },
});
