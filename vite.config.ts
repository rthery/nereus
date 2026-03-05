import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import { execSync } from 'child_process';
import path from 'path';
import type { Plugin } from 'vite';

function litLocalizePlugin(): Plugin {
  return {
    name: 'lit-localize',
    configureServer(server) {
      server.watcher.add(path.resolve('xliff'));
      server.watcher.on('change', (file) => {
        if (file.endsWith('.xlf')) {
          console.log(`\n[lit-localize] ${path.basename(file)} changed, rebuilding locales...`);
          try {
            execSync('npx lit-localize build', { stdio: 'inherit' });
            console.log('[lit-localize] Done.\n');
          } catch {
            console.error('[lit-localize] Build failed.\n');
          }
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_URL ?? '/',
  test: {
    environment: 'happy-dom',
    include: ['src/__tests__/**/*.test.ts'],
  },
  plugins: [litLocalizePlugin(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,

    pwaAssets: {
      disabled: false,
      config: true,
    },

    manifest: {
      name: 'Nereus',
      short_name: 'Nereus',
      description: 'Freediving breath-hold training with CO2 and O2 tables',
      theme_color: '#0a1628',
      background_color: '#0a1628',
    },

    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
    },

    devOptions: {
      enabled: false,
      navigateFallback: 'index.html',
      suppressWarnings: true,
      type: 'module',
    },
  })],
})