import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Users } from '../components/icons/SimpleIcons';
import { ScreenHeader, ListItem, KPICard } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { customerRepo, clientReceivableRepo } from '../db/repositories';

interface CustomerBalancesSummaryNavigation {
  goBack: () => void;
  navigate: (screen: 'CustomerDetails', params: { id: string }) => void;
}

interface CustomerBalancesSummaryScreenProps {
  navigation: CustomerBalancesSummaryNavigation;
}

interface CustomerWithBalance {
  id: string;
  name: string;
  first_name?: string | null;
  phone?: string | null;
  is_active: boolean;
  total_balance: number;
}

export default function CustomerBalancesSummaryScreen({
  navigation,
}: CustomerBalancesSummaryScreenProps) {
  const { shopId } = useCurrentUser();
  const [customers, setCustomers] = useState<CustomerWithBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomers = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const localCustomers = await customerRepo.getAll(shopId, { orderBy: 'name ASC' });
      const allReceivables = await clientReceivableRepo.getAll(shopId);

      // Compute balance per customer
      const balanceMap = new Map<string, number>();
      allReceivables.forEach(r => {
        const prev = balanceMap.get(r.customer_id) || 0;
        balanceMap.set(r.customer_id, prev + r.balance);
      });

      const customersWithBalance: CustomerWithBalance[] = localCustomers.map(c => ({
        id: c.id,
        name: c.name,
        first_name: c.first_name,
        phone: c.phone,
        is_active: c.is_active === 1,
        total_balance: balanceMap.get(c.id) || 0,
      }));

      setCustomers(customersWithBalance);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  };

  const getPersonName = (person: { name: string; first_name?: string }): string => {
    return person.first_name ? `${person.first_name} ${person.name}` : person.name;
  };

  // Filter and sort customers by balance (highest debt first)
  const filteredCustomers = customers
    .filter(customer => {
      const fullName = `${customer.first_name || ''} ${customer.name}`.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || customer.phone?.includes(query);
    })
    .sort((a, b) => b.total_balance - a.total_balance);

  // Calculate summary stats
  const totalOwedToUs = customers
    .filter(c => c.total_balance > 0)
    .reduce((sum, c) => sum + c.total_balance, 0);

  const totalWeOwe = customers
    .filter(c => c.total_balance < 0)
    .reduce((sum, c) => sum + Math.abs(c.total_balance), 0);

  const customersWithDebt = customers.filter(c => c.total_balance > 0).length;
  const customersWeOwe = customers.filter(c => c.total_balance < 0).length;

  const getBalanceColor = (balance: number) => {
    if (balance > 0) return Colors.success.main; // They owe us - green
    if (balance < 0) return Colors.danger.main; // We owe them - red
    return Colors.muted.foreground; // Zero - gray
  };

  const getBalanceBadge = (balance: number) => {
    if (balance > 0) {
      return { text: 'Nous doit', variant: 'success' as const };
    }
    if (balance < 0) {
      return { text: 'Remboursement dû', variant: 'danger' as const };
    }
    return { text: 'Soldé', variant: 'default' as const };
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Soldes Clients" showBack={true} onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Clients nous doivent"
              value={formatMoney(totalOwedToUs)}
              icon={<Users size={20} color={Colors.success.main} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Remboursements dus"
              value={formatMoney(totalWeOwe)}
              icon={<Users size={20} color={Colors.danger.main} />}
            />
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <KPICard label="Clients débiteurs" value={String(customersWithDebt)} />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard label="Clients à rembourser" value={String(customersWeOwe)} />
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchCard}>
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Rechercher un client..."
            placeholderTextColor={Colors.muted.foreground}
          />
        </View>

        {/* Customers List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Soldes par client</Text>
            <Text style={styles.cardSubtitle}>
              {filteredCustomers.length} client{filteredCustomers.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.action} />
            </View>
          ) : filteredCustomers.length === 0 ? (
            <View style={styles.emptyState}>
              <Users size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Aucun client trouvé' : 'Aucun client enregistré'}
              </Text>
            </View>
          ) : (
            filteredCustomers.map(customer => (
              <ListItem
                key={customer.id}
                icon={<Users size={20} color={getBalanceColor(customer.total_balance)} />}
                title={getPersonName(customer)}
                subtitle={`${customer.total_balance < 0 ? '-' : ''}${formatMoney(Math.abs(customer.total_balance))}`}
                badge={getBalanceBadge(customer.total_balance)}
                onClick={() => navigation.navigate('CustomerDetails', { id: customer.id })}
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
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  searchInput: {
    fontSize: 16,
    color: Colors.text,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  cardHeader: {
    padding: Spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
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
