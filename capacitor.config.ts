import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.reis.app',
  appName: 'Reis',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://is.mendelu.cz',
    allowNavigation: ['is.mendelu.cz', '*.mendelu.cz'],
    // @ts-expect-error - appendUserAgent is valid but missing from types
    appendUserAgent: false
  }
};

export default config;
