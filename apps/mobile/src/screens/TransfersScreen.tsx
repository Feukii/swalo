import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeftRight,
  ArrowLeft,
  Package,
  Store,
  CheckCircle,
  XCircle,
  Clock,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, KPICard, StatusBadge } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { transfersApi } from '../lib/api';

interface Transfer {
  id: string;
  status: string;
  notes?: string;
  created_at: string;
  source_shop: { id: string; code: string; name: string; shop_type?: string };
  target_shop: { id: string; code: string; name: string; shop_type?: string };
  creator: { id: string; display_name: string };
  items: Array<{
    id: string;
    product_sku: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    cost_price: number;
    total: number;
  }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'info' | 'warning' | 'success' | 'danger' }
> = {
  DRAFT: { label: 'Brouillon', variant: 'warning' },
  CONFIRMED: { label: 'Confirme', variant: 'info' },
  SHIPPED: { label: 'Expedie', variant: 'info' },
  RECEIVED: { label: 'Recu', variant: 'success' },
  CANCELLED: { label: 'Annule', variant: 'danger' },
};

export default function TransfersScreen({ navigation }: any) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransfers = useCallback(async () => {
    try {
      const data = await transfersApi.getAll();
      setTransfers(data);
    } catch (error: any) {
      console.error('Erreur chargement transferts:', error);
      if (error.message === 'Unauthorized') {
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
      loadTransfers();
    }, [loadTransfers])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTransfers();
    setRefreshing(false);
  }, [loadTransfers]);

  const handleAction = async (
    transfer: Transfer,
    action: 'confirm' | 'ship' | 'receive' | 'cancel'
  ) => {
    const actionLabels: Record<string, { title: string; message: string; destructive?: boolean }> =
      {
        confirm: {
          title: 'Confirmer le transfert',
          message:
            'Le stock sera deduit de la boutique source et ajoute a la boutique cible. Confirmer ?',
        },
        ship: {
          title: 'Marquer comme expedie',
          message: "Confirmer l'expedition du transfert ?",
        },
        receive: {
          title: 'Confirmer la reception',
          message: 'Confirmer la reception du transfert ?',
        },
        cancel: {
          title: 'Annuler le transfert',
          message: 'Le stock sera restaure si deja confirme. Cette action est irreversible.',
          destructive: true,
        },
      };

    const config = actionLabels[action];

    Alert.alert(config.title, config.message, [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui',
        style: config.destructive ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await transfersApi[action](transfer.id);
            Alert.alert('Succes', `Transfert ${config.title.toLowerCase()} avec succes`);
            loadTransfers();
          } catch (error: any) {
            Alert.alert('Erreur', error.message || "Erreur lors de l'operation");
          }
        },
      },
    ]);
  };

  const getTransferTotal = (transfer: Transfer) => {
    return transfer.items.reduce((sum, item) => sum + item.total, 0);
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const stats = {
    total: transfers.length,
    pending: transfers.filter(t => ['DRAFT', 'CONFIRMED', 'SHIPPED'].includes(t.status)).length,
    completed: transfers.filter(t => t.status === 'RECEIVED').length,
  };

  const renderTransferCard = (transfer: Transfer) => {
    const total = getTransferTotal(transfer);
    const statusConfig = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.DRAFT;
    const itemCount = transfer.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
      <View key={transfer.id} style={styles.transferCard}>
        <View style={styles.transferHeader}>
          <View style={styles.transferDirection}>
            <Text style={styles.shopName}>{transfer.source_shop.name}</Text>
            <ArrowLeftRight size={16} color={Colors.muted.foreground} />
            <Text style={styles.shopName}>{transfer.target_shop.name}</Text>
          </View>
          <StatusBadge text={statusConfig.label} variant={statusConfig.variant} />
        </View>

        <View style={styles.transferInfo}>
          <Text style={styles.transferDate}>{formatDate(transfer.created_at)}</Text>
          <Text style={styles.transferMeta}>
            {transfer.items.length} article{transfer.items.length > 1 ? 's' : ''} - {itemCount}{' '}
            unite{itemCount > 1 ? 's' : ''}
          </Text>
          <Text style={styles.transferTotal}>{formatMoney(total)}</Text>
        </View>

        {transfer.notes ? (
          <Text style={styles.transferNotes} numberOfLines={1}>
            {transfer.notes}
          </Text>
        ) : null}

        <View style={styles.transferActions}>
          {transfer.status === 'DRAFT' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.confirmBtn]}
                onPress={() => handleAction(transfer, 'confirm')}
              >
                <CheckCircle size={14} color="#fff" />
                <Text style={styles.actionBtnText}>Confirmer</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => handleAction(transfer, 'cancel')}
              >
                <XCircle size={14} color="#fff" />
                <Text style={styles.actionBtnText}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}
          {transfer.status === 'CONFIRMED' && (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, styles.shipBtn]}
                onPress={() => handleAction(transfer, 'ship')}
              >
                <Package size={14} color="#fff" />
                <Text style={styles.actionBtnText}>Expedier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => handleAction(transfer, 'cancel')}
              >
                <XCircle size={14} color="#fff" />
                <Text style={styles.actionBtnText}>Annuler</Text>
              </TouchableOpacity>
            </>
          )}
          {transfer.status === 'SHIPPED' && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.receiveBtn]}
              onPress={() => handleAction(transfer, 'receive')}
            >
              <CheckCircle size={14} color="#fff" />
              <Text style={styles.actionBtnText}>Confirmer reception</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Transferts" showBack={true} onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Total"
              value={String(stats.total)}
              icon={<ArrowLeftRight size={20} color={Colors.muted.foreground} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard
              label="En cours"
              value={String(stats.pending)}
              icon={<Clock size={20} color={Colors.muted.foreground} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Termines"
              value={String(stats.completed)}
              icon={<CheckCircle size={20} color={Colors.muted.foreground} />}
            />
          </View>
        </View>

        {/* Transfer List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historique des transferts</Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary[900]} />
            </View>
          ) : transfers.length === 0 ? (
            <View style={styles.emptyState}>
              <ArrowLeftRight size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>Aucun transfert</Text>
              <Text style={styles.emptySubtext}>
                Les transferts inter-boutiques apparaitront ici
              </Text>
            </View>
          ) : (
            transfers.map(renderTransferCard)
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
    marginBottom: Spacing['2xl'],
  },
  section: {
    marginBottom: Spacing['2xl'],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
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
  transferCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  transferHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  transferDirection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  shopName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  transferInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  transferDate: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  transferMeta: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  transferTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary[900],
    marginLeft: 'auto',
  },
  transferNotes: {
    fontSize: 12,
    color: Colors.muted.foreground,
    fontStyle: 'italic',
    marginBottom: Spacing.sm,
  },
  transferActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBtn: {
    backgroundColor: Colors.primary[900],
  },
  shipBtn: {
    backgroundColor: '#2563EB',
  },
  receiveBtn: {
    backgroundColor: '#16A34A',
  },
  cancelBtn: {
    backgroundColor: Colors.danger.main,
  },
});
