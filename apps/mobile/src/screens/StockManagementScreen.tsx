import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Package, Search, AlertTriangle } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import type { RootStackParamList } from '../../App';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { productRepo, stockBatchRepo } from '../db/repositories';
import { createStockBatchOffline } from '../db/offlineWrite';

interface StockItem {
  id: string;
  name: string;
  category?: string;
  reference: string;
  family: string;
  article_type: string;
  brand: string;
  current_stock: number;
  alert_threshold: number;
  cost_price?: number;
  sell_price?: number;
  units_per_package?: number | null;
  package_price?: number | null;
}

/**
 * Modèle carton-primary (identique au reste de l'app) : l'unité atomique du stock
 * reste la PIÈCE, mais le carton (units_per_package > 1) devient l'unité d'affichage.
 * Retourne l'UPP "réel" (≥ 1) ; UPP = 1 ⟺ article vendu uniquement à la pièce.
 */
function getUppReal(item: StockItem): number {
  return item.units_per_package && item.units_per_package > 0 ? item.units_per_package : 1;
}

/** True si l'article est conditionné (UPP > 1) : affichage et seuil en cartons. */
function isConditioned(item: StockItem): boolean {
  return !!item.units_per_package && item.units_per_package > 1;
}

interface StockManagementScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'StockManagement'>;
}

