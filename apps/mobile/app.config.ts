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
    icon: './assets/logo.png', // Icône de l'app (à créer depuis logo.svg)
    userInterfaceStyle: 'light',
    jsEngine: 'hermes',
    splash: {
      image: './assets/full_icon.png', // Écran de lancement (à créer depuis full_icon.svg)
      resizeMode: 'contain',
      backgroundColor: '#ffffff', // Fond blanc pour faire ressortir le logo
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.swalo.mobile',
      ...config.ios,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/logo.png', // Icône adaptative Android (à créer depuis logo.svg)
        backgroundColor: '#1E3A8A', // Bleu SWALO
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
