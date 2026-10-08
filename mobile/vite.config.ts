import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Capacitor 通过 capacitor:// 或 file:// 加载产物，绝对路径会失效，必须用相对路径。
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
