import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arcadianstore.aricimap',
  appName: 'ARICIMAP',
  webDir: 'dist/public',
  plugins: {
    StatusBar: {
      overlaysWebView: false
    }
  }
};

export default config;
