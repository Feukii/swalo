import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  RefreshCw,
  ArrowLeftRight,
  Store,
  Lock,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem } from '../components/ui';
import { Colors } from '../constants/theme-v2';

export default function MoreScreen({ navigation }: any) {
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [licenseTier, setLicenseTier] = useState<string>('STARTER');

  useEffect(() => {
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
  }, []);

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Plus" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          {[
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
          ].map(item => {
            const enabled = isModuleEnabled(item.module);
            const IconComponent = item.icon;
            return (
              <View key={item.screen} style={!enabled ? styles.disabledItem : undefined}>
                <ListItem
                  icon={
                    enabled ? (
                      <IconComponent size={20} color={Colors.primary[900]} />
                    ) : (
                      <Lock size={20} color={Colors.textColors.disabled} />
                    )
                  }
                  title={item.title}
                  onClick={() =>
                    enabled ? navigateToScreen(item.screen) : handleDisabledModule(item.title)
                  }
                />
              </View>
            );
          })}
        </View>

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
  disabledItem: {
    opacity: 0.4,
  },
});
