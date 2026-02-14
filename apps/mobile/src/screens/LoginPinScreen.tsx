import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
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

const { width } = Dimensions.get('window');

interface LoginPinScreenProps {
  navigation: any;
}

export default function LoginPinScreen({ navigation }: LoginPinScreenProps) {
  const [shopCode, setShopCode] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineLogin, setIsOfflineLogin] = useState(false);

  // Ref to prevent multiple auto-submit attempts
  const hasAutoSubmittedRef = useRef(false);

  // Auto-submit when PIN reaches 4 digits and shop code is complete
  useEffect(() => {
    if (pin.length === 4 && shopCode.length === 6 && !isLoading && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      handleSubmit();
    }
  }, [pin, shopCode, isLoading]);

  // Reset auto-submit flag when PIN is cleared (e.g., after error)
  useEffect(() => {
    if (pin.length === 0) {
      hasAutoSubmittedRef.current = false;
    }
  }, [pin]);

  /**
   * Try online login first. On network error, fallback to offline PIN verification.
   */
  const handleSubmit = async () => {
    if (shopCode.length !== 6) {
      Alert.alert('Erreur', 'Le code boutique doit contenir 6 chiffres');
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

      // Save tokens and user info
      await AsyncStorage.setItem('access_token', response.access_token);
      await AsyncStorage.setItem('refresh_token', response.refresh_token);
      await AsyncStorage.setItem('user', JSON.stringify({ ...response.user, role: response.role }));
      await AsyncStorage.setItem('shop', JSON.stringify(response.shop));
      if (response.enterprise) {
        await AsyncStorage.setItem('enterprise', JSON.stringify(response.enterprise));
      }

      // 2. Cache credentials for future offline login
      await cacheAuthCredentials({
        userId: response.user.id,
        shopId: response.shop.id,
        shopCode,
        pin,
        name: response.user.name,
        role: response.role,
        enabledModules: response.shop.enabled_modules ?? [],
      });

      navigation.replace('Main');
    } catch (error: any) {
      // 3. On network error, try offline login
      const isNetworkError =
        error?.message?.includes('Network') ||
        error?.message?.includes('fetch') ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('réseau');

      if (isNetworkError) {
        await handleOfflineLogin();
      } else {
        console.error('Erreur de connexion:', error);
        const errorMessage = error?.message || 'Code boutique ou PIN invalide';
        Alert.alert('Erreur', errorMessage);
        setShopCode('');
        setPin('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Verify PIN against local cache for offline login.
   */
  const handleOfflineLogin = async () => {
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {/* Logo SWALO */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/full_icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.appSubtitle}>Gérez, Vendez, Prospérez</Text>
        </View>

        {/* Formulaire */}
        <View style={styles.formContainer}>
          <Text style={styles.welcomeText}>Bienvenue</Text>
          <Text style={styles.instructionText}>Entrez votre code boutique et PIN</Text>

          {/* Code Boutique */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Code Boutique (6 chiffres)</Text>
            <TextInput
              style={styles.input}
              placeholder="123456"
              placeholderTextColor={Colors.textColors.tertiary}
              value={shopCode}
              onChangeText={text => setShopCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="numeric"
              maxLength={6}
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
            disabled={isLoading || shopCode.length !== 6 || pin.length !== 4}
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
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    backgroundColor: Colors.background,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoImage: {
    width: 200,
    height: 80,
    marginBottom: Spacing.lg,
  },
  appSubtitle: {
    fontSize: 14,
    color: Colors.muted.foreground,
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
    backgroundColor: Colors.primary[900],
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
