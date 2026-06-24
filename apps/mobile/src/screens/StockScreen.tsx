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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Package, Plus, Check, Trash } from '../components/icons/SimpleIcons';
import { ScreenHeader, IconButton } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { Product, ProductCategory } from '../types/stock';
import { getProducts, initializeDefaultProducts, saveProducts } from '../utils/stockManager';

interface EditableProduct {
  id: string;
  name: string;
  category: ProductCategory;
  size: string;
  stockQuantity: string;
  stockThreshold: string;
  unit: string;
  isNew?: boolean;
  isEditing?: boolean;
}

export default function StockScreen() {
  const [products, setProducts] = useState<EditableProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const categories: Array<{ key: ProductCategory; label: string }> = [
    { key: 'alimentation', label: 'Alimentation' },
    { key: 'boissons', label: 'Boissons' },
    { key: 'hygiene', label: 'Hygiène' },
    { key: 'electronique', label: 'Électronique' },
    { key: 'vetements', label: 'Vêtements' },
    { key: 'autres', label: 'Autres' },
  ];

  const units = ['unité', 'sac', 'bouteille', 'carton', 'kg'];

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      await initializeDefaultProducts();
      const loadedProducts = await getProducts();
      setProducts(
        loadedProducts.map(p => ({
          id: p.id,
          name: p.name,
          category: p.category,
          size: '',
          stockQuantity: String(p.stockQuantity),
          stockThreshold: String(p.stockThreshold),
          unit: p.unit,
          isEditing: false,
        }))
      );
      setHasChanges(false);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const addNewRow = () => {
    const newProduct: EditableProduct = {
      id: `new_${Date.now()}`,
      name: '',
      category: 'autres',
      size: '',
      stockQuantity: '0',
      stockThreshold: '10',
      unit: 'unité',
      isNew: true,
      isEditing: true,
    };
    setProducts([newProduct, ...products]);
    setHasChanges(true);
  };

  const updateProduct = (id: string, field: keyof EditableProduct, value: string) => {
    setProducts(products.map(p => (p.id === id ? { ...p, [field]: value, isEditing: true } : p)));
    setHasChanges(true);
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
    // Validate all products
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
        name: p.name.trim() + (p.size ? ` (${p.size})` : ''),
        category: p.category,
        stockQuantity: parseInt(p.stockQuantity) || 0,
        stockThreshold: parseInt(p.stockThreshold) || 10,
        unit: p.unit,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      await saveProducts(productsToSave);
      await loadProducts();
      Alert.alert('Succès', 'Catalogue sauvegardé');
    } catch (error) {
      console.error('Error saving products:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setIsSaving(false);
    }
  };

  const getCategoryLabel = (cat: ProductCategory) => {
    return categories.find(c => c.key === cat)?.label || cat;
  };

  const getStockColor = (qty: string, threshold: string) => {
    const q = parseInt(qty) || 0;
    const t = parseInt(threshold) || 10;
    if (q === 0) return Colors.danger.main;
    if (q <= t) return Colors.warning.main;
    return Colors.success.main;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Articles" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Articles"
        rightAction={
          <View style={styles.headerActions}>
            <IconButton onPress={addNewRow}>
              <Plus size={24} color={Colors.primary[900]} />
            </IconButton>
            {hasChanges && (
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveAllProducts}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.primary.foreground} />
                ) : (
                  <>
                    <Check size={18} color={Colors.primary.foreground} />
                    <Text style={styles.saveButtonText}>Sauver</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.headerCell, { flex: 2 }]}>Nom Produit</Text>
        <Text style={[styles.headerCell, { flex: 1.5 }]}>Catégorie</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Taille</Text>
        <Text style={[styles.headerCell, { flex: 0.8, textAlign: 'center' }]}>Qté</Text>
        <Text style={[styles.headerCell, { flex: 0.8, textAlign: 'center' }]}>Seuil</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}>Unité</Text>
        <Text style={[styles.headerCell, { width: 40 }]}></Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {products.length === 0 ? (
          <View style={styles.emptyState}>
            <Package size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>Aucun article</Text>
            <Text style={styles.emptySubtext}>Appuyez sur + pour ajouter</Text>
          </View>
        ) : (
          products.map((product, index) => (
            <View
              key={product.id}
              style={[
                styles.tableRow,
                index % 2 === 0 && styles.tableRowAlt,
                product.isNew && styles.tableRowNew,
              ]}
            >
              {/* Nom Produit */}
              <TextInput
                style={[styles.cell, styles.cellInput, { flex: 2 }]}
                value={product.name}
                onChangeText={text => updateProduct(product.id, 'name', text)}
                placeholder="Nom du produit"
                placeholderTextColor={Colors.muted.foreground}
              />

              {/* Catégorie - Dropdown simple */}
              <TouchableOpacity
                style={[styles.cell, { flex: 1.5 }]}
                onPress={() => {
                  const currentIndex = categories.findIndex(c => c.key === product.category);
                  const nextIndex = (currentIndex + 1) % categories.length;
                  updateProduct(product.id, 'category', categories[nextIndex].key);
                }}
              >
                <Text style={styles.cellText} numberOfLines={1}>
                  {getCategoryLabel(product.category)}
                </Text>
              </TouchableOpacity>

              {/* Taille/Format */}
              <TextInput
                style={[styles.cell, styles.cellInput, { flex: 1 }]}
                value={product.size}
                onChangeText={text => updateProduct(product.id, 'size', text)}
                placeholder="-"
                placeholderTextColor={Colors.muted.foreground}
              />

              {/* Quantité */}
              <TextInput
                style={[
                  styles.cell,
                  styles.cellInput,
                  styles.cellNumber,
                  {
                    flex: 0.8,
                    color: getStockColor(product.stockQuantity, product.stockThreshold),
                  },
                ]}
                value={product.stockQuantity}
                onChangeText={text =>
                  updateProduct(product.id, 'stockQuantity', text.replace(/[^0-9]/g, ''))
                }
                keyboardType="numeric"
                placeholder="0"
              />

              {/* Seuil */}
              <TextInput
                style={[styles.cell, styles.cellInput, styles.cellNumber, { flex: 0.8 }]}
                value={product.stockThreshold}
                onChangeText={text =>
                  updateProduct(product.id, 'stockThreshold', text.replace(/[^0-9]/g, ''))
                }
                keyboardType="numeric"
                placeholder="10"
              />

              {/* Unité - Cycle through options */}
              <TouchableOpacity
                style={[styles.cell, { flex: 1 }]}
                onPress={() => {
                  const currentIndex = units.indexOf(product.unit);
                  const nextIndex = (currentIndex + 1) % units.length;
                  updateProduct(product.id, 'unit', units[nextIndex]);
                }}
              >
                <Text style={styles.cellText} numberOfLines={1}>
                  {product.unit}
                </Text>
              </TouchableOpacity>

              {/* Delete button */}
              <TouchableOpacity
                style={[styles.cell, styles.deleteButton, { width: 40 }]}
                onPress={() => deleteProduct(product.id)}
              >
                <Trash size={16} color={Colors.danger.main} />
              </TouchableOpacity>
            </View>
          ))
        )}

        {/* Add row button at bottom */}
        <TouchableOpacity style={styles.addRowButton} onPress={addNewRow}>
          <Plus size={20} color={Colors.primary[900]} />
          <Text style={styles.addRowText}>Ajouter un article</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.success.main }]} />
          <Text style={styles.legendText}>En stock</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.warning.main }]} />
          <Text style={styles.legendText}>Stock faible</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.danger.main }]} />
          <Text style={styles.legendText}>Rupture</Text>
        </View>
      </View>
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
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.success.main,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  saveButtonText: {
    color: Colors.primary.foreground,
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 100,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.primary[900],
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary.foreground,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    minHeight: 48,
  },
  tableRowAlt: {
    backgroundColor: Colors.background,
  },
  tableRowNew: {
    backgroundColor: Colors.primary[50],
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  cellInput: {
    fontSize: 14,
    color: Colors.text,
  },
  cellText: {
    fontSize: 14,
    color: Colors.text,
  },
  cellNumber: {
    textAlign: 'center',
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  addRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    margin: Spacing.lg,
    borderRadius: 12,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary[900],
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
});
