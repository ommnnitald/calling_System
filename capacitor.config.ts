import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.streamcall.app',
  appName: 'StreamCall',
  webDir: 'client/dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: [
      '192.168.*',
      '10.*',
      '172.*',
      'localhost',
      '127.0.0.1',
      '10.0.2.2',
    ],
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true,
  },
};

export default config;
