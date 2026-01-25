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
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Package,
  Plus,
  Edit,
  Trash,
  Search,
  Filter,
  X,
  Check,
  Upload,
  FileSpreadsheet,
} from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { productsApi, importApi } from '../lib/api';
import * as DocumentPicker from 'expo-document-picker';
import { formatMoney } from '../utils/money';

interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  family?: string;
  article_type?: string;
  brand?: string;
  reference?: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  is_active: boolean;
  alert_threshold: number;
  current_stock: number;
  is_low_stock: boolean;
}

interface Filters {
  families: string[];
  brands: string[];
  article_types: string[];
}

interface ProductFormData {
  id?: string;
  sku: string;
  name: string;
  barcode?: string;
  description?: string;
  family: string;
  article_type: string;
  brand: string;
  reference: string;
  unit: string;
  cost_price: string;
  sell_price: string;
  alert_threshold: string;
  is_active: boolean;
}

const UNITS = ['unit', 'pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack'];

const DEFAULT_FORM: ProductFormData = {
  sku: '',
  name: '',
  barcode: '',
  description: '',
  family: '',
  article_type: '',
  brand: '',
  reference: '',
  unit: 'unit',
  cost_price: '0',
  sell_price: '0',
  alert_threshold: '5',
  is_active: true,
};

