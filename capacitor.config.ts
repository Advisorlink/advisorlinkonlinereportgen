import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.8d1f136076d445e5b6d4568b6503cfde',
  appName: 'AdvisorLink Online',
  webDir: 'dist',
  server: {
    // For hot-reload during development, point at the Lovable sandbox preview.
    // Comment out the `url` line before building a production APK so the
    // bundled web assets in `dist/` are used instead.
    url: 'https://8d1f1360-76d4-45e5-b6d4-568b6503cfde.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#0a1628',
      showSpinner: false,
    },
  },
};

export default config;
