import { createRequire } from 'node:module';

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const { version: appVersion } = require('./package.json') as { version: string };

const isCodespaces = Boolean(
  process.env.CODESPACES ||
  process.env.CODESPACE_NAME ||
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN,
);

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: isCodespaces
      ? {
          clientPort: 443,
        }
      : undefined,
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/')
          ) {
            return 'vendor-react';
          }

          if (id.includes('react-router')) {
            return 'vendor-router';
          }

          if (
            id.includes('@supabase') ||
            id.includes('realtime-js') ||
            id.includes('postgrest-js') ||
            id.includes('gotrue-js') ||
            id.includes('storage-js')
          ) {
            return 'vendor-supabase';
          }

          if (id.includes('lucide-react')) {
            return 'vendor-icons';
          }

          return 'vendor';
        },
      },
    },
  },
});
