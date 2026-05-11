import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  base: './',
  build: {
    cssMinify: false,
    rollupOptions: {
      output: {
        // Separate Monaco into its own chunk (~5MB) so it lazy-loads only
        // when a file is opened in the editor — initial bundle stays small.
        manualChunks(id: string) {
          if (id.includes('monaco-editor') || id.includes('@monaco-editor')) {
            return 'monaco';
          }
        },
      },
    },
    // Monaco itself triggers Vite's "chunk too large" warning above the default
    // 500 KB. Raise the threshold so the warning doesn't drown the real signal.
    chunkSizeWarningLimit: 6000,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    include: ['monaco-editor/esm/vs/editor/editor.api'],
  },
})
