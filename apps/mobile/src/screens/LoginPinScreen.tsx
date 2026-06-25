import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../lib/api';
import { cacheAuthCredentials, verifyOfflinePin } from '../db/authCache';
import { Colors, Spacing } from '../constants/theme-v2';
import { WifiOff } from '../components/icons/SimpleIcons';

interface LoginPinScreenProps {
  navigation: {
    replace: (screen: string) => void;
  };
}

// Champs supplémentaires de la réponse de connexion (licence/modules) qui ne
// sont pas déclarés dans le type de retour de authApi.loginWithPin.
interface PinLoginExtras {
  enabled_modules?: string[];
  license_tier?: string;
}

// Erreur réseau/HTTP avec message optionnel
interface ApiError {
  message?: string;
}

export default function LoginPinScreen({ navigation }: LoginPinScreenProps) {
  const [shopCode, setShopCode] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineLogin, setIsOfflineLogin] = useState(false);

  // Ref to prevent multiple auto-submit attempts
  const hasAutoSubmittedRef = useRef(false);

  /**
   * Verify PIN against local cache for offline login.
   */
  const handleOfflineLogin = useCallback(async () => {
    try {
      const cached = await verifyOfflinePin(shopCode, pin);

      if (!cached) {
        Alert.alert(
          'Hors-ligne',
          'Impossible de se connecter hors-ligne. Aucun identifiant en cache pour cette boutique, ou le cache a expire. Connectez-vous une premiere fois avec internet.'
        );
        setShopCode('');
        setPin('');
        return;
      }

      // Restore user/shop data from cache + existing AsyncStorage tokens
      setIsOfflineLogin(true);
      await AsyncStorage.setItem(
        'user',
        JSON.stringify({
          id: cached.user_id,
          name: cached.name,
          role: cached.role,
        })
      );
      await AsyncStorage.setItem(
        'shop',
        JSON.stringify({
          id: cached.shop_id,
          code: cached.shop_code,
          enabled_modules: cached.enabled_modules,
        })
      );

      navigation.replace('Main');
    } catch (err) {
      console.error('Erreur login offline:', err);
      Alert.alert('Erreur', 'Echec de la connexion hors-ligne');
      setShopCode('');
      setPin('');
    }
  }, [shopCode, pin, navigation]);

  /**
   * Try online login first. On network error, fallback to offline PIN verification.
   */
  const handleSubmit = useCallback(async () => {
    if (shopCode.length < 4 || shopCode.length > 10) {
      Alert.alert('Erreur', 'Le code boutique doit contenir entre 4 et 10 caractères');
      return;
    }

    if (pin.length !== 4) {
      Alert.alert('Erreur', 'Le code PIN doit contenir 4 chiffres');
      return;
    }

    setIsLoading(true);
    setIsOfflineLogin(false);

    try {
      // 1. Try online login
      const response = await authApi.loginWithPin(shopCode, pin);
      const user = response.user as { id: string; name: string };
      const shop = response.shop as { id: string; enabled_modules?: string[] };
      const extras = response as PinLoginExtras;

      // Save tokens and user info
      await AsyncStorage.setItem('access_token', response.access_token);
      await AsyncStorage.setItem('refresh_token', response.refresh_token);
      await AsyncStorage.setItem('user', JSON.stringify({ ...response.user, role: response.role }));
      await AsyncStorage.setItem('shop', JSON.stringify(response.shop));
      if (response.enterprise) {
        await AsyncStorage.setItem('enterprise', JSON.stringify(response.enterprise));
      }
      if (extras.enabled_modules) {
        await AsyncStorage.setItem('enabled_modules', JSON.stringify(extras.enabled_modules));
      }
      if (extras.license_tier) {
        await AsyncStorage.setItem('license_tier', extras.license_tier);
      }

      // 2. Cache credentials for future offline login (non-blocking)
      try {
        await cacheAuthCredentials({
          userId: user.id,
          shopId: shop.id,
          shopCode,
          pin,
          name: user.name,
          role: response.role,
          enabledModules: shop.enabled_modules ?? [],
        });
      } catch (cacheErr) {
        console.warn('⚠️ Impossible de cacher les identifiants hors-ligne:', cacheErr);
      }

      navigation.replace('Main');
    } catch (error: unknown) {
      // 3. On network error, try offline login
      const message = error instanceof Error ? error.message : (error as ApiError)?.message;
      const isNetworkError =
        !!message &&
        (message.includes('Network') ||
          message.includes('fetch') ||
          message.includes('timeout') ||
          message.includes('réseau'));

      if (isNetworkError) {
        await handleOfflineLogin();
      } else {
        console.error('Erreur de connexion:', error);
        const errorMessage = message || 'Code boutique ou PIN invalide';
        Alert.alert('Erreur', errorMessage);
        setShopCode('');
        setPin('');
      }
    } finally {
      setIsLoading(false);
    }
  }, [shopCode, pin, navigation, handleOfflineLogin]);

  // Auto-submit when PIN is complete and the shop code respects the policy length
  useEffect(() => {
    const isShopCodeValid = shopCode.length >= 4 && shopCode.length <= 10;
    if (pin.length === 4 && isShopCodeValid && !isLoading && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      handleSubmit();
    }
  }, [pin, shopCode, isLoading, handleSubmit]);

  // Reset auto-submit flag when PIN is cleared (e.g., after error)
  useEffect(() => {
    if (pin.length === 0) {
      hasAutoSubmittedRef.current = false;
    }
  }, [pin]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Logo Swalo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/swalo_mark_light.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.brandWordmark}>Swalo</Text>
          <Text style={styles.appSubtitle}>Gérez, Vendez, Prospérez</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Bienvenue</Text>
          <Text style={styles.instructionText}>Entrez votre code boutique et PIN</Text>

          {/* Code Boutique */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Code Boutique</Text>
            <TextInput
              style={styles.input}
              placeholder="BTQ01"
              placeholderTextColor={Colors.textColors.tertiary}
              value={shopCode}
              onChangeText={text =>
                setShopCode(
                  text
                    .replace(/[^A-Za-z0-9]/g, '')
                    .toUpperCase()
                    .slice(0, 10)
                )
              }
              keyboardType="default"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={10}
              autoFocus
              editable={!isLoading}
            />
          </View>

          {/* Code PIN */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Code PIN (4 chiffres)</Text>
            <TextInput
              style={styles.input}
              placeholder="••••"
              placeholderTextColor={Colors.textColors.tertiary}
              value={pin}
              onChangeText={text => setPin(text.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              editable={!isLoading}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />
          </View>

          {/* Bouton de connexion */}
          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading || shopCode.length < 4 || shopCode.length > 10 || pin.length !== 4}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>SE CONNECTER</Text>
            )}
          </TouchableOpacity>

          {/* Offline indicator */}
          {isOfflineLogin && (
            <View style={styles.offlineIndicator}>
              <WifiOff size={14} color="#EA580C" />
              <Text style={styles.offlineText}>Mode hors-ligne</Text>
            </View>
          )}

          {/* Info */}
          <Text style={styles.infoText}>Les codes sont fournis par l'administrateur</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary[900],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    backgroundColor: Colors.primary[900],
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoImage: {
    width: 88,
    height: 88,
    marginBottom: Spacing.md,
  },
  brandWordmark: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.onMarine,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  appSubtitle: {
    fontSize: 14,
    color: Colors.primary[200],
  },
  formContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing['2xl'],
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: Colors.muted.foreground,
    marginBottom: Spacing['2xl'],
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: 18,
    color: Colors.text,
    letterSpacing: 2,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loginButton: {
    backgroundColor: Colors.action,
    borderRadius: 12,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    minHeight: 56,
  },
  loginButtonDisabled: {
    backgroundColor: Colors.muted.main,
    opacity: 0.6,
  },
  loginButtonText: {
    color: Colors.primary.foreground,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#FFF7ED',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDBA74',
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EA580C',
  },
  infoText: {
    fontSize: 12,
    color: Colors.muted.foreground,
    textAlign: 'center',
    marginTop: 16,
  },
});
