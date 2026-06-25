import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import {
  Package,
  Edit,
  Trash,
  Plus,
  Minus,
  Receipt,
  DollarSign,
  AlertTriangle,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, IconButton } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { Product } from '../types/stock';
import { getProducts, saveProducts } from '../utils/stockManager';
import { formatMoney } from '../utils/money';

interface ProductDetailsScreenProps {
  navigation: {
    goBack: () => void;
  };
  route: {
    params: {
      id: string;
    };
  };
}

export default function ProductDetailsScreen({ navigation, route }: ProductDetailsScreenProps) {
  const { id } = route.params;
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    category: '',
    stockThreshold: '',
    unit: '',
    size: '',
  });

  const loadProduct = useCallback(async () => {
    setIsLoading(true);
    try {
      const products = await getProducts();
      const foundProduct = products.find(p => p.id === id);
      if (foundProduct) {
        setProduct(foundProduct);
        setEditForm({
          name: foundProduct.name,
          category: foundProduct.category,
          stockThreshold: foundProduct.stockThreshold.toString(),
          unit: foundProduct.unit,
          size: foundProduct.size || '',
        });
      } else {
        Alert.alert('Erreur', 'Produit introuvable');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Erreur lors du chargement du produit:', error);
      Alert.alert('Erreur', 'Impossible de charger les détails du produit');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigation]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  const handleDelete = () => {
    Alert.alert('Supprimer le produit', `Êtes-vous sûr de vouloir supprimer "${product?.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            const products = await getProducts();
            const updatedProducts = products.filter(p => p.id !== id);
            await saveProducts(updatedProducts);
            Alert.alert('Succès', 'Produit supprimé');
            navigation.goBack();
          } catch {
            Alert.alert('Erreur', 'Impossible de supprimer le produit');
          }
        },
      },
    ]);
  };

  const handleSubmitEdit = async () => {
    if (!editForm.name.trim()) {
      Alert.alert('Erreur', 'Le nom est requis');
      return;
    }

    setIsSubmitting(true);
    try {
      const products = await getProducts();
      const updatedProducts = products.map(p =>
        p.id === id
          ? {
              ...p,
              name: editForm.name.trim(),
              category: editForm.category,
              stockThreshold: parseInt(editForm.stockThreshold) || 0,
              unit: editForm.unit,
              size: editForm.size.trim(),
            }
          : p
      );
      await saveProducts(updatedProducts);
      await loadProduct();
      setShowEditModal(false);
      Alert.alert('Succès', 'Produit modifié');
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier le produit');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitStockAdjustment = async () => {
    const adjustment = parseInt(stockAdjustment);
    if (isNaN(adjustment) || adjustment <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer une quantité valide');
      return;
    }

    if (!product) return;

    const newStock =
      adjustmentType === 'add'
        ? product.stockQuantity + adjustment
        : Math.max(0, product.stockQuantity - adjustment);

    setIsSubmitting(true);
    try {
      const products = await getProducts();
      const updatedProducts = products.map(p =>
        p.id === id ? { ...p, stockQuantity: newStock } : p
      );
      await saveProducts(updatedProducts);
      await loadProduct();
      setShowStockModal(false);
      setStockAdjustment('');
      Alert.alert('Succès', `Stock ${adjustmentType === 'add' ? 'ajouté' : 'retiré'}`);
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier le stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStockStatus = (): 'ok' | 'low' | 'out' => {
    if (!product) return 'out';
    if (product.stockQuantity === 0) return 'out';
    if (product.stockQuantity <= product.stockThreshold) return 'low';
    return 'ok';
  };

  const getCategoryLabel = (category: string) => {
    const map: Record<string, string> = {
      alimentation: 'Alimentation',
      boissons: 'Boissons',
      hygiene: 'Hygiène',
      electronique: 'Électronique',
      vetements: 'Vêtements',
      autres: 'Autres',
    };
    return map[category] || category;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </View>
    );
  }

  if (!product) {
    return null;
  }

  const stockStatus = getStockStatus();
  const isLowStock = stockStatus === 'low' || stockStatus === 'out';

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={product.name}
        subtitle={getCategoryLabel(product.category)}
        showBack={true}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerActions}>
            <IconButton onPress={() => setShowEditModal(true)}>
              <Edit size={20} color={Colors.action} />
            </IconButton>
            <IconButton onPress={handleDelete}>
              <Trash size={20} color={Colors.danger.main} />
            </IconButton>
          </View>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO MARINE — Stock du produit */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIcon}>
              <Package size={22} color={Colors.action} />
            </View>
            <View style={styles.heroTitleBlock}>
              <Text style={styles.heroName} numberOfLines={1}>
                {product.name}
              </Text>
              <Text style={styles.heroCategory} numberOfLines={1}>
                {getCategoryLabel(product.category)}
              </Text>
            </View>
          </View>

          <Text style={styles.heroAmount}>
            {product.stockQuantity}
            <Text style={styles.heroAmountUnit}> {product.unit}</Text>
          </Text>

          <View style={styles.heroFooterRow}>
            {typeof product.price === 'number' ? (
              <Text style={styles.heroPrice}>
                {formatMoney(product.price)}
                <Text style={styles.heroPriceUnit}> / {product.unit}</Text>
              </Text>
            ) : (
              <Text style={styles.heroPriceMuted}>Prix non défini</Text>
            )}

            {isLowStock ? (
              <View style={styles.heroLowBadge}>
                <AlertTriangle size={13} color={Colors.warning.main} />
                <Text style={styles.heroLowBadgeText}>
                  {stockStatus === 'out' ? 'Rupture' : 'Stock bas'}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* INFOS PRODUIT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon={<Receipt size={18} color={Colors.action} />}
              label="Référence"
              value={product.reference}
            />
            <InfoRow
              icon={<Package size={18} color={Colors.action} />}
              label="Catégorie"
              value={getCategoryLabel(product.category)}
              bordered
            />
            {product.size ? (
              <InfoRow
                icon={<Package size={18} color={Colors.action} />}
                label="Taille"
                value={product.size}
                bordered
              />
            ) : null}
            <InfoRow
              icon={<Package size={18} color={Colors.action} />}
              label="Unité"
              value={product.unit}
              bordered
            />
            <InfoRow
              icon={<AlertTriangle size={18} color={Colors.action} />}
              label="Seuil d'alerte"
              value={`${product.stockThreshold} ${product.unit}`}
              valueColor={isLowStock ? Colors.warning.main : undefined}
              bordered
            />
            {typeof product.price === 'number' ? (
              <InfoRow
                icon={<DollarSign size={18} color={Colors.action} />}
                label="Prix de vente"
                value={formatMoney(product.price)}
                valueStrong
                bordered
              />
            ) : null}
          </View>
        </View>

        {/* AJUSTEMENT DE STOCK */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ajuster le stock</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonAdd]}
              onPress={() => {
                setAdjustmentType('add');
                setShowStockModal(true);
              }}
            >
              <Plus size={20} color={Colors.primary.foreground} />
              <Text style={styles.actionButtonText}>Ajouter</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonRemove]}
              onPress={() => {
                setAdjustmentType('remove');
                setShowStockModal(true);
              }}
            >
              <Minus size={20} color={Colors.danger.main} />
              <Text style={[styles.actionButtonText, styles.actionButtonTextRemove]}>Retirer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTextBlock}>
                  <Text style={styles.modalHeaderTitle}>Modifier le produit</Text>
                  <Text style={styles.modalHeaderSubtitle}>{product.name}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowEditModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Nom *</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.name}
                    onChangeText={text => setEditForm({ ...editForm, name: text })}
                    placeholder="Nom du produit"
                    placeholderTextColor={Colors.textColors.disabled}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Seuil d&apos;alerte</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.stockThreshold}
                    onChangeText={text => setEditForm({ ...editForm, stockThreshold: text })}
                    keyboardType="numeric"
                    placeholder="Seuil d'alerte"
                    placeholderTextColor={Colors.textColors.disabled}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Taille</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.size}
                    onChangeText={text => setEditForm({ ...editForm, size: text })}
                    placeholder="Ex: 500ml, XL, etc."
                    placeholderTextColor={Colors.textColors.disabled}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowEditModal(false)}
                  >
                    <Text style={styles.modalCancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalSubmitButton}
                    onPress={handleSubmitEdit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color={Colors.primary.foreground} />
                    ) : (
                      <Text style={styles.modalSubmitButtonText}>Enregistrer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        visible={showStockModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTextBlock}>
                <Text style={styles.modalHeaderTitle}>
                  {adjustmentType === 'add' ? 'Ajouter du stock' : 'Retirer du stock'}
                </Text>
                <Text style={styles.modalHeaderSubtitle}>
                  Stock actuel : {product.stockQuantity} {product.unit}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowStockModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>
                  Quantité à {adjustmentType === 'add' ? 'ajouter' : 'retirer'}
                </Text>
                <TextInput
                  style={styles.input}
                  value={stockAdjustment}
                  onChangeText={setStockAdjustment}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={Colors.textColors.disabled}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setShowStockModal(false)}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSubmitButton}
                  onPress={handleSubmitStockAdjustment}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.primary.foreground} />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  bordered?: boolean;
  valueColor?: string;
  valueStrong?: boolean;
}

function InfoRow({ icon, label, value, bordered, valueColor, valueStrong }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, bordered && styles.infoRowBordered]}>
      <View style={styles.infoIcon}>{icon}</View>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          valueStrong && styles.infoValueStrong,
          valueColor ? { color: valueColor } : null,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // HERO MARINE
  hero: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.primary[900],
    borderRadius: 20,
    padding: Spacing.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(14, 165, 233, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleBlock: {
    flex: 1,
  },
  heroName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  heroCategory: {
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 1,
  },
  heroAmount: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.onMarine,
    marginTop: Spacing.lg,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroAmountUnit: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.action,
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  heroPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onMarine,
    fontVariant: ['tabular-nums'],
  },
  heroPriceUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.action,
  },
  heroPriceMuted: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.55)',
  },
  heroLowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
  },
  heroLowBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.warning.main,
  },
  // SECTIONS
  section: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  // INFO CARD
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  infoRowBordered: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.info.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: Colors.textColors.secondary,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  infoValueStrong: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary[900],
  },
  // ACTION BUTTONS
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    minHeight: 52,
  },
  actionButtonAdd: {
    backgroundColor: Colors.action,
  },
  actionButtonRemove: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.danger.main,
  },
  actionButtonText: {
    color: Colors.primary.foreground,
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonTextRemove: {
    color: Colors.danger.main,
  },
  // MODALS
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingBottom: Spacing.xl,
    ...Shadows.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderTextBlock: {
    flex: 1,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 2,
  },
  modalHeaderSubtitle: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: Colors.muted.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: Colors.textColors.secondary,
    fontWeight: '600',
  },
  modalBody: {
    padding: Spacing.xl,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surfaceAlt,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textColors.secondary,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.action,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  modalSubmitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary.foreground,
  },
});
