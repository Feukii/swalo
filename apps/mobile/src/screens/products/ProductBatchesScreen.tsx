import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Package } from '../../components/icons/SimpleIcons';
import { ScreenHeader } from '../../components/ui';
import { Colors, Spacing } from '../../constants/theme-v2';
import { formatMoney } from '../../utils/money';
import { stockBatchRepo, LocalStockBatch } from '../../db/repositories';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface BatchStats {
  total_batches: number;
  batches_with_stock: number;
  total_quantity: number;
  total_value: number;
}

interface ProductBatchesScreenProps {
  navigation: {
    goBack: () => void;
  };
  route: {
    params: {
      productId: string;
      productName: string;
    };
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export default function ProductBatchesScreen({ navigation, route }: ProductBatchesScreenProps) {
  const { productId, productName } = route.params;
  const { shopId } = useCurrentUser();
  const [batches, setBatches] = useState<LocalStockBatch[]>([]);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBatches = useCallback(
    async (showRefresh = false) => {
      if (!shopId) return;

      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const localBatches = await stockBatchRepo.getByProduct(shopId, productId, false);
        setBatches(localBatches);

        const batchesWithStock = localBatches.filter(b => b.remaining_quantity > 0);
        setStats({
          total_batches: localBatches.length,
          batches_with_stock: batchesWithStock.length,
          total_quantity: batchesWithStock.reduce((s, b) => s + b.remaining_quantity, 0),
          total_value: batchesWithStock.reduce(
            (s, b) => s + b.remaining_quantity * b.cost_price,
            0
          ),
        });
      } catch (error: unknown) {
        console.error('Erreur chargement lots:', error);
        Alert.alert('Erreur', 'Impossible de charger les lots de stock');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [shopId, productId]
  );

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useFocusEffect(
    useCallback(() => {
      loadBatches();
    }, [loadBatches])
  );

  const renderBatchCard = ({ item }: { item: LocalStockBatch }) => {
    const isExhausted = item.remaining_quantity === 0;
    const progressRatio = item.quantity > 0 ? item.remaining_quantity / item.quantity : 0;
    const progressPercent = Math.round(progressRatio * 100);

    return (
      <View style={[styles.batchCard, isExhausted && styles.batchCardExhausted]}>
        <View style={styles.batchHeader}>
          <View style={styles.batchDateContainer}>
            <Text style={styles.batchDateLabel}>Lot du</Text>
            <Text style={styles.batchDate}>{formatDate(item.created_at)}</Text>
          </View>
          {isExhausted && (
            <View style={styles.exhaustedBadge}>
              <Text style={styles.exhaustedBadgeText}>Epuis{'\u00e9'}</Text>
            </View>
          )}
        </View>

        <View style={styles.batchPrices}>
          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Prix d'achat</Text>
            <Text style={styles.priceValue}>{formatMoney(item.cost_price)}</Text>
          </View>
          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Prix de vente</Text>
            <Text style={[styles.priceValue, styles.sellPriceValue]}>
              {formatMoney(item.sell_price)}
            </Text>
          </View>
          <View style={styles.priceColumn}>
            <Text style={styles.priceLabel}>Marge</Text>
            <Text style={[styles.priceValue, styles.marginValue]}>
              {formatMoney(item.sell_price - item.cost_price)}
            </Text>
          </View>
        </View>

        <View style={styles.batchQuantity}>
          <Text style={styles.quantityLabel}>
            Restant: {item.remaining_quantity} / {item.quantity} unit{'\u00e9'}s
          </Text>
          <Text style={styles.quantityPercent}>{progressPercent}%</Text>
        </View>

        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${progressPercent}%`,
                backgroundColor: isExhausted
                  ? Colors.danger.main
                  : progressRatio <= 0.25
                    ? Colors.warning.main
                    : Colors.success.main,
              },
            ]}
          />
        </View>

        {item.notes ? <Text style={styles.batchNotes}>{item.notes}</Text> : null}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Package size={48} color={Colors.muted.foreground} />
      <Text style={styles.emptyText}>Aucun lot de stock pour ce produit</Text>
      <Text style={styles.emptySubtext}>
        Les lots sont cr{'\u00e9'}
        {'\u00e9'}s lors de l'approvisionnement
      </Text>
    </View>
  );

  const renderStatsHeader = () => {
    if (!stats) return null;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardInfo]}>
            <Text style={styles.statValue}>{stats.total_batches}</Text>
            <Text style={styles.statLabel}>Total lots</Text>
          </View>
          <View style={[styles.statCard, styles.statCardSuccess]}>
            <Text style={styles.statValue}>{stats.batches_with_stock}</Text>
            <Text style={styles.statLabel}>Avec stock</Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardPrimary]}>
            <Text style={styles.statValue}>{stats.total_quantity}</Text>
            <Text style={styles.statLabel}>Qt{'\u00e9'} totale</Text>
          </View>
          <View style={[styles.statCard, styles.statCardWarning]}>
            <Text style={styles.statValue}>{formatMoney(stats.total_value)}</Text>
            <Text style={styles.statLabel}>Valeur stock</Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Lots en stock" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Lots en stock" showBack onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        <Text style={styles.subtitle}>{productName}</Text>

        {renderStatsHeader()}

        <FlatList
          data={batches}
          keyExtractor={item => item.id}
          renderItem={renderBatchCard}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            batches.length === 0 ? styles.emptyListContainer : styles.listContainer
          }
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadBatches(true)}
              tintColor={Colors.primary[900]}
            />
          }
        />
      </View>
    </SafeAreaView>
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
    padding: Spacing['2xl'],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.muted.foreground,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.muted.foreground,
    marginBottom: Spacing.lg,
    fontWeight: '500',
  },
  // Stats
  statsContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statCardInfo: {
    backgroundColor: Colors.info.main + '15',
  },
  statCardSuccess: {
    backgroundColor: Colors.success.main + '15',
  },
  statCardPrimary: {
    backgroundColor: Colors.primary[50],
  },
  statCardWarning: {
    backgroundColor: Colors.warning.main + '15',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
  // List
  listContainer: {
    paddingBottom: Spacing['3xl'],
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  // Batch card
  batchCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  batchCardExhausted: {
    opacity: 0.6,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  batchDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  batchDateLabel: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  batchDate: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  exhaustedBadge: {
    backgroundColor: Colors.danger.main + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  exhaustedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.danger.main,
  },
  // Prices
  batchPrices: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  priceColumn: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  priceLabel: {
    fontSize: 11,
    color: Colors.muted.foreground,
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  sellPriceValue: {
    color: Colors.primary[900],
  },
  marginValue: {
    color: Colors.success.main,
  },
  // Quantity
  batchQuantity: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  quantityLabel: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  quantityPercent: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  // Progress bar
  progressBarBackground: {
    height: 6,
    backgroundColor: Colors.muted.main,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Notes
  batchNotes: {
    fontSize: 12,
    color: Colors.muted.foreground,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
});
