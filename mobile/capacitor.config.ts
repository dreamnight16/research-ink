import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yanmo.app',
  appName: '研墨',
  webDir: 'dist',
  server: {
    // 开发时允许连接任意 LAN 后端
    cleartext: true,
    androidScheme: 'https',
  },
  plugins: {
    Network: {},
  },
  android: {
    allowMixedContent: true,
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
