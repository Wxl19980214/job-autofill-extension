import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import webExtension from 'vite-plugin-web-extension';

// vite-plugin-web-extension reads manifest.json, finds all entry points
// (popup HTML, options HTML, background TS, content TS), and bundles each
// correctly for Manifest V3 — content scripts as IIFE, background as ESM
// module, popup/options as standard Vite builds.
export default defineConfig({
  // Chrome extensions require relative asset paths — absolute paths ("/foo.js")
  // don't resolve under chrome-extension:// origins.
  base: '',
  plugins: [
    react(),
    webExtension({
      manifest: 'manifest.json',
      watchFilePaths: ['package.json', 'manifest.json'],
    }),
  ],
  build: {
    // Keep readable output for easier debugging during development
    minify: false,
    sourcemap: true,
  },
});
