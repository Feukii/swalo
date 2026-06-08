import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Users,
  Building,
  BarChart3,
  UserCog,
  Settings,
  LogOut,
  Package,
  Clock,
  Receipt,
  RefreshCw,
  ArrowLeftRight,
  Store,
  Lock,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem } from '../components/ui';
import { Colors } from '../constants/theme-v2';

const MENU_ITEMS = [
  { icon: Users, title: 'Clients', screen: 'Customers', module: 'customers' },
  { icon: Building, title: 'Fournisseurs', screen: 'Suppliers', module: 'suppliers' },
  {
    icon: Clock,
    title: 'Historique des transactions',
    screen: 'TransactionHistory',
    module: 'sales',
  },
  { icon: BarChart3, title: 'Rapports', screen: 'BusinessReports', module: 'reports' },
  {
    icon: Package,
    title: 'Catalogue Articles',
    screen: 'ProductCatalog',
    module: 'products',
  },
  {
    icon: Receipt,
    title: 'Factures',
    screen: 'InvoiceList',
    module: 'invoices',
  },
  { icon: UserCog, title: 'Utilisateurs', screen: 'UserManagement', module: 'admin' },
  {
    icon: ArrowLeftRight,
    title: 'Transferts inter-boutiques',
    screen: 'Transfers',
    module: 'transfers',
  },
  { icon: Store, title: 'Mes boutiques', screen: 'ShopSwitcher', module: 'enterprise' },
  { icon: RefreshCw, title: 'Synchronisation', screen: 'SyncStatus' },
  { icon: Settings, title: 'Administration', screen: 'ShopAdmin' },
];

export default function MoreScreen({ navigation }: any) {
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [licenseTier, setLicenseTier] = useState<string>('STARTER');

  // Bug 9: Recharger les modules a chaque focus (au lieu de useEffect([]))
  useFocusEffect(
    useCallback(() => {
      const loadModules = async () => {
        try {
          const modules = await AsyncStorage.getItem('enabled_modules');
          const tier = await AsyncStorage.getItem('license_tier');
          if (modules) setEnabledModules(JSON.parse(modules));
          if (tier) setLicenseTier(tier);
        } catch {
          // Fallback: all modules allowed
        }
      };
      loadModules();
    }, [])
  );

  const isModuleEnabled = (moduleCode?: string): boolean => {
    if (!moduleCode) return true;
    // Empty array = all allowed (backwards compat)
    if (enabledModules.length === 0) return true;
    return enabledModules.includes(moduleCode);
  };

  const handleDisabledModule = (name: string) => {
    Alert.alert(
      'Module non disponible',
      `Vous avez une licence ${licenseTier}. Le module "${name}" n'est pas inclus dans votre licence actuelle. Contactez votre administrateur.`
    );
  };
  const handleLogout = async () => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('access_token');
            await AsyncStorage.removeItem('refresh_token');
            await AsyncStorage.removeItem('user');
            await AsyncStorage.removeItem('shop');
            navigation.getParent()?.reset({
              index: 0,
              routes: [{ name: 'LoginPin' }],
            });
          } catch (error) {
            console.error('Erreur lors de la déconnexion:', error);
          }
        },
      },
    ]);
  };

  const navigateToScreen = (screenName: string) => {
    // Utiliser getParent() pour accéder au Stack Navigator parent
    navigation.getParent()?.navigate(screenName);
  };

  // Bug 8a: Séparer modules actifs et non disponibles
  const enabledItems = MENU_ITEMS.filter(item => isModuleEnabled(item.module));
  const disabledItems = MENU_ITEMS.filter(item => !isModuleEnabled(item.module));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Plus" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Modules actifs */}
        <View style={styles.card}>
          {enabledItems.map(item => {
            const IconComponent = item.icon;
            return (
              <ListItem
                key={item.screen}
                icon={<IconComponent size={20} color={Colors.primary[900]} />}
                title={item.title}
                onClick={() => navigateToScreen(item.screen)}
              />
            );
          })}
        </View>

        {/* Modules non disponibles */}
        {disabledItems.length > 0 && (
          <View style={styles.disabledSection}>
            <Text style={styles.sectionTitle}>Modules non disponibles</Text>
            <View style={styles.card}>
              {disabledItems.map(item => (
                <View key={item.screen} style={styles.disabledItem}>
                  <ListItem
                    icon={<Lock size={20} color={Colors.textColors.disabled} />}
                    title={item.title}
                    onClick={() => handleDisabledModule(item.title)}
                  />
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={[styles.card, { marginTop: 24 }]}>
          <ListItem
            icon={<LogOut size={20} color={Colors.danger.main} />}
            title="Déconnexion"
            onClick={handleLogout}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  disabledSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.muted.foreground,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disabledItem: {
    opacity: 0.4,
  },
});
