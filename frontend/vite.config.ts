/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Keys starting with ^ are regular expressions: '^/r/' must not swallow page routes such as /register or /refund-policy.
const PROXIED = ['^/api/', '^/r/', '^/files/', '^/sitemap\\.xml$', '^/robots\\.txt$', '^/seo/'];
const api = process.env.VITE_PROXY_TARGET || 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The browser talks to one origin; Vite forwards API, tracking, upload and SEO paths to Spring Boot.
    proxy: Object.fromEntries(PROXIED.map((p) => [p, { target: api, changeOrigin: false }])),
  },
  preview: {
    port: 4173,
    proxy: Object.fromEntries(PROXIED.map((p) => [p, { target: api, changeOrigin: false }])),
  },
  build: {
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom', 'react-router-dom'], data: ['@tanstack/react-query', 'react-hook-form', 'zod', '@hookform/resolvers'] } },
    },
  },
  test: { environment: 'jsdom', globals: true, setupFiles: './src/test/setup.ts', include: ['src/**/*.test.{ts,tsx}'], css: false },
});
