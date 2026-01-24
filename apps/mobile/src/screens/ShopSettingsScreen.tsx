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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Package, Plus, Edit, Trash, Check, ChevronDown } from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { Product, Category } from '../types/stock';
import {
  getProducts,
  initializeDefaultProducts,
  saveProducts,
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
} from '../utils/stockManager';
import { formatMoney } from '../utils/money';

interface EditableProduct {
  id: string;
  name: string;
  category: string;
  price: string;
  stockQuantity: string;
  stockThreshold: string;
  unit: string;
  isNew?: boolean;
  isEditing?: boolean;
}

const UNITS = ['unité', 'sac', 'bouteille', 'carton', 'kg', 'pièce'];

export default function ShopSettingsScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'products' | 'categories'>('products');
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Product Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EditableProduct | null>(null);

  // Category Modal states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [isCategoryNew, setIsCategoryNew] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await initializeDefaultProducts();
      const [loadedProducts, loadedCategories] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(
        loadedProducts.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          price: String(p.price || 0),
          stockQuantity: String(p.stockQuantity),
          stockThreshold: String(p.stockThreshold),
          unit: p.unit,
          isEditing: false,
        }))
      );
      setCategories(loadedCategories);
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // ============= PRODUCT FUNCTIONS =============

  const openAddProductModal = () => {
    setEditingProduct({
      id: `new_${Date.now()}`,
      name: '',
      category: categories.length > 0 ? categories[0].key : 'autres',
      price: '0',
      stockQuantity: '0',
      stockThreshold: '10',
      unit: 'unité',
      isNew: true,
      isEditing: true,
    });
    setShowProductModal(true);
  };

  const openEditProductModal = (product: EditableProduct) => {
    setEditingProduct({ ...product, isEditing: true });
    setShowProductModal(true);
  };

  const saveProductFromModal = () => {
    if (!editingProduct) return;

    if (!editingProduct.name.trim()) {
      Alert.alert('Erreur', 'Le nom du produit est requis');
      return;
    }

    if (editingProduct.isNew) {
      setProducts([editingProduct, ...products]);
    } else {
      setProducts(products.map(p => (p.id === editingProduct.id ? editingProduct : p)));
    }
    setHasChanges(true);
    setShowProductModal(false);
    setEditingProduct(null);
  };

  const deleteProduct = (id: string) => {
    Alert.alert('Supprimer', 'Voulez-vous vraiment supprimer ce produit ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          setProducts(products.filter(p => p.id !== id));
          setHasChanges(true);
        },
      },
    ]);
  };

  const saveAllProducts = async () => {
    const invalidProducts = products.filter(p => !p.name.trim());
    if (invalidProducts.length > 0) {
      Alert.alert('Erreur', 'Tous les produits doivent avoir un nom');
      return;
    }

    setIsSaving(true);
    try {
      const productsToSave: Product[] = products.map((p, index) => ({
        id: p.isNew ? Date.now().toString() + index : p.id,
        reference: `PRD${String(index + 1).padStart(3, '0')}`,
        name: p.name.trim(),
        category: p.category,
        price: parseInt(p.price) || 0,
        stockQuantity: parseInt(p.stockQuantity) || 0,
        stockThreshold: parseInt(p.stockThreshold) || 10,
        unit: p.unit,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await saveProducts(productsToSave);
      await loadData();
      Alert.alert('Succès', 'Catalogue sauvegardé');
    } catch (error) {
      console.error('Error saving products:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setIsSaving(false);
    }
  };

  // ============= CATEGORY FUNCTIONS =============

  const openAddCategoryModal = () => {
    setIsCategoryNew(true);
    setEditingCategory(null);
    setCategoryName('');
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (category: Category) => {
    if (category.isDefault) {
      Alert.alert('Information', 'Les catégories par défaut ne peuvent pas être modifiées');
      return;
    }
    setIsCategoryNew(false);
    setEditingCategory(category);
    setCategoryName(category.label);
    setShowCategoryModal(true);
  };

  const saveCategoryFromModal = async () => {
    if (!categoryName.trim()) {
      Alert.alert('Erreur', 'Le nom de la catégorie est requis');
      return;
    }

    setIsSaving(true);
    try {
      if (isCategoryNew) {
        await addCategory(categoryName.trim());
        Alert.alert('Succès', 'Catégorie ajoutée');
      } else if (editingCategory) {
        await updateCategory(editingCategory.id, categoryName.trim());
        Alert.alert('Succès', 'Catégorie modifiée');
      }
      setShowCategoryModal(false);
      setCategoryName('');
      setEditingCategory(null);
      await loadData();
    } catch (error: any) {
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = (category: Category) => {
    if (category.isDefault) {
      Alert.alert('Impossible', 'Les catégories par défaut ne peuvent pas être supprimées');
      return;
    }

    Alert.alert('Supprimer la catégorie', `Voulez-vous vraiment supprimer "${category.label}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteCategory(category.id);
            Alert.alert('Succès', 'Catégorie supprimée');
            await loadData();
          } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  // ============= RENDER HELPERS =============

  const getCategoryLabel = (cat: string) => {
    return categories.find(c => c.key === cat)?.label || cat;
  };

  const getStockStatus = (qty: string, threshold: string) => {
    const q = parseInt(qty) || 0;
    const t = parseInt(threshold) || 10;
    if (q === 0) return { color: Colors.danger.main, label: 'Rupture' };
    if (q <= t) return { color: Colors.warning.main, label: 'Faible' };
    return { color: Colors.success.main, label: 'OK' };
  };

  const renderProductItem = (product: EditableProduct) => {
    const isExpanded = expandedProduct === product.id;
    const stockStatus = getStockStatus(product.stockQuantity, product.stockThreshold);

    return (
      <View key={product.id} style={styles.productCard}>
        <TouchableOpacity
          style={styles.productHeader}
          onPress={() => setExpandedProduct(isExpanded ? null : product.id)}
        >
          <View style={styles.productInfo}>
            <Text style={styles.productName}>{product.name || 'Nouveau produit'}</Text>
            <Text style={styles.productCategory}>{getCategoryLabel(product.category)}</Text>
          </View>
          <View style={styles.productMeta}>
            <Text style={styles.productPrice}>{formatMoney(parseInt(product.price) || 0)}</Text>
            <View style={[styles.stockBadge, { backgroundColor: stockStatus.color + '20' }]}>
              <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
              <Text style={[styles.stockText, { color: stockStatus.color }]}>
                {product.stockQuantity} {product.unit}
              </Text>
            </View>
          </View>
          <ChevronDown
            size={20}
            color={Colors.muted.foreground}
            style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.productDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Prix unitaire</Text>
              <Text style={styles.detailValue}>{formatMoney(parseInt(product.price) || 0)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Stock actuel</Text>
              <Text style={styles.detailValue}>
                {product.stockQuantity} {product.unit}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Seuil d'alerte</Text>
              <Text style={styles.detailValue}>
                {product.stockThreshold} {product.unit}
              </Text>
            </View>
            <View style={styles.productActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => openEditProductModal(product)}
              >
                <Edit size={16} color={Colors.primary[900]} />
                <Text style={styles.editButtonText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteProduct(product.id)}
              >
                <Trash size={16} color={Colors.danger.main} />
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Paramètres Boutique" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Paramètres Boutique"
        showBack
        onBack={() => navigation.goBack()}
        rightAction={
          hasChanges ? (
            <TouchableOpacity
              style={styles.saveHeaderButton}
              onPress={saveAllProducts}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={Colors.primary.foreground} />
              ) : (
                <>
                  <Check size={18} color={Colors.primary.foreground} />
                  <Text style={styles.saveHeaderButtonText}>Sauver</Text>
                </>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'products' && styles.tabActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
            Produits ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
            Catégories ({categories.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'products' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Add product button */}
          <TouchableOpacity style={styles.addButton} onPress={openAddProductModal}>
            <Plus size={20} color={Colors.primary[900]} />
            <Text style={styles.addButtonText}>Ajouter un produit</Text>
          </TouchableOpacity>

          {/* Products list */}
          {products.length === 0 ? (
            <View style={styles.emptyState}>
              <Package size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>Aucun produit</Text>
              <Text style={styles.emptySubtext}>Ajoutez des produits à votre catalogue</Text>
            </View>
          ) : (
            products.map(renderProductItem)
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Add category button */}
          <TouchableOpacity style={styles.addButton} onPress={openAddCategoryModal}>
            <Plus size={20} color={Colors.primary[900]} />
            <Text style={styles.addButtonText}>Ajouter une catégorie</Text>
          </TouchableOpacity>

          {/* Categories list */}
          <View style={styles.categoriesCard}>
            <Text style={styles.categoriesTitle}>Catégories disponibles</Text>
            <Text style={styles.categoriesSubtitle}>Organisez vos produits par catégories</Text>
            {categories.map(cat => {
              const count = products.filter(p => p.category === cat.key).length;
              return (
                <View key={cat.id} style={styles.categoryItem}>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryName}>{cat.label}</Text>
                    <Text style={styles.categoryCount}>
                      {count} produit{count > 1 ? 's' : ''}
                      {cat.isDefault && ' • Par défaut'}
                    </Text>
                  </View>
                  {!cat.isDefault && (
                    <View style={styles.categoryActions}>
                      <TouchableOpacity
                        style={styles.categoryActionButton}
                        onPress={() => openEditCategoryModal(cat)}
                      >
                        <Edit size={16} color={Colors.primary[900]} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.categoryActionButton}
                        onPress={() => handleDeleteCategory(cat)}
                      >
                        <Trash size={16} color={Colors.danger.main} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Product Modal */}
      <Modal
        visible={showProductModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProductModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingProduct?.isNew ? 'Nouveau produit' : 'Modifier le produit'}
            </Text>

            <ScrollView style={styles.modalScroll}>
              {/* Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nom du produit *</Text>
                <TextInput
                  style={styles.input}
                  value={editingProduct?.name || ''}
                  onChangeText={text =>
                    setEditingProduct(prev => (prev ? { ...prev, name: text } : null))
                  }
                  placeholder="Ex: Riz 25kg"
                  placeholderTextColor={Colors.muted.foreground}
                />
              </View>

              {/* Category */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Catégorie</Text>
                <View style={styles.categoryButtons}>
                  {categories.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryButton,
                        editingProduct?.category === cat.key && styles.categoryButtonActive,
                      ]}
                      onPress={() =>
                        setEditingProduct(prev => (prev ? { ...prev, category: cat.key } : null))
                      }
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          editingProduct?.category === cat.key && styles.categoryButtonTextActive,
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Price */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Prix de vente (FCFA)</Text>
                <TextInput
                  style={styles.input}
                  value={editingProduct?.price || ''}
                  onChangeText={text =>
                    setEditingProduct(prev =>
                      prev ? { ...prev, price: text.replace(/[^0-9]/g, '') } : null
                    )
                  }
                  placeholder="0"
                  placeholderTextColor={Colors.muted.foreground}
                  keyboardType="numeric"
                />
              </View>

              {/* Stock */}
              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Stock actuel</Text>
                  <TextInput
                    style={styles.input}
                    value={editingProduct?.stockQuantity || ''}
                    onChangeText={text =>
                      setEditingProduct(prev =>
                        prev ? { ...prev, stockQuantity: text.replace(/[^0-9]/g, '') } : null
                      )
                    }
                    placeholder="0"
                    placeholderTextColor={Colors.muted.foreground}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Seuil d'alerte</Text>
                  <TextInput
                    style={styles.input}
                    value={editingProduct?.stockThreshold || ''}
                    onChangeText={text =>
                      setEditingProduct(prev =>
                        prev ? { ...prev, stockThreshold: text.replace(/[^0-9]/g, '') } : null
                      )
                    }
                    placeholder="10"
                    placeholderTextColor={Colors.muted.foreground}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Unit */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Unité</Text>
                <View style={styles.unitButtons}>
                  {UNITS.map(unit => (
                    <TouchableOpacity
                      key={unit}
                      style={[
                        styles.unitButton,
                        editingProduct?.unit === unit && styles.unitButtonActive,
                      ]}
                      onPress={() => setEditingProduct(prev => (prev ? { ...prev, unit } : null))}
                    >
                      <Text
                        style={[
                          styles.unitButtonText,
                          editingProduct?.unit === unit && styles.unitButtonTextActive,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowProductModal(false);
                  setEditingProduct(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveButton} onPress={saveProductFromModal}>
                <Text style={styles.modalSaveButtonText}>
                  {editingProduct?.isNew ? 'Ajouter' : 'Enregistrer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {isCategoryNew ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
            </Text>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Nom de la catégorie *</Text>
                <TextInput
                  style={styles.input}
                  value={categoryName}
                  onChangeText={setCategoryName}
                  placeholder="Ex: Cosmétiques"
                  placeholderTextColor={Colors.muted.foreground}
                  autoFocus
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowCategoryModal(false);
                  setCategoryName('');
                  setEditingCategory(null);
                }}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveCategoryFromModal}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.primary.foreground} />
                ) : (
                  <Text style={styles.modalSaveButtonText}>
                    {isCategoryNew ? 'Ajouter' : 'Enregistrer'}
                  </Text>
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
  },
  saveHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.success.main,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  saveHeaderButtonText: {
    color: Colors.primary.foreground,
    fontWeight: '600',
    fontSize: 14,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.primary[900],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.muted.foreground,
  },
  tabTextActive: {
    color: Colors.primary[900],
    fontWeight: '600',
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 100,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[50],
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.primary[200],
    marginBottom: Spacing.lg,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary[900],
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  productCategory: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginTop: 2,
  },
  productMeta: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '500',
  },
  productDetails: {
    padding: Spacing.lg,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 0,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  productActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.primary[50],
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary[900],
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.danger.main + '15',
    borderRadius: 8,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.danger.main,
  },
  emptyState: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.muted.foreground,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
  // Categories tab
  categoriesCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.lg,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  categoriesSubtitle: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginBottom: Spacing.lg,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
  },
  categoryCount: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  categoryActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalScroll: {
    padding: Spacing.lg,
    maxHeight: 400,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  formGroup: {
    marginBottom: Spacing.lg,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  formLabel: {
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
  categoryButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  categoryButtonTextActive: {
    color: Colors.primary.foreground,
  },
  unitButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  unitButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  unitButtonActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  unitButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  unitButtonTextActive: {
    color: Colors.primary.foreground,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: Colors.primary[900],
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
});
