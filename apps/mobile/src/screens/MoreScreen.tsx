import React from 'react';
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
  Receipt,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem } from '../components/ui';
import { Colors } from '../constants/theme-v2';

export default function MoreScreen({ navigation }: any) {
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
          <ListItem
            icon={<Users size={20} color={Colors.primary[900]} />}
            title="Clients"
            onClick={() => navigateToScreen('Customers')}
          />
          <ListItem
            icon={<Building size={20} color={Colors.primary[900]} />}
            title="Fournisseurs"
            onClick={() => navigateToScreen('Suppliers')}
          />
          <ListItem
            icon={<Clock size={20} color={Colors.primary[900]} />}
            title="Historique des transactions"
            onClick={() => navigateToScreen('TransactionHistory')}
          />
          <ListItem
            icon={<BarChart3 size={20} color={Colors.primary[900]} />}
            title="Rapports"
            onClick={() => navigateToScreen('BusinessReports')}
          />
          <ListItem
            icon={<Package size={20} color={Colors.primary[900]} />}
            title="Catalogue Articles"
            onClick={() => navigateToScreen('ProductCatalog')}
          />
          <ListItem
            icon={<Receipt size={20} color={Colors.primary[900]} />}
            title="Factures"
            onClick={() => navigateToScreen('InvoiceList')}
          />
          <ListItem
            icon={<Package size={20} color={Colors.primary[900]} />}
            title="Conditionnements"
            onClick={() => navigateToScreen('PackagingTypes')}
          />
          <ListItem
            icon={<UserCog size={20} color={Colors.primary[900]} />}
            title="Utilisateurs"
            onClick={() => navigateToScreen('UserManagement')}
          />
          <ListItem
            icon={<Settings size={20} color={Colors.primary[900]} />}
            title="Administration"
            onClick={() => navigateToScreen('ShopAdmin')}
          />
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
});
