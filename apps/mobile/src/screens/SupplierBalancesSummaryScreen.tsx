import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building } from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem, KPICard } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { suppliersApi } from '../lib/api';

interface SupplierBalancesSummaryScreenProps {
  navigation: any;
}

interface SupplierWithBalance {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  is_active: boolean;
  total_balance: number;
}

export default function SupplierBalancesSummaryScreen({
  navigation,
}: SupplierBalancesSummaryScreenProps) {
  const [suppliers, setSuppliers] = useState<SupplierWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    setIsLoading(true);
    try {
      const data = await suppliersApi.getAll();
      setSuppliers(data);
    } catch (error: any) {
      console.error('Erreur chargement fournisseurs:', error);
      if (error.message === 'Unauthorized') {
        Alert.alert('Session expirée', 'Votre session a expiré. Veuillez vous reconnecter.', [
          {
            text: 'OK',
            onPress: () => navigation.replace('LoginPin'),
          },
        ]);
      } else {
        Alert.alert('Erreur', 'Impossible de charger les fournisseurs');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers();
    setRefreshing(false);
  };

  const getPersonName = (person: { name: string; first_name?: string }): string => {
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  // Filter and sort suppliers by balance (highest debt first)
  const filteredSuppliers = suppliers
    .filter(supplier => {
      const fullName = `${supplier.first_name || ''} ${supplier.name}`.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || supplier.phone?.includes(query);
    })
    .sort((a, b) => b.total_balance - a.total_balance);

  // Calculate summary stats
  // For suppliers: positive balance = we owe them, negative balance = they owe us
  const totalWeOwe = suppliers
    .filter(s => s.total_balance > 0)
    .reduce((sum, s) => sum + s.total_balance, 0);

  const totalTheyOwe = suppliers
    .filter(s => s.total_balance < 0)
    .reduce((sum, s) => sum + Math.abs(s.total_balance), 0);

  const suppliersWeOwe = suppliers.filter(s => s.total_balance > 0).length;
  const suppliersOweUs = suppliers.filter(s => s.total_balance < 0).length;

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return Colors.danger.main; // We owe them - red
    if (balance < 0) return Colors.success.main; // They owe us - green
    return Colors.muted.foreground; // Zero - gray
  };

  const getBalanceBadge = (balance: number) => {
    if (balance > 0) {
      return { text: 'On lui doit', variant: 'danger' as const };
    }
    if (balance < 0) {
      return { text: 'Nous doit', variant: 'success' as const };
    }
    return { text: 'Soldé', variant: 'default' as const };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Soldes Fournisseurs"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <KPICard
              label="On doit aux fournisseurs"
              value={formatMoney(totalWeOwe)}
              icon={<Building size={20} color={Colors.danger.main} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Fournisseurs nous doivent"
              value={formatMoney(totalTheyOwe)}
              icon={<Building size={20} color={Colors.success.main} />}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <KPICard label="Fournisseurs à payer" value={String(suppliersWeOwe)} />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard label="Fournisseurs débiteurs" value={String(suppliersOweUs)} />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un fournisseur..."
            placeholderTextColor={Colors.muted.foreground}
          />
        </View>

        {/* Suppliers List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Soldes par fournisseur</Text>
            <Text style={styles.cardSubtitle}>
              {filteredSuppliers.length} fournisseur{filteredSuppliers.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary[900]} />
            </View>
          ) : filteredSuppliers.length === 0 ? (
            <View style={styles.emptyState}>
              <Building size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
              </Text>
            </View>
          ) : (
            filteredSuppliers.map(supplier => (
              <ListItem
                key={supplier.id}
                icon={<Building size={20} color={getBalanceColor(supplier.total_balance)} />}
                title={getPersonName(supplier)}
                subtitle={`${supplier.total_balance < 0 ? '-' : ''}${formatMoney(Math.abs(supplier.total_balance))}`}
                badge={getBalanceBadge(supplier.total_balance)}
                onClick={() => navigation.navigate('SupplierDetails', { id: supplier.id })}
              />
            ))
          )}
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
    flex: 1,
    padding: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  searchCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing['2xl'],
  },
  searchInput: {
    fontSize: 16,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: Spacing['2xl'],
  },
  cardHeader: {
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.muted.foreground,
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
    fontSize: 14,
    color: Colors.muted.foreground,
  },
});
