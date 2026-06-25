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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Package, Edit, Trash, Plus, Minus } from '../components/icons/SimpleIcons';
import { ScreenHeader, KPICard, StatusBadge, IconButton } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { Product } from '../types/stock';
import { getProducts, saveProducts } from '../utils/stockManager';

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

  const getStockBadge = () => {
    const status = getStockStatus();
    if (status === 'out') return { text: 'Rupture de stock', variant: 'danger' as const };
    if (status === 'low') return { text: 'Stock faible', variant: 'warning' as const };
    return { text: 'En stock', variant: 'success' as const };
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={product.name}
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
            <StatusBadge text={getStockBadge().text} variant={getStockBadge().variant} />
          </View>
        }
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Product Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            <Text>📦 Référence: </Text>
            <Text>{product.reference}</Text>
          </Text>
          <Text style={styles.infoText}>
            <Text>🏷️ Catégorie: </Text>
            <Text>{getCategoryLabel(product.category)}</Text>
          </Text>
          {product.size && (
            <Text style={styles.infoText}>
              <Text>📏 Taille: </Text>
              <Text>{product.size}</Text>
            </Text>
          )}
          <Text style={styles.infoText}>
            <Text>📊 Unité: </Text>
            <Text>{product.unit}</Text>
          </Text>
        </View>

        {/* Stock KPIs */}
        <View style={styles.kpiRow}>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Stock actuel"
              value={`${product.stockQuantity} ${product.unit}`}
              icon={<Package size={20} color={Colors.action} />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <KPICard
              label="Seuil d'alerte"
              value={`${product.stockThreshold} ${product.unit}`}
              icon={<Package size={20} color={Colors.action} />}
            />
          </View>
        </View>

        {/* Stock Adjustment Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.success.main }]}
            onPress={() => {
              setAdjustmentType('add');
              setShowStockModal(true);
            }}
          >
            <Plus size={20} color={Colors.primary.foreground} />
            <Text style={styles.actionButtonText}>Ajouter stock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.danger.main }]}
            onPress={() => {
              setAdjustmentType('remove');
              setShowStockModal(true);
            }}
          >
            <Minus size={20} color={Colors.primary.foreground} />
            <Text style={styles.actionButtonText}>Retirer stock</Text>
          </TouchableOpacity>
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
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View>
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
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Seuil d'alerte</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.stockThreshold}
                    onChangeText={text => setEditForm({ ...editForm, stockThreshold: text })}
                    keyboardType="numeric"
                    placeholder="Seuil d'alerte"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Taille</Text>
                  <TextInput
                    style={styles.input}
                    value={editForm.size}
                    onChangeText={text => setEditForm({ ...editForm, size: text })}
                    placeholder="Ex: 500ml, XL, etc."
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
                      <ActivityIndicator size="small" color={Colors.surface} />
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
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalHeaderTitle}>
                  {adjustmentType === 'add' ? 'Ajouter du stock' : 'Retirer du stock'}
                </Text>
                <Text style={styles.modalHeaderSubtitle}>
                  Stock actuel: {product.stockQuantity} {product.unit}
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
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalSubmitButtonText}>Valider</Text>
                  )}
                </TouchableOpacity>
              </View>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 56,
  },
  actionButtonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  modalHeaderSubtitle: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.muted.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    fontSize: 18,
    color: Colors.text,
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
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.md,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.action,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  modalSubmitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
});
