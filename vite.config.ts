/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
// For Chrome extension content scripts, we need IIFE format since they don't support ES modules.
// We build content script separately with IIFE, and background/offscreen as ES modules.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        // Content script - will be built as IIFE
        content: resolve(__dirname, 'src/content.tsx'),
      },
      output: {
        // IIFE format for content scripts (no ES module support)
        format: 'iife',
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
  },
})
