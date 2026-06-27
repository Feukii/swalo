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
import { FileText, Printer, Send } from '../../components/icons/SimpleIcons';
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
  return new Intl.NumberFormat('fr-FR').format(amount) + ' F';
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}

function formatDueDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
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

  // Facture mise en avant : la plus récente / en tête de liste
  const featuredInvoice = invoices[0];

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
        <Text style={styles.invoiceNumber} numberOfLines={1}>
          {item.number}
        </Text>
        <Text style={styles.invoiceMeta} numberOfLines={1}>
          {getCustomerName(item.customer)} · {formatDate(item.created_at)}
        </Text>
      </View>
      <View style={styles.invoiceRight}>
        <Text style={styles.invoiceAmount}>{formatFCFA(item.grand_total)}</Text>
        {renderStatusBadge(item.status)}
      </View>
    </TouchableOpacity>
  );

  const renderFeatured = () => {
    if (!featuredInvoice) return null;
    return (
      <View style={styles.featuredCard}>
        <View style={styles.featuredTopRow}>
          <View style={styles.featuredCol}>
            <Text style={styles.featuredLabel}>FACTURE À</Text>
            <Text style={styles.featuredClient} numberOfLines={1}>
              {getCustomerName(featuredInvoice.customer)}
            </Text>
          </View>
          {featuredInvoice.created_at ? (
            <View style={[styles.featuredCol, styles.featuredColRight]}>
              <Text style={styles.featuredLabel}>ÉCHÉANCE</Text>
              <Text style={styles.featuredDue} numberOfLines={1}>
                {formatDueDate(featuredInvoice.created_at)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.featuredDivider} />

        <View style={styles.featuredBottomRow}>
          <View style={styles.featuredCol}>
            <Text style={styles.featuredLabel}>TOTAL DÛ</Text>
            <Text style={styles.featuredAmount}>{formatFCFA(featuredInvoice.grand_total)}</Text>
          </View>
          <View style={styles.featuredActions}>
            <TouchableOpacity
              style={styles.featuredPdfBtn}
              onPress={() => handleInvoicePress(featuredInvoice)}
              activeOpacity={0.7}
            >
              <Printer size={16} color={Colors.action} />
              <Text style={styles.featuredPdfText}>PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.featuredSendBtn}
              onPress={() => handleInvoicePress(featuredInvoice)}
              activeOpacity={0.7}
            >
              <Send size={16} color={Colors.onMarine} />
              <Text style={styles.featuredSendText}>Envoyer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const renderListHeader = () => (
    <View>
      {renderFeatured()}
      <Text style={styles.sectionHeader}>TOUTES LES FACTURES · {invoices.length}</Text>
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
        subtitle="Émission & suivi"
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
          ListHeaderComponent={invoices.length > 0 ? renderListHeader : null}
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
  // CARTE FACTURE EN AVANT
  featuredCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  featuredTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  featuredCol: {
    flexShrink: 1,
  },
  featuredColRight: {
    alignItems: 'flex-end',
    marginLeft: Spacing.md,
  },
  featuredLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.muted.foreground,
    letterSpacing: 0.5,
  },
  featuredClient: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  featuredDue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 2,
  },
  featuredDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  featuredBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredAmount: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  featuredActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  featuredPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  featuredPdfText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.action,
  },
  featuredSendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.action,
  },
  featuredSendText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  // EN-TÊTE DE SECTION
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.muted.foreground,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  invoiceItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    alignItems: 'center',
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
    marginRight: Spacing.sm,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  invoiceMeta: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  invoiceAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary[900],
    fontVariant: ['tabular-nums'],
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
