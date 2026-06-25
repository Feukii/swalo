import { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const apiUrl =
    process.env.API_URL || process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.10:3000/api'; // Local API for development

  return {
    ...config,
    name: 'Swalo',
    slug: 'swalo-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png', // Icône de l'app (brand: ios_icon_1024x1024)
    userInterfaceStyle: 'light',
    jsEngine: 'hermes',
    splash: {
      image: './assets/splash-icon.png', // Écran de lancement (brand: swalo_icone_marine)
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF', // Fond blanc pour faire ressortir le logo
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.swalo.mobile',
      ...config.ios,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png', // Icône adaptative Android (brand: android_maskable_512)
        backgroundColor: '#102A43', // Marine Swalo
      },
      package: 'com.swalo.mobile',
      versionCode: config.android?.versionCode ?? 1,
      ...config.android,
    },
    web: {
      favicon: './assets/favicon.png',
      ...config.web,
    },
    plugins: ['expo-secure-store', 'expo-splash-screen', 'expo-sqlite'],
    updates: {
      url: 'https://u.expo.dev/935e1f15-6351-493d-a7b4-7c1a9c8a31a5',
      fallbackToCacheTimeout: 0,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    extra: {
      ...config.extra,
      apiUrl,
      eas: {
        projectId: '935e1f15-6351-493d-a7b4-7c1a9c8a31a5',
      },
    },
  };
};
