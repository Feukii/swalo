import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { FileText, Eye } from '../../components/icons/SimpleIcons';
import { ScreenHeader, StatusBadge } from '../../components/ui';
import { Colors, Spacing, Shadows } from '../../constants/theme-v2';
import { invoicesApi } from '../../lib/api';

interface Invoice {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
  grand_total: number;
  created_at: string;
  customer?: {
    id: string;
    name: string;
    first_name?: string;
  };
}

interface InvoiceListScreenNavigation {
  goBack: () => void;
  replace: (screen: 'LoginPin') => void;
}

interface InvoiceListScreenProps {
  navigation: InvoiceListScreenNavigation;
}

type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'default';

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  ISSUED: { label: 'Émise', variant: 'info' },
  PAID: { label: 'Payée', variant: 'success' },
  DRAFT: { label: 'Brouillon', variant: 'default' },
  CANCELLED: { label: 'Annulée', variant: 'danger' },
};

function formatFCFA(amount: number): string {
  return new Intl.NumberFormat('fr-FR').format(amount) + ' FCFA';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getCustomerName(customer?: { name: string; first_name?: string }): string {
  if (!customer) return 'Client inconnu';
  return customer.first_name ? `${customer.first_name} ${customer.name}` : customer.name;
}

export default function InvoiceListScreen({ navigation }: InvoiceListScreenProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInvoices = useCallback(async () => {
    try {
      const data = await invoicesApi.getAll<Invoice>();
      setInvoices(data);
    } catch (error: unknown) {
      console.error('Erreur chargement factures:', error);
      if (error instanceof Error && error.message === 'Unauthorized') {
        Alert.alert('Session expiree', 'Votre session a expire. Veuillez vous reconnecter.', [
          {
            text: 'OK',
            onPress: () => navigation.replace('LoginPin'),
          },
        ]);
      } else {
        Alert.alert('Erreur', 'Impossible de charger les factures');
      }
    }
  }, [navigation]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadInvoices();
      setIsLoading(false);
    };
    init();
  }, [loadInvoices]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInvoices();
    setRefreshing(false);
  }, [loadInvoices]);

  const handleInvoicePress = (invoice: Invoice) => {
    Alert.alert('Facture', `Facture ${invoice.number}`);
  };

  // Total facturé (hors annulées) — métrique de la carte hero
  const totalInvoiced = invoices
    .filter(inv => inv.status !== 'CANCELLED')
    .reduce((sum, inv) => sum + inv.grand_total, 0);

  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
    return <StatusBadge text={config.label} variant={config.variant} />;
  };

  const renderInvoiceItem = ({ item }: { item: Invoice }) => (
    <TouchableOpacity
      style={styles.invoiceItem}
      onPress={() => handleInvoicePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.invoiceIconContainer}>
        <FileText size={20} color={Colors.action} />
      </View>
      <View style={styles.invoiceContent}>
        <View style={styles.invoiceTopRow}>
          <Text style={styles.invoiceNumber} numberOfLines={1}>
            {item.number}
          </Text>
          {renderStatusBadge(item.status)}
        </View>
        <Text style={styles.invoiceCustomer} numberOfLines={1}>
          {getCustomerName(item.customer)}
        </Text>
        <View style={styles.invoiceBottomRow}>
          <Text style={styles.invoiceDate}>{formatDate(item.created_at)}</Text>
          <Text style={styles.invoiceAmount}>{formatFCFA(item.grand_total)}</Text>
        </View>
      </View>
      <View style={styles.invoiceAction}>
        <Eye size={20} color={Colors.action} />
      </View>
    </TouchableOpacity>
  );

  const renderHero = () => (
    <View style={styles.hero}>
      <Text style={styles.heroLabel}>Total facturé</Text>
      <Text style={styles.heroAmount}>{formatFCFA(totalInvoiced)}</Text>
      <Text style={styles.heroMeta}>
        {invoices.length} {invoices.length > 1 ? 'factures' : 'facture'}
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconCircle}>
        <FileText size={32} color={Colors.action} />
      </View>
      <Text style={styles.emptyText}>Aucune facture</Text>
      <Text style={styles.emptySubtext}>Les factures apparaitront ici une fois creees.</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Factures"
        subtitle="Documents de vente"
        showBack={true}
        onBack={() => navigation.goBack()}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
          <Text style={styles.loadingText}>Chargement des factures...</Text>
        </View>
      ) : (
        <FlatList
          data={invoices}
          keyExtractor={item => item.id}
          renderItem={renderInvoiceItem}
          ListHeaderComponent={invoices.length > 0 ? renderHero : null}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            invoices.length === 0 ? styles.emptyListContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.action]}
              tintColor={Colors.action}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  listContent: {
    padding: Spacing.lg,
  },
  emptyListContent: {
    flex: 1,
    padding: Spacing.lg,
  },
  // HERO MARINE
  hero: {
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  heroLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.action,
  },
  heroAmount: {
    fontSize: 30,
    fontWeight: '800',
    color: Colors.onMarine,
    marginTop: Spacing.xs,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroMeta: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: Spacing.xs,
  },
  invoiceItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'flex-start',
    ...Shadows.sm,
  },
  invoiceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.info.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  invoiceContent: {
    flex: 1,
  },
  invoiceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
    marginRight: Spacing.sm,
  },
  invoiceCustomer: {
    fontSize: 14,
    color: Colors.textColors.secondary,
    marginBottom: 6,
  },
  invoiceBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary[900],
    fontVariant: ['tabular-nums'],
  },
  invoiceAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.info.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  separator: {
    height: Spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing['3xl'],
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.info.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
});
