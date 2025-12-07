/// <reference types="node" />
import { defineConfig } from 'vite'
import { resolve } from 'path'

// Separate Vite config for background and offscreen scripts
// These can use ES modules since they run in extension contexts (not content scripts)
export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false, // Don't clear dist, content script built first
        lib: {
            entry: {
                background: resolve(__dirname, 'src/background.ts'),
                offscreen: resolve(__dirname, 'src/offscreen.ts'),
            },
            formats: ['es'],
        },
        rollupOptions: {
            output: {
                entryFileNames: '[name].js',
                // Inline all imports - no shared chunks
                inlineDynamicImports: false,
            },
        },
    },
})
