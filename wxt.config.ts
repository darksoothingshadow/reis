import { defineConfig } from 'wxt';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  hooks: {
    // Never ship the localhost real-data snapshot in a production build.
    // It stays packed in dev (chrome-mv3-dev) so the unpacked extension can
    // fetch it, but is stripped from production output.
    'build:publicAssets'(wxt, files) {
      if (wxt.config.mode === 'production') {
        const i = files.findIndex((f) => f.relativeDest === 'dev-real-data.json');
        if (i !== -1) files.splice(i, 1);
      }
    },
  },
  webExt: {
    disabled: process.env.WXT_RUNNER_DISABLED === 'true',
  },
  manifest: {
    name: 'reIS',
    version: '5.2.1',
    description: 'Modernizovaný reIS rozšířený pro IS Mendelu',
    icons: {
      16: 'reIS_logo_16.png',
      48: 'reIS_logo_48.png',
      128: 'reIS_logo_128.png',
    },
    permissions: ['storage', 'unlimitedStorage', 'alarms'],
    host_permissions: [
      'https://is.mendelu.cz/*',
      'https://raw.githubusercontent.com/reis-mendelu/reis-data/*',
      'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/*',
      'https://skm.mendelu.cz/*',
      'https://mendelu.cz/*',
      'https://zvbpgkmnrqyprtkyxkwn.supabase.co/*',
      'https://hei.api.uni-foundation.eu/*',
      'https://photon.komoot.io/*',
    ],
    action: {
      default_popup: 'main.html',
    },
    browser_specific_settings: {
      gecko: {
        id: 'reis-extension@mendelu.cz',
        strict_min_version: '140.0',
        data_collection_permissions: {
          required: ['none'],
          optional: [],
        },
      },
      gecko_android: {
        strict_min_version: '140.0',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: [
          'main.html',
          'assets/*',
          'reIS_logo_16.png',
          'reIS_logo_48.png',
          'reIS_logo_128.png',
          'reIS_logo.svg',
          'fonts/*',
        ],
        matches: ['https://is.mendelu.cz/*'],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }),
});
