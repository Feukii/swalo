import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Package,
  Search,
  Plus,
  TrendingDown,
  AlertTriangle,
  DollarSign,
} from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { productRepo, stockBatchRepo } from '../db/repositories';
import { createStockBatchOffline } from '../db/offlineWrite';

interface StockItem {
  id: string;
  reference: string;
  family: string;
  article_type: string;
  brand: string;
  current_stock: number;
  alert_threshold: number;
  cost_price?: number;
  sell_price?: number;
}

export default function StockManagementScreen({ navigation }: any) {
  const { shopId } = useCurrentUser();
  const [products, setProducts] = useState<StockItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<StockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal d'approvisionnement
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  const [stockQuantity, setStockQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadProducts = useCallback(
    async (showRefresh = false) => {
      if (!shopId) return;
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const localProducts = await productRepo.getAll(shopId, {
          where: { is_active: 1 },
          orderBy: 'name ASC',
        });
        const enriched = await Promise.all(
          localProducts.map(async p => {
            const totalStock = await stockBatchRepo.getTotalStock(shopId, p.id);
            return {
              ...p,
              current_stock: totalStock,
              is_active: true,
            } as StockItem;
          })
        );
        setProducts(enriched);
        setFilteredProducts(enriched);
      } catch (error) {
        console.error('Erreur chargement produits:', error);
        if (products.length === 0) {
          Alert.alert('Erreur', 'Impossible de charger les produits');
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [shopId]
  );

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [loadProducts])
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = products.filter(
        p =>
          p.reference?.toLowerCase().includes(query) ||
          p.family?.toLowerCase().includes(query) ||
          p.article_type?.toLowerCase().includes(query) ||
          p.brand?.toLowerCase().includes(query)
      );
      setFilteredProducts(filtered);
    }
  }, [searchQuery, products]);

  const openStockModal = (product: StockItem) => {
    setSelectedProduct(product);
    setStockQuantity('');
    setUnitPrice(product.cost_price ? String(product.cost_price) : '');
    setSellingPrice(product.sell_price ? String(product.sell_price) : '');
    setShowStockModal(true);
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setSelectedProduct(null);
    setStockQuantity('');
    setUnitPrice('');
    setSellingPrice('');
  };

  const handleStockUpdate = async () => {
    if (!selectedProduct || !shopId) return;

    const quantity = parseInt(stockQuantity);
    const buyPrice = parseInt(unitPrice);
    const sellPrice = parseInt(sellingPrice);

    if (isNaN(quantity) || quantity <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide');
      return;
    }

    if (isNaN(buyPrice) || buyPrice <= 0) {
      Alert.alert('Erreur', "Veuillez entrer un prix d'achat valide");
      return;
    }

    if (isNaN(sellPrice) || sellPrice <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de vente valide');
      return;
    }

    setIsSubmitting(true);

    try {
      const newStock = (selectedProduct.current_stock || 0) + quantity;

      await createStockBatchOffline({
        shopId,
        productId: selectedProduct.id,
        quantity,
        costPrice: buyPrice,
        sellPrice: sellPrice,
        notes: 'Approvisionnement',
      });

      closeStockModal();
      await loadProducts();

      const message =
        `+${quantity} unités ajoutées\n\n` +
        `Nouveau stock: ${newStock} unités\n` +
        `Prix d'achat: ${formatMoney(buyPrice)}/unité\n` +
        `Prix de vente: ${formatMoney(sellPrice)}/unité`;

      Alert.alert('Approvisionnement enregistré', message);
    } catch (error: any) {
      console.error("Erreur lors de l'approvisionnement:", error);
      Alert.alert('Erreur', error.message || "Impossible d'enregistrer l'approvisionnement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockStatus = (product: StockItem) => {
    const stock = product.current_stock || 0;
    const threshold = product.alert_threshold || 0;

    if (stock === 0) return 'out';
    if (stock <= threshold) return 'low';
    return 'ok';
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out':
        return Colors.danger.main;
      case 'low':
        return Colors.warning.main;
      case 'ok':
        return Colors.success.main;
      default:
        return Colors.muted.foreground;
    }
  };

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'out':
        return 'Rupture';
      case 'low':
        return 'Stock faible';
      case 'ok':
        return 'En stock';
      default:
        return 'Inconnu';
    }
  };

  const lowStockCount = products.filter(p => getStockStatus(p) === 'low').length;
  const outOfStockCount = products.filter(p => getStockStatus(p) === 'out').length;
  const totalValue = products.reduce(
    (sum, p) => sum + (p.current_stock || 0) * (p.cost_price || 0),
    0
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenHeader title="Gestion du stock" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Gestion du stock" showBack onBack={() => navigation.goBack()} />

      <View style={styles.content}>
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statCardWarning]}>
            <AlertTriangle size={20} color={Colors.warning.main} />
            <Text style={styles.statValue}>{lowStockCount}</Text>
            <Text style={styles.statLabel}>Stock faible</Text>
          </View>

          <View style={[styles.statCard, styles.statCardDanger]}>
            <TrendingDown size={20} color={Colors.danger.main} />
            <Text style={styles.statValue}>{outOfStockCount}</Text>
            <Text style={styles.statLabel}>Rupture</Text>
          </View>

          <View style={[styles.statCard, styles.statCardSuccess]}>
            <DollarSign size={20} color={Colors.success.main} />
            <Text style={styles.statValue}>{formatMoney(totalValue)}</Text>
            <Text style={styles.statLabel}>Valeur totale</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.muted.foreground} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit..."
            placeholderTextColor={Colors.muted.foreground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Products List */}
        <ScrollView
          style={styles.productsList}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadProducts(true)}
              tintColor={Colors.primary[900]}
            />
          }
        >
          {filteredProducts.map(product => {
            const status = getStockStatus(product);
            const statusColor = getStockStatusColor(status);
            const statusLabel = getStockStatusLabel(status);

            return (
              <View key={product.id} style={styles.productCard}>
                <View style={styles.productHeader}>
                  <View style={styles.productInfo}>
                    <Text style={styles.productReference}>{product.reference}</Text>
                    <Text style={styles.productName}>{product.family}</Text>
                    <Text style={styles.productDetails}>
                      {product.article_type} - {product.brand}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                <View style={styles.productFooter}>
                  <View style={styles.stockInfo}>
                    <Text style={styles.stockLabel}>Stock actuel</Text>
                    <Text style={[styles.stockValue, { color: statusColor }]}>
                      {product.current_stock || 0} unités
                    </Text>
                  </View>

                  {product.cost_price != null && product.sell_price != null && (
                    <View style={styles.priceInfo}>
                      <Text style={styles.priceLabel}>
                        Achat: {formatMoney(product.cost_price)}
                      </Text>
                      <Text style={styles.priceLabel}>
                        Vente: {formatMoney(product.sell_price)}
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.addStockButton}
                    onPress={() => openStockModal(product)}
                  >
                    <Plus size={16} color={Colors.primary.foreground} />
                    <Text style={styles.addStockButtonText}>Approvisionner</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}

          {filteredProducts.length === 0 && (
            <View style={styles.emptyState}>
              <Package size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'Aucun produit trouvé' : 'Aucun produit dans le catalogue'}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Stock Modal */}
      <Modal
        visible={showStockModal}
        transparent
        animationType="slide"
        onRequestClose={closeStockModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Approvisionnement</Text>

            {selectedProduct && (
              <>
                <View style={styles.modalProductInfo}>
                  <Text style={styles.modalProductName}>{selectedProduct.family}</Text>
                  <Text style={styles.modalProductDetails}>
                    {selectedProduct.article_type} - {selectedProduct.brand}
                  </Text>
                  <Text style={styles.modalProductStock}>
                    Stock actuel: {selectedProduct.current_stock || 0} unités
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Quantité à ajouter *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 50"
                    placeholderTextColor={Colors.muted.foreground}
                    value={stockQuantity}
                    onChangeText={setStockQuantity}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Prix d'achat unitaire (FCFA) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 500"
                    placeholderTextColor={Colors.muted.foreground}
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Prix de vente unitaire (FCFA) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 750"
                    placeholderTextColor={Colors.muted.foreground}
                    value={sellingPrice}
                    onChangeText={setSellingPrice}
                    keyboardType="numeric"
                  />
                </View>

                {stockQuantity && unitPrice && sellingPrice && (
                  <View style={styles.summary}>
                    <Text style={styles.summaryTitle}>Résumé</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Quantité ajoutée</Text>
                      <Text style={styles.summaryValue}>+{stockQuantity} unités</Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Nouveau stock</Text>
                      <Text style={styles.summaryValue}>
                        {(selectedProduct.current_stock || 0) + parseInt(stockQuantity || '0')}{' '}
                        unités
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Coût total</Text>
                      <Text style={styles.summaryValue}>
                        {formatMoney(parseInt(stockQuantity || '0') * parseInt(unitPrice || '0'))}
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Marge unitaire</Text>
                      <Text style={[styles.summaryValue, styles.summaryValueSuccess]}>
                        {formatMoney(parseInt(sellingPrice || '0') - parseInt(unitPrice || '0'))}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeStockModal}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  isSubmitting && styles.modalConfirmButtonDisabled,
                ]}
                onPress={handleStockUpdate}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={Colors.primary.foreground} />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>Valider</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statCardWarning: {
    backgroundColor: Colors.warning.main + '15',
  },
  statCardDanger: {
    backgroundColor: Colors.danger.main + '15',
  },
  statCardSuccess: {
    backgroundColor: Colors.success.main + '15',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  productsList: {
    flex: 1,
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productReference: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary[900],
    marginBottom: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  productDetails: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    height: 'fit-content' as any,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  productFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  stockInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stockLabel: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  stockValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  addStockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary[900],
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginTop: Spacing.xs,
  },
  addStockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing['2xl'],
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  modalProductInfo: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  modalProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  modalProductDetails: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginBottom: Spacing.xs,
  },
  modalProductStock: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
  },
  summary: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  summaryValueSuccess: {
    color: Colors.success.main,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: 12,
    backgroundColor: Colors.muted.main,
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  modalConfirmButton: {
    flex: 1,
    padding: Spacing.lg,
    borderRadius: 12,
    backgroundColor: Colors.primary[900],
  },
  modalConfirmButtonDisabled: {
    opacity: 0.6,
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
    textAlign: 'center',
  },
});
