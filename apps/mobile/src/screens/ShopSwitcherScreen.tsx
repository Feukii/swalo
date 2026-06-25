import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store, CheckCircle, Building } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { shopSwitchApi } from '../lib/api';
import type { RootStackParamList } from '../../App';

interface AccessibleShop {
  shop: {
    id: string;
    code: string;
    name: string;
    shop_type: string;
    enterprise_id: string | null;
    enterprise: { id: string; code: string; name: string } | null;
  };
  role: string;
}

interface ShopSwitcherScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ShopSwitcher'>;
}

export default function ShopSwitcherScreen({ navigation }: ShopSwitcherScreenProps) {
  const [shops, setShops] = useState<AccessibleShop[]>([]);
  const [currentShopId, setCurrentShopId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);

  const loadShops = useCallback(async () => {
    try {
      const shopData = await AsyncStorage.getItem('shop');
      if (shopData) {
        const parsed = JSON.parse(shopData);
        setCurrentShopId(parsed.id);
      }

      const data = await shopSwitchApi.getAccessibleShops();
      setShops(data);
    } catch (error: unknown) {
      console.error('Erreur chargement boutiques:', error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        Alert.alert('Session expiree', 'Veuillez vous reconnecter.', [
          { text: 'OK', onPress: () => navigation.replace('LoginPin') },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadShops();
    }, [loadShops])
  );

  const handleSwitchShop = async (shop: AccessibleShop) => {
    if (shop.shop.id === currentShopId) return;

    Alert.alert('Changer de boutique', `Basculer vers "${shop.shop.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          setIsSwitching(true);
          try {
            const result = await shopSwitchApi.switchShop(shop.shop.id);

            // Save new tokens and shop info
            await AsyncStorage.setItem('access_token', result.access_token);
            await AsyncStorage.setItem('refresh_token', result.refresh_token);
            await AsyncStorage.setItem('shop', JSON.stringify(result.shop));
            await AsyncStorage.setItem('user', JSON.stringify(result.user));
            await AsyncStorage.setItem('role', result.role);

            // Mettre à jour l'entreprise active (sinon le nom d'entreprise reste périmé)
            if (shop.shop.enterprise) {
              await AsyncStorage.setItem('enterprise', JSON.stringify(shop.shop.enterprise));
            } else {
              await AsyncStorage.removeItem('enterprise');
            }

            setCurrentShopId(shop.shop.id);

            Alert.alert('Succes', `Vous etes maintenant sur "${shop.shop.name}"`, [
              {
                text: 'OK',
                // Réinitialiser vers l'app principale: tous les écrans (qui lisent le
                // contexte boutique au montage) rechargent ainsi la nouvelle boutique.
                onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }),
              },
            ]);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : '';
            Alert.alert('Erreur', message || 'Impossible de changer de boutique');
          } finally {
            setIsSwitching(false);
          }
        },
      },
    ]);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      BOSS: 'Proprietaire',
      MANAGER: 'Gerant',
      EMPLOYEE: 'Employe',
    };
    return labels[role] || role;
  };

  const getShopTypeLabel = (type: string) => {
    return type === 'MAGASIN' ? 'Magasin' : 'Boutique';
  };

  // Group shops by enterprise
  const groupedShops: Record<string, { name: string; shops: AccessibleShop[] }> = {};
  const standaloneShops: AccessibleShop[] = [];

  for (const item of shops) {
    if (item.shop.enterprise) {
      const key = item.shop.enterprise.id;
      if (!groupedShops[key]) {
        groupedShops[key] = { name: item.shop.enterprise.name, shops: [] };
      }
      groupedShops[key].shops.push(item);
    } else {
      standaloneShops.push(item);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Mes boutiques" showBack={true} onBack={() => navigation.goBack()} />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.action} />
          </View>
        ) : shops.length <= 1 ? (
          <View style={styles.emptyState}>
            <Store size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>Une seule boutique</Text>
            <Text style={styles.emptySubtext}>Vous n'avez acces qu'a une seule boutique</Text>
          </View>
        ) : (
          <>
            {Object.entries(groupedShops).map(([enterpriseId, group]) => (
              <View key={enterpriseId} style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Building size={18} color={Colors.action} />
                  <Text style={styles.sectionTitle}>{group.name}</Text>
                </View>
                {group.shops.map(item => (
                  <TouchableOpacity
                    key={item.shop.id}
                    style={[
                      styles.shopCard,
                      item.shop.id === currentShopId && styles.shopCardActive,
                    ]}
                    onPress={() => handleSwitchShop(item)}
                    disabled={isSwitching || item.shop.id === currentShopId}
                  >
                    <View style={styles.shopIcon}>
                      <Store
                        size={24}
                        color={
                          item.shop.id === currentShopId ? Colors.action : Colors.muted.foreground
                        }
                      />
                    </View>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName}>{item.shop.name}</Text>
                      <Text style={styles.shopMeta}>
                        {item.shop.code} - {getShopTypeLabel(item.shop.shop_type)} -{' '}
                        {getRoleLabel(item.role)}
                      </Text>
                    </View>
                    {item.shop.id === currentShopId && (
                      <CheckCircle size={20} color={Colors.action} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {standaloneShops.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Boutiques independantes</Text>
                {standaloneShops.map(item => (
                  <TouchableOpacity
                    key={item.shop.id}
                    style={[
                      styles.shopCard,
                      item.shop.id === currentShopId && styles.shopCardActive,
                    ]}
                    onPress={() => handleSwitchShop(item)}
                    disabled={isSwitching || item.shop.id === currentShopId}
                  >
                    <View style={styles.shopIcon}>
                      <Store
                        size={24}
                        color={
                          item.shop.id === currentShopId ? Colors.action : Colors.muted.foreground
                        }
                      />
                    </View>
                    <View style={styles.shopInfo}>
                      <Text style={styles.shopName}>{item.shop.name}</Text>
                      <Text style={styles.shopMeta}>
                        {item.shop.code} - {getRoleLabel(item.role)}
                      </Text>
                    </View>
                    {item.shop.id === currentShopId && (
                      <CheckCircle size={20} color={Colors.action} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {isSwitching && (
        <View style={styles.switchingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.switchingText}>Changement de boutique...</Text>
        </View>
      )}
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
    padding: Spacing.lg,
  },
  loadingContainer: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  shopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  shopCardActive: {
    borderColor: Colors.action,
    borderWidth: 2,
    backgroundColor: `${Colors.action}0F`,
  },
  shopIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  shopMeta: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: 2,
  },
  switchingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  switchingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