export default function ProductCatalogScreen({ navigation }: any) {
  const [activeTab, setActiveTab] = useState<'articles' | 'catalogue'>('articles');
  const [products, setProducts] = useState<Product[]>([]);
  const [filters, setFilters] = useState<Filters>({ families: [], brands: [], article_types: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtres actifs
  const [selectedFamily, setSelectedFamily] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Modal de produit
  const [showProductModal, setShowProductModal] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(DEFAULT_FORM);
  const [isEditing, setIsEditing] = useState(false);

  // Suggestions pour les champs
  const [showFamilySuggestions, setShowFamilySuggestions] = useState(false);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false);

  // Hierarchy editing modal state (for Catalogue tab)
  const [showHierarchyEditModal, setShowHierarchyEditModal] = useState(false);
  const [hierarchyEditType, setHierarchyEditType] = useState<
    'family' | 'article_type' | 'brand' | 'reference' | null
  >(null);
  const [hierarchyEditOldValue, setHierarchyEditOldValue] = useState('');
  const [hierarchyEditNewValue, setHierarchyEditNewValue] = useState('');
  const [hierarchyEditContext, setHierarchyEditContext] = useState<{
    family?: string;
    article_type?: string;
    brand?: string;
  }>({});
  const [isHierarchySaving, setIsHierarchySaving] = useState(false);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; content: string } | null>(null);
  const [importPreview, setImportPreview] = useState<{
    valid_count: number;
    invalid_count: number;
    errors: Array<{ row: number; field: string; message: string }>;
    preview_rows: Array<any>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'success'>('select');

  const loadData = async () => {
    setIsLoading(true);
    try {
      console.log('📦 Loading products with params:', {
        search: searchQuery || undefined,
        family: selectedFamily || undefined,
        brand: selectedBrand || undefined,
        article_type: selectedType || undefined,
      });

      const [productsData, filtersData] = await Promise.all([
        productsApi.getAll({
          search: searchQuery || undefined,
          family: selectedFamily || undefined,
          brand: selectedBrand || undefined,
          article_type: selectedType || undefined,
        }),
        // Cascade filtering: pass current filter selections to narrow options
        productsApi.getFilters({
          family: selectedFamily || undefined,
          brand: selectedBrand || undefined,
          article_type: selectedType || undefined,
        }),
      ]);

      console.log('✅ Products loaded:', productsData.length);
      console.log('✅ Filters loaded:', filtersData);

      setProducts(productsData);
      setFilters(filtersData);
    } catch (error: any) {
      console.error('❌ Error loading products:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response:', error.response?.data);
      Alert.alert('Erreur', error.message || 'Impossible de charger les produits');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedFamily, selectedBrand, selectedType]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Générer un code SKU automatique
  const generateSku = () => {
    const familyCode = (formData.family || 'PRD').substring(0, 3).toUpperCase();
    const brandCode = (formData.brand || '').substring(0, 3).toUpperCase();
    const refCode = (formData.reference || '').replace(/\s+/g, '').substring(0, 6);
    const randomNum = Math.floor(Math.random() * 100)
      .toString()
      .padStart(2, '0');

    let sku = familyCode;
    if (brandCode) sku += brandCode;
    if (refCode) sku += refCode;
    sku += randomNum;

    setFormData(prev => ({ ...prev, sku }));
  };

  // Ouvrir le modal pour ajouter
  const openAddModal = () => {
    setFormData(DEFAULT_FORM);
    setIsEditing(false);
    setShowProductModal(true);
  };

  // Ouvrir le modal pour modifier
  const openEditModal = (product: Product) => {
    setFormData({
      id: product.id,
      sku: product.sku,
      name: product.name,
      barcode: product.barcode || '',
      description: product.description || '',
      family: product.family || '',
      article_type: product.article_type || '',
      brand: product.brand || '',
      reference: product.reference || '',
      unit: product.unit,
      cost_price: String(product.cost_price),
      sell_price: String(product.sell_price),
      alert_threshold: String(product.alert_threshold),
      is_active: product.is_active,
    });
    setIsEditing(true);
    setShowProductModal(true);
  };

  // Sauvegarder le produit
  const saveProduct = async () => {
    // Validation
    if (!formData.sku.trim()) {
      Alert.alert('Erreur', 'Le code article (SKU) est requis');
      return;
    }
    if (!formData.name.trim()) {
      Alert.alert('Erreur', 'Le libellé article est requis');
      return;
    }
    if (!formData.family.trim()) {
      Alert.alert('Erreur', 'La famille est requise');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        barcode: formData.barcode?.trim() || undefined,
        description: formData.description?.trim() || undefined,
        family: formData.family.trim(),
        article_type: formData.article_type?.trim() || undefined,
        brand: formData.brand?.trim() || undefined,
        reference: formData.reference?.trim() || undefined,
        unit: formData.unit,
        cost_price: parseInt(formData.cost_price) || 0,
        sell_price: parseInt(formData.sell_price) || 0,
        alert_threshold: parseInt(formData.alert_threshold) || 5,
        is_active: formData.is_active,
      };

      console.log('💾 Saving product:', {
        isEditing,
        productId: formData.id,
        data,
      });

      if (isEditing && formData.id) {
        console.log('📝 Updating product:', formData.id);
        const result = await productsApi.update(formData.id, data);
        console.log('✅ Product updated:', result);
        Alert.alert('Succès', 'Article modifié avec succès');
      } else {
        console.log('➕ Creating new product');
        const result = await productsApi.create(data);
        console.log('✅ Product created:', result);
        Alert.alert('Succès', 'Article ajouté avec succès');
      }

      setShowProductModal(false);
      setFormData(DEFAULT_FORM);
      loadData();
    } catch (error: any) {
      console.error('❌ Error saving product:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      Alert.alert(
        'Erreur',
        error.response?.data?.message || error.message || 'Impossible de sauvegarder'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Supprimer un produit
  const deleteProduct = (product: Product) => {
    Alert.alert('Supprimer', `Voulez-vous vraiment supprimer "${product.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await productsApi.delete(product.id);
            Alert.alert('Succès', 'Article supprimé');
            loadData();
          } catch (error: any) {
            Alert.alert('Erreur', error.message || 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  // Réinitialiser les filtres
  const clearFilters = () => {
    setSelectedFamily('');
    setSelectedBrand('');
    setSelectedType('');
    setShowFiltersModal(false);
  };

  const activeFiltersCount = [selectedFamily, selectedBrand, selectedType].filter(Boolean).length;

  // Open hierarchy edit modal
  const openHierarchyEditModal = (
    type: 'family' | 'article_type' | 'brand' | 'reference',
    oldValue: string,
    context?: { family?: string; article_type?: string; brand?: string }
  ) => {
    setHierarchyEditType(type);
    setHierarchyEditOldValue(oldValue);
    setHierarchyEditNewValue(oldValue);
    setHierarchyEditContext(context || {});
    setShowHierarchyEditModal(true);
  };

  // Save hierarchy edit using batch update API
  const saveHierarchyEdit = async () => {
    if (!hierarchyEditType || !hierarchyEditNewValue.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une valeur');
      return;
    }

    if (hierarchyEditNewValue.trim() === hierarchyEditOldValue) {
      setShowHierarchyEditModal(false);
      return;
    }

    setIsHierarchySaving(true);
    try {
      const request: any = {
        level: hierarchyEditType,
        old_value: hierarchyEditOldValue,
        new_value: hierarchyEditNewValue.trim(),
      };

      // Add filter context for article_type, brand, and reference
      if (hierarchyEditType === 'article_type' && hierarchyEditContext.family) {
        request.family = hierarchyEditContext.family;
      }
      if (hierarchyEditType === 'brand') {
        if (hierarchyEditContext.family) request.family = hierarchyEditContext.family;
        if (hierarchyEditContext.article_type)
          request.article_type = hierarchyEditContext.article_type;
      }
      if (hierarchyEditType === 'reference') {
        if (hierarchyEditContext.family) request.family = hierarchyEditContext.family;
        if (hierarchyEditContext.article_type)
          request.article_type = hierarchyEditContext.article_type;
        if (hierarchyEditContext.brand) request.brand = hierarchyEditContext.brand;
      }

      const result = await productsApi.batchUpdateHierarchy(request);
      Alert.alert('Succès', result.message || `${result.count} produit(s) mis à jour`);
      setShowHierarchyEditModal(false);
      loadData();
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour:', error);
      Alert.alert('Erreur', error.message || 'Impossible de mettre à jour');
    } finally {
      setIsHierarchySaving(false);
    }
  };

  // Import functions
  const openImportModal = () => {
    setShowImportModal(true);
    setImportStep('select');
    setImportFile(null);
    setImportPreview(null);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportPreview(null);
    setImportStep('select');
  };

  const pickDocument = async () => {
    try {
      console.log('📂 Opening document picker...');
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'text/plain', // Some CSV files are detected as text/plain
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          '*/*', // Fallback for any file type
        ],
        copyToCacheDirectory: true,
      });

      console.log('📄 Document picker result:', JSON.stringify(result, null, 2));

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log('❌ Document selection cancelled');
        return;
      }

      const file = result.assets[0];
      console.log('📄 Selected file:', file.name, 'URI:', file.uri);

      // Read file content as base64
      setIsImporting(true);
      try {
        const response = await fetch(file.uri);
        const blob = await response.blob();
        console.log('📦 File blob size:', blob.size, 'bytes');

        const reader = new FileReader();

        reader.onerror = () => {
          console.error('❌ FileReader error:', reader.error);
          Alert.alert('Erreur', 'Impossible de lire le contenu du fichier');
          setIsImporting(false);
        };

        reader.onloadend = async () => {
          try {
            const base64Content = (reader.result as string).split(',')[1];
            console.log('📤 Base64 content length:', base64Content?.length || 0);

            if (!base64Content) {
              Alert.alert('Erreur', 'Le fichier semble vide');
              setIsImporting(false);
              return;
            }

            setImportFile({ name: file.name, content: base64Content });

            // Preview the import
            console.log('🔄 Calling preview API...');
            const preview = await importApi.previewCatalog(base64Content, file.name);
            console.log('✅ Preview result:', JSON.stringify(preview, null, 2));
            setImportPreview(preview);
            setImportStep('preview');
          } catch (error: any) {
            console.error('❌ Erreur lors de la prévisualisation:', error);
            Alert.alert(
              'Erreur',
              error.message || "Impossible de prévisualiser le fichier. Vérifiez le format et les colonnes."
            );
          } finally {
            setIsImporting(false);
          }
        };

        reader.readAsDataURL(blob);
      } catch (fetchError: any) {
        console.error('❌ Error fetching file:', fetchError);
        Alert.alert('Erreur', 'Impossible de lire le fichier sélectionné');
        setIsImporting(false);
      }
    } catch (error: any) {
      console.error('❌ Erreur lors de la sélection du fichier:', error);
      Alert.alert('Erreur', error.message || 'Impossible de sélectionner le fichier');
      setIsImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importFile) return;

    setIsImporting(true);
    try {
      const result = await importApi.confirmCatalog(importFile.content, importFile.name);
      setImportStep('success');
      Alert.alert(
        'Import réussi',
        `${result.created_count || 0} article(s) créé(s), ${result.updated_count || 0} mis à jour`,
        [
          {
            text: 'OK',
            onPress: () => {
              closeImportModal();
              loadData();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error("Erreur lors de l'import:", error);
      Alert.alert('Erreur', error.message || "Impossible d'importer le catalogue");
    } finally {
      setIsImporting(false);
    }
  };

  // Suggestions filtrées
  const filteredFamilySuggestions = filters.families.filter(f =>
    f.toLowerCase().includes(formData.family.toLowerCase())
  );
  const filteredBrandSuggestions = filters.brands.filter(b =>
    b.toLowerCase().includes(formData.brand.toLowerCase())
  );
  const filteredTypeSuggestions = filters.article_types.filter(t =>
    t.toLowerCase().includes(formData.article_type.toLowerCase())
  );

  // Rendu de l'onglet Articles (gestion des produits)
  const renderArticlesTab = () => {
    const renderProduct = ({ item }: { item: Product }) => {
      const stockStatus = item.is_low_stock
        ? { color: Colors.warning.main, label: 'Stock faible' }
        : item.current_stock === 0
          ? { color: Colors.danger.main, label: 'Rupture' }
          : { color: Colors.success.main, label: 'En stock' };

      return (
        <TouchableOpacity
          style={styles.productCard}
          onPress={() => openEditModal(item)}
          activeOpacity={0.7}
        >
          <View style={styles.productHeader}>
            <View style={styles.productInfo}>
              <Text style={styles.productSku}>{item.sku}</Text>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              <View style={styles.productTags}>
                {item.family && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{item.family}</Text>
                  </View>
                )}
                {item.brand && (
                  <View style={[styles.tag, styles.tagBrand]}>
                    <Text style={[styles.tagText, styles.tagBrandText]}>{item.brand}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.productMeta}>
              <Text style={styles.productPrice}>{formatMoney(item.sell_price)}</Text>
              <View style={[styles.stockBadge, { backgroundColor: stockStatus.color + '20' }]}>
                <View style={[styles.stockDot, { backgroundColor: stockStatus.color }]} />
                <Text style={[styles.stockText, { color: stockStatus.color }]}>
                  {item.current_stock} {item.unit}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.productDetails}>
            {item.article_type && (
              <Text style={styles.productDetail}>Type: {item.article_type}</Text>
            )}
            {item.reference && <Text style={styles.productDetail}>Réf: {item.reference}</Text>}
          </View>
          <View style={styles.productActions}>
            <TouchableOpacity style={styles.editButton} onPress={() => openEditModal(item)}>
              <Edit size={16} color={Colors.primary[900]} />
              <Text style={styles.editButtonText}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => deleteProduct(item)}>
              <Trash size={16} color={Colors.danger.main} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <>
        {/* Barre de recherche et filtres */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.muted.foreground} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un article..."
              placeholderTextColor={Colors.muted.foreground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={20} color={Colors.muted.foreground} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.filterButton, activeFiltersCount > 0 && styles.filterButtonActive]}
            onPress={() => setShowFiltersModal(true)}
          >
            <Filter
              size={20}
              color={activeFiltersCount > 0 ? Colors.primary.foreground : Colors.primary[900]}
            />
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Filtres actifs */}
        {activeFiltersCount > 0 && (
          <View style={styles.activeFilters}>
            {selectedFamily && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedFamily('')}
              >
                <Text style={styles.activeFilterText}>Famille: {selectedFamily}</Text>
                <X size={14} color={Colors.primary[900]} />
              </TouchableOpacity>
            )}
            {selectedBrand && (
              <TouchableOpacity
                style={styles.activeFilterChip}
                onPress={() => setSelectedBrand('')}
              >
                <Text style={styles.activeFilterText}>Marque: {selectedBrand}</Text>
                <X size={14} color={Colors.primary[900]} />
              </TouchableOpacity>
            )}
            {selectedType && (
              <TouchableOpacity style={styles.activeFilterChip} onPress={() => setSelectedType('')}>
                <Text style={styles.activeFilterText}>Type: {selectedType}</Text>
                <X size={14} color={Colors.primary[900]} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Stats rapides et bouton import */}
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>
            {products.length} article{products.length > 1 ? 's' : ''}
          </Text>
          <View style={styles.statsBarActions}>
            {isLoading && <ActivityIndicator size="small" color={Colors.primary[900]} />}
            <TouchableOpacity style={styles.importButton} onPress={openImportModal}>
              <Upload size={16} color={Colors.primary[900]} />
              <Text style={styles.importButtonText}>Importer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Liste des produits */}
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Package size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>Aucun article trouvé</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || activeFiltersCount > 0
                  ? 'Essayez de modifier vos critères de recherche'
                  : 'Ajoutez des articles à votre catalogue'}
              </Text>
            </View>
          }
        />

        {/* Bouton flottant ajouter */}
        <TouchableOpacity style={styles.fab} onPress={openAddModal}>
          <Plus size={24} color={Colors.primary.foreground} />
        </TouchableOpacity>
      </>
    );
  };

  // Rendu de l'onglet Catalogue (tableau de référence)
  const renderCatalogueTab = () => {
    // Grouper les produits par famille, puis par type d'article, puis par marque
    const productsByFamily: { [key: string]: Product[] } = {};
    products.forEach(product => {
      const family = product.family || 'Autres';
      if (!productsByFamily[family]) {
        productsByFamily[family] = [];
      }
      productsByFamily[family].push(product);
    });

    // Get unique article types and brands for each family
    const getUniqueArticleTypes = (familyProducts: Product[]): string[] => {
      const types = new Set<string>();
      familyProducts.forEach(p => {
        if (p.article_type) types.add(p.article_type);
      });
      return Array.from(types);
    };

    const getUniqueBrands = (familyProducts: Product[], articleType?: string): string[] => {
      const brands = new Set<string>();
      familyProducts.forEach(p => {
        if (p.brand && (!articleType || p.article_type === articleType)) {
          brands.add(p.brand);
        }
      });
      return Array.from(brands);
    };

    const getUniqueReferences = (
      familyProducts: Product[],
      articleType?: string,
      brand?: string
    ): string[] => {
      const refs = new Set<string>();
      familyProducts.forEach(p => {
        if (
          p.reference &&
          (!articleType || p.article_type === articleType) &&
          (!brand || p.brand === brand)
        ) {
          refs.add(p.reference);
        }
      });
      return Array.from(refs);
    };

    return (
      <ScrollView contentContainerStyle={styles.catalogueContainer}>
        {Object.entries(productsByFamily).map(([family, familyProducts]) => (
          <View key={family} style={styles.familySection}>
            {/* Family header with edit button */}
            <View style={styles.familyTitleRow}>
              <Text style={styles.familyTitle}>{family}</Text>
              {family !== 'Autres' && (
                <TouchableOpacity
                  style={styles.hierarchyEditButton}
                  onPress={() => openHierarchyEditModal('family', family)}
                >
                  <Edit size={14} color={Colors.primary[900]} />
                </TouchableOpacity>
              )}
            </View>

            {/* Types d'articles avec boutons d'édition */}
            {getUniqueArticleTypes(familyProducts).length > 0 && (
              <View style={styles.hierarchyTagsContainer}>
                <Text style={styles.hierarchyLabel}>Types:</Text>
                <View style={styles.hierarchyTags}>
                  {getUniqueArticleTypes(familyProducts).map(articleType => (
                    <TouchableOpacity
                      key={articleType}
                      style={styles.hierarchyTag}
                      onPress={() =>
                        openHierarchyEditModal('article_type', articleType, { family })
                      }
                    >
                      <Text style={styles.hierarchyTagText}>{articleType}</Text>
                      <Edit size={10} color={Colors.primary[900]} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Marques avec boutons d'édition */}
            {getUniqueBrands(familyProducts).length > 0 && (
              <View style={styles.hierarchyTagsContainer}>
                <Text style={styles.hierarchyLabel}>Marques:</Text>
                <View style={styles.hierarchyTags}>
                  {getUniqueBrands(familyProducts).map(brand => (
                    <TouchableOpacity
                      key={brand}
                      style={[styles.hierarchyTag, styles.hierarchyTagBrand]}
                      onPress={() => openHierarchyEditModal('brand', brand, { family })}
                    >
                      <Text style={[styles.hierarchyTagText, styles.hierarchyTagBrandText]}>
                        {brand}
                      </Text>
                      <Edit size={10} color={Colors.success.main} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* En-tête du tableau */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Article</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Marque</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Référence</Text>
            </View>

            {/* Lignes du tableau */}
            {familyProducts.map(product => (
              <View key={product.id} style={styles.tableRow}>
                <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={2}>
                  {product.article_type || product.name}
                </Text>
                <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                  {product.brand || '-'}
                </Text>
                {product.reference ? (
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                    onPress={() =>
                      openHierarchyEditModal('reference', product.reference!, {
                        family,
                        article_type: product.article_type,
                        brand: product.brand,
                      })
                    }
                  >
                    <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                      {product.reference}
                    </Text>
                    <Edit size={10} color={Colors.primary[900]} />
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                    -
                  </Text>
                )}
              </View>
            ))}
          </View>
        ))}

        {products.length === 0 && (
          <View style={styles.emptyState}>
            <Package size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>Aucun article dans le catalogue</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  if (isLoading && products.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Catalogue" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Catalogue"
        showBack
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            onPress={() => navigation.navigate('CatalogHierarchy')}
            style={styles.hierarchyButton}
          >
            <Package size={20} color={Colors.primary[900]} />
            <Text style={styles.hierarchyButtonText}>Hiérarchie</Text>
          </TouchableOpacity>
        }
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'articles' && styles.tabActive]}
          onPress={() => setActiveTab('articles')}
        >
          <Text style={[styles.tabText, activeTab === 'articles' && styles.tabTextActive]}>
            Articles ({products.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'catalogue' && styles.tabActive]}
          onPress={() => setActiveTab('catalogue')}
        >
          <Text style={[styles.tabText, activeTab === 'catalogue' && styles.tabTextActive]}>
            Catalogue
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contenu selon l'onglet actif */}
      {activeTab === 'articles' ? renderArticlesTab() : renderCatalogueTab()}

      {/* Modal Filtres */}
      <Modal
        visible={showFiltersModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFiltersModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filtres</Text>
              <TouchableOpacity onPress={() => setShowFiltersModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Famille */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Famille</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[styles.filterOption, !selectedFamily && styles.filterOptionActive]}
                    onPress={() => setSelectedFamily('')}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        !selectedFamily && styles.filterOptionTextActive,
                      ]}
                    >
                      Toutes
                    </Text>
                  </TouchableOpacity>
                  {filters.families.map(family => (
                    <TouchableOpacity
                      key={family}
                      style={[
                        styles.filterOption,
                        selectedFamily === family && styles.filterOptionActive,
                      ]}
                      onPress={() => setSelectedFamily(family)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedFamily === family && styles.filterOptionTextActive,
                        ]}
                      >
                        {family}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Marque */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Marque</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[styles.filterOption, !selectedBrand && styles.filterOptionActive]}
                    onPress={() => setSelectedBrand('')}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        !selectedBrand && styles.filterOptionTextActive,
                      ]}
                    >
                      Toutes
                    </Text>
                  </TouchableOpacity>
                  {filters.brands.map(brand => (
                    <TouchableOpacity
                      key={brand}
                      style={[
                        styles.filterOption,
                        selectedBrand === brand && styles.filterOptionActive,
                      ]}
                      onPress={() => setSelectedBrand(brand)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedBrand === brand && styles.filterOptionTextActive,
                        ]}
                      >
                        {brand}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Type d'article */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Type d'article</Text>
                <View style={styles.filterOptions}>
                  <TouchableOpacity
                    style={[styles.filterOption, !selectedType && styles.filterOptionActive]}
                    onPress={() => setSelectedType('')}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        !selectedType && styles.filterOptionTextActive,
                      ]}
                    >
                      Tous
                    </Text>
                  </TouchableOpacity>
                  {filters.article_types.map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.filterOption,
                        selectedType === type && styles.filterOptionActive,
                      ]}
                      onPress={() => setSelectedType(type)}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          selectedType === type && styles.filterOptionTextActive,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalClearButton} onPress={clearFilters}>
                <Text style={styles.modalClearButtonText}>Réinitialiser</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyButton}
                onPress={() => setShowFiltersModal(false)}
              >
                <Text style={styles.modalApplyButtonText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Produit (Ajout/Modification) - Seulement dans l'onglet Articles */}
      {activeTab === 'articles' && (
        <Modal
          visible={showProductModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowProductModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.productModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {isEditing ? "Modifier l'article" : 'Nouvel article'}
                </Text>
                <TouchableOpacity onPress={() => setShowProductModal(false)}>
                  <X size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                {/* Famille (avec suggestions) */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Famille *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.family}
                    onChangeText={text => {
                      setFormData(prev => ({ ...prev, family: text }));
                      setShowFamilySuggestions(true);
                    }}
                    onFocus={() => setShowFamilySuggestions(true)}
                    onBlur={() => setTimeout(() => setShowFamilySuggestions(false), 200)}
                    placeholder="Ex: GLASSES, CHARGEURS"
                    placeholderTextColor={Colors.muted.foreground}
                  />
                  {showFamilySuggestions &&
                    (filteredFamilySuggestions.length > 0 || formData.family.trim()) && (
                      <View style={styles.suggestions}>
                        {filteredFamilySuggestions.slice(0, 5).map(suggestion => (
                          <TouchableOpacity
                            key={suggestion}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setFormData(prev => ({ ...prev, family: suggestion }));
                              setShowFamilySuggestions(false);
                            }}
                          >
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                          </TouchableOpacity>
                        ))}
                        {formData.family.trim() &&
                          !filters.families.some(
                            f => f.toLowerCase() === formData.family.toLowerCase()
                          ) && (
                            <TouchableOpacity
                              style={[styles.suggestionItem, styles.createNewItem]}
                              onPress={() => setShowFamilySuggestions(false)}
                            >
                              <Plus size={14} color={Colors.success.main} />
                              <Text style={[styles.suggestionText, styles.createNewText]}>
                                Créer "{formData.family.trim()}"
                              </Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    )}
                </View>

                {/* Type d'article (avec suggestions) */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Type d'article</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.article_type}
                    onChangeText={text => {
                      setFormData(prev => ({ ...prev, article_type: text }));
                      setShowTypeSuggestions(true);
                    }}
                    onFocus={() => setShowTypeSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTypeSuggestions(false), 200)}
                    placeholder="Ex: Glass 3D, Chargeur 1A TC"
                    placeholderTextColor={Colors.muted.foreground}
                  />
                  {showTypeSuggestions &&
                    (filteredTypeSuggestions.length > 0 || formData.article_type.trim()) && (
                      <View style={styles.suggestions}>
                        {filteredTypeSuggestions.slice(0, 5).map(suggestion => (
                          <TouchableOpacity
                            key={suggestion}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setFormData(prev => ({ ...prev, article_type: suggestion }));
                              setShowTypeSuggestions(false);
                            }}
                          >
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                          </TouchableOpacity>
                        ))}
                        {formData.article_type.trim() &&
                          !filters.article_types.some(
                            t => t.toLowerCase() === formData.article_type.toLowerCase()
                          ) && (
                            <TouchableOpacity
                              style={[styles.suggestionItem, styles.createNewItem]}
                              onPress={() => setShowTypeSuggestions(false)}
                            >
                              <Plus size={14} color={Colors.success.main} />
                              <Text style={[styles.suggestionText, styles.createNewText]}>
                                Créer "{formData.article_type.trim()}"
                              </Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    )}
                </View>

                {/* Marque (avec suggestions) */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Marque</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.brand}
                    onChangeText={text => {
                      setFormData(prev => ({ ...prev, brand: text }));
                      setShowBrandSuggestions(true);
                    }}
                    onFocus={() => setShowBrandSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                    placeholder="Ex: Tecno, Samsung, Oraimo"
                    placeholderTextColor={Colors.muted.foreground}
                  />
                  {showBrandSuggestions &&
                    (filteredBrandSuggestions.length > 0 || formData.brand.trim()) && (
                      <View style={styles.suggestions}>
                        {filteredBrandSuggestions.slice(0, 5).map(suggestion => (
                          <TouchableOpacity
                            key={suggestion}
                            style={styles.suggestionItem}
                            onPress={() => {
                              setFormData(prev => ({ ...prev, brand: suggestion }));
                              setShowBrandSuggestions(false);
                            }}
                          >
                            <Text style={styles.suggestionText}>{suggestion}</Text>
                          </TouchableOpacity>
                        ))}
                        {formData.brand.trim() &&
                          !filters.brands.some(
                            b => b.toLowerCase() === formData.brand.toLowerCase()
                          ) && (
                            <TouchableOpacity
                              style={[styles.suggestionItem, styles.createNewItem]}
                              onPress={() => setShowBrandSuggestions(false)}
                            >
                              <Plus size={14} color={Colors.success.main} />
                              <Text style={[styles.suggestionText, styles.createNewText]}>
                                Créer "{formData.brand.trim()}"
                              </Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    )}
                </View>

                {/* Référence/Série */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Référence / Série</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.reference}
                    onChangeText={text => setFormData(prev => ({ ...prev, reference: text }))}
                    placeholder="Ex: Spark 4, A10E"
                    placeholderTextColor={Colors.muted.foreground}
                  />
                </View>

                {/* Code Article (SKU) */}
                <View style={styles.formGroup}>
                  <View style={styles.formLabelRow}>
                    <Text style={styles.formLabel}>Code Article (SKU) *</Text>
                    {!isEditing && (
                      <TouchableOpacity onPress={generateSku}>
                        <Text style={styles.generateLink}>Générer</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={[styles.input, isEditing && styles.inputDisabled]}
                    value={formData.sku}
                    onChangeText={text =>
                      setFormData(prev => ({ ...prev, sku: text.toUpperCase() }))
                    }
                    placeholder="Ex: GLA01TECSpk4"
                    placeholderTextColor={Colors.muted.foreground}
                    editable={!isEditing}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Libellé Article */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Libellé Article *</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.name}
                    onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
                    placeholder="Ex: Glass 3D Tecno Spark 4"
                    placeholderTextColor={Colors.muted.foreground}
                  />
                </View>

                {/* Prix */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Prix d'achat</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.cost_price}
                      onChangeText={text =>
                        setFormData(prev => ({ ...prev, cost_price: text.replace(/[^0-9]/g, '') }))
                      }
                      placeholder="0"
                      placeholderTextColor={Colors.muted.foreground}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Prix de vente</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.sell_price}
                      onChangeText={text =>
                        setFormData(prev => ({ ...prev, sell_price: text.replace(/[^0-9]/g, '') }))
                      }
                      placeholder="0"
                      placeholderTextColor={Colors.muted.foreground}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Seuil d'alerte et Unité */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Seuil d'alerte</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.alert_threshold}
                      onChangeText={text =>
                        setFormData(prev => ({
                          ...prev,
                          alert_threshold: text.replace(/[^0-9]/g, ''),
                        }))
                      }
                      placeholder="5"
                      placeholderTextColor={Colors.muted.foreground}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Unité</Text>
                    <View style={styles.unitPicker}>
                      <Text style={styles.unitPickerText}>{formData.unit}</Text>
                    </View>
                  </View>
                </View>

                {/* Actif */}
                <TouchableOpacity
                  style={styles.toggleRow}
                  onPress={() => setFormData(prev => ({ ...prev, is_active: !prev.is_active }))}
                >
                  <Text style={styles.formLabel}>Article actif</Text>
                  <View style={[styles.toggle, formData.is_active && styles.toggleActive]}>
                    {formData.is_active && <Check size={16} color={Colors.primary.foreground} />}
                  </View>
                </TouchableOpacity>
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => {
                    setShowProductModal(false);
                    setFormData(DEFAULT_FORM);
                  }}
                >
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalSaveButton}
                  onPress={saveProduct}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={Colors.primary.foreground} />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>
                      {isEditing ? 'Enregistrer' : 'Ajouter'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Hierarchy Edit Modal (for Catalogue tab) */}
      <Modal
        visible={showHierarchyEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHierarchyEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Modifier{' '}
                {hierarchyEditType === 'family'
                  ? 'Famille'
                  : hierarchyEditType === 'article_type'
                    ? "Type d'article"
                    : hierarchyEditType === 'brand'
                      ? 'Marque'
                      : 'Référence'}
              </Text>
              <TouchableOpacity onPress={() => setShowHierarchyEditModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>
                {hierarchyEditType === 'family'
                  ? 'Nom de la famille'
                  : hierarchyEditType === 'article_type'
                    ? "Type d'article"
                    : hierarchyEditType === 'brand'
                      ? 'Nom de la marque'
                      : 'Référence produit'}
              </Text>
              <TextInput
                style={styles.input}
                value={hierarchyEditNewValue}
                onChangeText={setHierarchyEditNewValue}
                placeholder={`Ex: ${hierarchyEditType === 'family' ? 'GLASSES' : hierarchyEditType === 'article_type' ? 'Glass 3D' : hierarchyEditType === 'brand' ? 'Samsung' : 'A54-5G'}`}
                placeholderTextColor={Colors.muted.foreground}
                autoFocus
              />
              <Text style={styles.hierarchyEditHint}>
                Tous les produits avec "{hierarchyEditOldValue}" seront mis à jour.
              </Text>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowHierarchyEditModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveHierarchyEdit}
                disabled={isHierarchySaving}
              >
                {isHierarchySaving ? (
                  <ActivityIndicator size="small" color={Colors.primary.foreground} />
                ) : (
                  <Text style={styles.modalSaveButtonText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Import Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={closeImportModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Importer un catalogue</Text>
              <TouchableOpacity onPress={closeImportModal}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {importStep === 'select' && (
                <View style={styles.importSelectContainer}>
                  <View style={styles.importIconContainer}>
                    <FileSpreadsheet size={64} color={Colors.primary[900]} />
                  </View>
                  <Text style={styles.importTitle}>Sélectionnez un fichier</Text>
                  <Text style={styles.importSubtitle}>
                    Formats acceptés: CSV, Excel (.xls, .xlsx)
                  </Text>
                  <Text style={styles.importHint}>
                    Le fichier doit contenir les colonnes: famille, type_article, marque, reference,
                    prix_achat, prix_vente
                  </Text>
                  <TouchableOpacity
                    style={styles.importPickButton}
                    onPress={pickDocument}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <ActivityIndicator size="small" color={Colors.primary.foreground} />
                    ) : (
                      <>
                        <Upload size={20} color={Colors.primary.foreground} />
                        <Text style={styles.importPickButtonText}>Choisir un fichier</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {importStep === 'preview' && importPreview && (
                <View style={styles.importPreviewContainer}>
                  <View style={styles.importPreviewHeader}>
                    <View style={styles.importPreviewStat}>
                      <Text style={styles.importPreviewStatValue}>{importPreview.valid_count}</Text>
                      <Text style={styles.importPreviewStatLabel}>Valides</Text>
                    </View>
                    <View style={styles.importPreviewStat}>
                      <Text style={[styles.importPreviewStatValue, { color: Colors.danger.main }]}>
                        {importPreview.invalid_count}
                      </Text>
                      <Text style={styles.importPreviewStatLabel}>Invalides</Text>
                    </View>
                  </View>

                  {importFile && (
                    <View style={styles.importFileInfo}>
                      <FileSpreadsheet size={20} color={Colors.primary[900]} />
                      <Text style={styles.importFileName}>{importFile.name}</Text>
                    </View>
                  )}

                  {importPreview.errors.length > 0 && (
                    <View style={styles.importErrors}>
                      <Text style={styles.importErrorsTitle}>
                        Erreurs ({importPreview.errors.length})
                      </Text>
                      {importPreview.errors.slice(0, 5).map((error, index) => (
                        <View key={index} style={styles.importErrorItem}>
                          <Text style={styles.importErrorRow}>Ligne {error.row}</Text>
                          <Text style={styles.importErrorMessage}>
                            {error.field}: {error.message}
                          </Text>
                        </View>
                      ))}
                      {importPreview.errors.length > 5 && (
                        <Text style={styles.importErrorMore}>
                          +{importPreview.errors.length - 5} autres erreurs
                        </Text>
                      )}
                    </View>
                  )}

                  {importPreview.preview_rows && importPreview.preview_rows.length > 0 && (
                    <View style={styles.importPreviewRows}>
                      <Text style={styles.importPreviewRowsTitle}>Aperçu</Text>
                      {importPreview.preview_rows.slice(0, 3).map((row, index) => (
                        <View key={index} style={styles.importPreviewRow}>
                          <Text style={styles.importPreviewRowName}>
                            {row.name || `${row.family} - ${row.article_type} - ${row.brand}`}
                          </Text>
                          <Text style={styles.importPreviewRowPrice}>
                            {formatMoney(row.sell_price || 0)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {importStep === 'preview' && (
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={closeImportModal}>
                  <Text style={styles.modalCancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalSaveButton,
                    importPreview?.valid_count === 0 && styles.modalButtonDisabled,
                  ]}
                  onPress={confirmImport}
                  disabled={isImporting || importPreview?.valid_count === 0}
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color={Colors.primary.foreground} />
                  ) : (
                    <Text style={styles.modalSaveButtonText}>
                      Importer {importPreview?.valid_count || 0} article(s)
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
  searchContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
  filterButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.danger.main,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 16,
    gap: Spacing.xs,
  },
  activeFilterText: {
    fontSize: 13,
    color: Colors.primary[900],
    fontWeight: '500',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  statsBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  statsText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary[50],
    borderRadius: 8,
  },
  importButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary[900],
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
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
    padding: Spacing.md,
    gap: Spacing.md,
  },
  productInfo: {
    flex: 1,
  },
  productSku: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary[900],
    marginBottom: 2,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  productTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
  },
  tag: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 11,
    color: Colors.primary[900],
    fontWeight: '500',
  },
  tagBrand: {
    backgroundColor: Colors.success.main + '20',
  },
  tagBrandText: {
    color: Colors.success.main,
  },
  productMeta: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '500',
  },
  productDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  productDetail: {
    fontSize: 12,
    color: Colors.muted.foreground,
  },
  productActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary[900],
  },
  deleteButton: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
  },
  emptyState: {
    padding: Spacing['3xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.muted.foreground,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.muted.foreground,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary[900],
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  // Onglet Catalogue
  catalogueContainer: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  familySection: {
    marginBottom: Spacing.xl,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  familyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  familyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  hierarchyEditButton: {
    padding: Spacing.xs,
    borderRadius: 6,
    backgroundColor: Colors.surface,
  },
  hierarchyTagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  hierarchyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.muted.foreground,
  },
  hierarchyTags: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  hierarchyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  hierarchyTagBrand: {
    backgroundColor: Colors.success.main + '20',
  },
  hierarchyTagText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.primary[900],
  },
  hierarchyTagBrandText: {
    color: Colors.success.main,
  },
  hierarchyEditHint: {
    marginTop: Spacing.md,
    fontSize: 12,
    fontStyle: 'italic',
    color: Colors.muted.foreground,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.muted.main,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableCell: {
    fontSize: 14,
    color: Colors.text,
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
    maxHeight: '80%',
  },
  productModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '95%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  modalBody: {
    padding: Spacing.lg,
  },
  filterSection: {
    marginBottom: Spacing.xl,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  filterOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  filterOptionActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  filterOptionText: {
    fontSize: 13,
    color: Colors.text,
  },
  filterOptionTextActive: {
    color: Colors.primary.foreground,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalClearButton: {
    flex: 1,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalClearButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  modalApplyButton: {
    flex: 1,
    backgroundColor: Colors.primary[900],
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalApplyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: Colors.muted.main,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 15,
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
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  // Form
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
  formLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  generateLink: {
    fontSize: 13,
    color: Colors.primary[900],
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
  inputDisabled: {
    backgroundColor: Colors.muted.main,
    color: Colors.muted.foreground,
  },
  suggestions: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 150,
  },
  suggestionItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  createNewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.success.main + '10',
  },
  createNewText: {
    color: Colors.success.main,
    fontWeight: '600',
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.text,
  },
  unitPicker: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  unitPickerText: {
    fontSize: 15,
    color: Colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  toggle: {
    width: 44,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.muted.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.success.main,
  },
  hierarchyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primary[50],
    borderRadius: 8,
  },
  hierarchyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary[900],
  },
  // Import Modal Styles
  importSelectContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  importIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  importTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  importSubtitle: {
    fontSize: 14,
    color: Colors.muted.foreground,
    marginBottom: Spacing.md,
  },
  importHint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  importPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[900],
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
  },
  importPickButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  importPreviewContainer: {
    paddingVertical: Spacing.md,
  },
  importPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  importPreviewStat: {
    alignItems: 'center',
  },
  importPreviewStatValue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.success.main,
  },
  importPreviewStatLabel: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  importFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.lg,
  },
  importFileName: {
    fontSize: 14,
    color: Colors.primary[900],
    fontWeight: '500',
  },
  importErrors: {
    backgroundColor: Colors.danger.main + '10',
    borderRadius: 8,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  importErrorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger.main,
    marginBottom: Spacing.sm,
  },
  importErrorItem: {
    marginBottom: Spacing.sm,
  },
  importErrorRow: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger.main,
  },
  importErrorMessage: {
    fontSize: 12,
    color: Colors.text,
  },
  importErrorMore: {
    fontSize: 12,
    color: Colors.muted.foreground,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },
  importPreviewRows: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: Spacing.md,
  },
  importPreviewRowsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  importPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  importPreviewRowName: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
  },
  importPreviewRowPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary[900],
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
});
