import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soullink.aastha',
  appName: 'Aastha EI',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      // White status-bar icon (android/app/src/main/res/drawable/ic_stat_aastha.xml)
      smallIcon: 'ic_stat_aastha',
      iconColor: '#8B5CF6',
    },
  },
};

export default config;
