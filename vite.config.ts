/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
// 
// IFRAME MIGRATION BUILD CONFIGURATION
// =====================================
// We now have TWO separate pieces to build:
// 
// 1. CONTENT SCRIPT (content-injector.ts → content.js)
//    - Runs on is.mendelu.cz page
//    - Injects iframe, handles message routing, proxies fetch requests
//    - MUST be IIFE format (Chrome extension content scripts don't support ES modules)
//    - Built with: npm run build:content
//
// 2. REACT APP (index.html + assets)
//    - Runs INSIDE the iframe
//    - Full React + Tailwind + DaisyUI stack
//    - Standard Vite bundle
//    - Built with: npm run build:app
//
// The default "npm run build" should run BOTH builds.

export default defineConfig(() => {
  // Check if we're building the content script specifically
  const isContentBuild = process.env.BUILD_TARGET === 'content';

  if (isContentBuild) {
    // Content script build configuration
    return {
      plugins: [],
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, 'src/content-injector.ts'),
          output: {
            format: 'iife' as const,
            entryFileNames: 'content.js',
          },
        },
      },
    }
  }

  // React app build configuration (default)
  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks: {
            // Split large vendor dependencies
            'vendor-react': ['react', 'react-dom'],
            'vendor-charts': ['recharts'],
            'vendor-motion': ['motion'],
            'vendor-ui': ['lucide-react', 'sonner'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
      coverage: {
        provider: 'v8' as const,
        reporter: ['text', 'html'],
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.d.ts'],
      },
    },
  }
})