export default function StockManagementScreen(_props: StockManagementScreenProps) {
  const { shopId } = useCurrentUser();
  const [products, setProducts] = useState<StockItem[]>([]);
  const productsCountRef = useRef(0);
  const [filteredProducts, setFilteredProducts] = useState<StockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal d'approvisionnement
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<StockItem | null>(null);
  // Réception saisie EN CARTONS : quantité en cartons, prix de revient au carton.
  const [stockQuantity, setStockQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
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
              units_per_package: p.units_per_package,
              package_price: p.package_price,
              is_active: true,
            } as StockItem;
          })
        );
        setProducts(enriched);
        productsCountRef.current = enriched.length;
        setFilteredProducts(enriched);
      } catch (error) {
        console.error('Erreur chargement produits:', error);
        if (productsCountRef.current === 0) {
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
          p.name?.toLowerCase().includes(query) ||
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
    // cost_price est stocké PAR PIÈCE → pré-remplir le coût AU CARTON (× UPP).
    const uppReal = getUppReal(product);
    setUnitPrice(product.cost_price ? String(product.cost_price * uppReal) : '');
    setShowStockModal(true);
  };

  const closeStockModal = () => {
    setShowStockModal(false);
    setSelectedProduct(null);
    setStockQuantity('');
    setUnitPrice('');
  };

  const handleStockUpdate = async () => {
    if (!selectedProduct || !shopId) return;

    // Saisie EN CARTONS : on convertit en unité atomique (pièce) pour le lot.
    const cartons = parseInt(stockQuantity);
    const costCarton = parseInt(unitPrice);

    if (isNaN(cartons) || cartons <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité (en cartons) valide');
      return;
    }

    if (isNaN(costCarton) || costCarton <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de revient (au carton) valide');
      return;
    }

    setIsSubmitting(true);

    try {
      const uppReal = getUppReal(selectedProduct);
      // quantité_pièces = cartons × UPP ; coût/pièce = round(coût_carton / UPP).
      const quantityPieces = cartons * uppReal;
      const costPiece = Math.round(costCarton / uppReal);
      // Le prix de vente du lot reste celui déjà défini sur l'article (détail si
      // dispo, sinon prix au carton/gros) ; il se gère dans la fiche article.
      const sellPrice =
        selectedProduct.sell_price && selectedProduct.sell_price > 0
          ? selectedProduct.sell_price
          : (selectedProduct.package_price ?? 0);
      const newPieces = (selectedProduct.current_stock || 0) + quantityPieces;
      const newCartons = Math.floor(newPieces / uppReal);

      await createStockBatchOffline({
        shopId,
        productId: selectedProduct.id,
        quantity: quantityPieces,
        costPrice: costPiece,
        sellPrice: sellPrice,
        notes: 'Approvisionnement',
      });

      closeStockModal();
      await loadProducts();

      const message =
        `+${cartons} carton${cartons > 1 ? 's' : ''} ajouté${cartons > 1 ? 's' : ''}\n\n` +
        `Nouveau stock : ${newCartons} carton${newCartons > 1 ? 's' : ''}\n` +
        `Prix de revient : ${formatMoney(costCarton)} / carton`;

      Alert.alert('Approvisionnement enregistré', message);
    } catch (error: unknown) {
      console.error("Erreur lors de l'approvisionnement:", error);
      const message = error instanceof Error ? error.message : '';
      Alert.alert('Erreur', message || "Impossible d'enregistrer l'approvisionnement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockStatus = (product: StockItem) => {
    const stock = product.current_stock || 0;
    const threshold = product.alert_threshold || 0;
    // Seuil comparé en CARTONS quand conditionné (sinon en pièces).
    const level = isConditioned(product) ? Math.floor(stock / getUppReal(product)) : stock;

    if (stock === 0) return 'out';
    if (level <= threshold) return 'low';
    return 'ok';
  };

  const lowStockCount = products.filter(p => {
    const status = getStockStatus(p);
    return status === 'low' || status === 'out';
  }).length;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Stock" subtitle="Chargement…" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="Stock"
        subtitle={`${products.length} référence${products.length > 1 ? 's' : ''}`}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadProducts(true)}
            tintColor={Colors.action}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchCard}>
          <Search size={20} color={Colors.action} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit…"
            placeholderTextColor={Colors.muted.foreground}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Low stock alert banner */}
        {lowStockCount > 0 && (
          <View style={styles.alertBanner}>
            <View style={styles.alertIcon}>
              <AlertTriangle size={20} color={Colors.warning.foreground} />
            </View>
            <View style={styles.alertTextBlock}>
              <Text style={styles.alertTitle}>
                {lowStockCount} produit{lowStockCount > 1 ? 's' : ''} en stock bas
              </Text>
              <Text style={styles.alertSubtitle}>Pensez à réapprovisionner</Text>
            </View>
          </View>
        )}

        {/* Products List */}
        {filteredProducts.length > 0 ? (
          <View style={styles.listCard}>
            {filteredProducts.map((product, index) => {
              const status = getStockStatus(product);
              const isLow = status === 'low' || status === 'out';
              const stock = product.current_stock || 0;
              const conditioned = isConditioned(product);
              const uppReal = getUppReal(product);
              // Stock en CARTONS (+ pièces restantes) si conditionné, sinon en pièces.
              const cartons = conditioned ? Math.floor(stock / uppReal) : 0;
              const looseUnits = conditioned ? stock % uppReal : 0;
              const stockLabel = conditioned
                ? `${cartons} carton${cartons > 1 ? 's' : ''}${
                    looseUnits ? ` (+ ${looseUnits} pièce${looseUnits > 1 ? 's' : ''})` : ''
                  }`
                : `${stock} pièce${stock > 1 ? 's' : ''}`;
              const badgeLabel = conditioned ? `${cartons} ctn` : `${stock} pcs`;
              // Coût AU CARTON (cost_price stocké par pièce) + prix de gros au carton.
              const cartonCost = (product.cost_price ?? 0) * uppReal;
              const hasDetail = conditioned && (product.sell_price ?? 0) > 0;
              const metaParts = [stockLabel];
              metaParts.push(
                conditioned
                  ? `PR ${formatMoney(cartonCost)} / carton`
                  : `PR ${formatMoney(product.cost_price ?? 0)} / pièce`
              );
              if (product.package_price) {
                metaParts.push(`${formatMoney(product.package_price)} / carton`);
              }
              if (hasDetail) {
                metaParts.push(`${formatMoney(product.sell_price ?? 0)} / pièce`);
              }

              return (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.row, index > 0 && styles.rowDivider]}
                  onPress={() => openStockModal(product)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIcon}>
                    <Package size={22} color={Colors.muted.foreground} />
                  </View>

                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {product.name || product.family}
                    </Text>
                    <Text style={styles.rowMeta} numberOfLines={2}>
                      {metaParts.join(' · ')}
                    </Text>
                  </View>

                  <View style={[styles.unitBadge, isLow && styles.unitBadgeLow]}>
                    <Text style={[styles.unitBadgeText, isLow && styles.unitBadgeTextLow]}>
                      {badgeLabel}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Package size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'Aucun produit trouvé' : 'Aucun produit dans le catalogue'}
            </Text>
          </View>
        )}
      </ScrollView>

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
                    Stock actuel :{' '}
                    {isConditioned(selectedProduct)
                      ? `${Math.floor(
                          (selectedProduct.current_stock || 0) / getUppReal(selectedProduct)
                        )} carton(s)`
                      : `${selectedProduct.current_stock || 0} pièce(s)`}
                  </Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Quantité (cartons) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 5"
                    placeholderTextColor={Colors.muted.foreground}
                    value={stockQuantity}
                    onChangeText={setStockQuantity}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>Prix de revient (au carton, FCFA) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ex: 12000"
                    placeholderTextColor={Colors.muted.foreground}
                    value={unitPrice}
                    onChangeText={setUnitPrice}
                    keyboardType="numeric"
                  />
                </View>

                {stockQuantity && unitPrice && (
                  <View style={styles.summary}>
                    <Text style={styles.summaryTitle}>Résumé</Text>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Quantité ajoutée</Text>
                      <Text style={styles.summaryValue}>
                        +{parseInt(stockQuantity || '0')} cartons
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Nouveau stock</Text>
                      <Text style={styles.summaryValue}>
                        {Math.floor(
                          ((selectedProduct.current_stock || 0) +
                            parseInt(stockQuantity || '0') * getUppReal(selectedProduct)) /
                            getUppReal(selectedProduct)
                        )}{' '}
                        cartons
                      </Text>
                    </View>
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Coût total</Text>
                      <Text style={styles.summaryValue}>
                        {formatMoney(parseInt(stockQuantity || '0') * parseInt(unitPrice || '0'))}
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
    padding: Spacing['2xl'],
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    color: Colors.muted.foreground,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.warning.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertTextBlock: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.warning.text,
  },
  alertSubtitle: {
    fontSize: 12.5,
    color: Colors.warning.text,
    marginTop: 1,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.muted.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  rowMeta: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  unitBadge: {
    backgroundColor: Colors.muted.main,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    minWidth: 48,
    alignItems: 'center',
  },
  unitBadgeLow: {
    backgroundColor: Colors.warning.background,
  },
  unitBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textColors.secondary,
  },
  unitBadgeTextLow: {
    color: Colors.warning.text,
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
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
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
    backgroundColor: Colors.action,
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
