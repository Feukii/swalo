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
  SectionList,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Package,
  Plus,
  Edit,
  Search,
  Filter,
  X,
  Check,
  Upload,
  FileSpreadsheet,
  ChevronDown,
  AlertTriangle,
  TrendingUp,
} from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing, Shadows } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePermissions } from '../hooks/usePermissions';
import * as DocumentPicker from 'expo-document-picker';
import { productRepo, stockBatchRepo, packagingTypeRepo } from '../db/repositories';
import { importApi } from '../lib/api';
import {
  createProductOffline,
  updateProductOffline,
  deleteProductOffline,
  OfflineProductInput,
} from '../db/offlineWrite';

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
  is_multi_price?: boolean;
  price_min?: number;
  price_max?: number;
  // Modèle carton-primary : conditionnement (carton) + sous-conditionnement (pièce).
  packaging_type_id?: string | null;
  units_per_package?: number | null;
  package_price?: number | null;
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
  // Conditionnement (carton) OBLIGATOIRE :
  packaging_type_id: string | null; // type de conditionnement (Carton, Boîte, …)
  units_per_package: string; // pièces par conditionnement (UPP ≥ 1)
  cost_price: string; // prix de revient AU CARTON
  package_price: string; // prix de vente au carton (gros)
  // Sous-conditionnement (pièce) OPTIONNEL :
  detail_enabled: boolean; // « Vendre aussi au détail (pièce) »
  sell_price: string; // prix de détail (pièce)
  alert_threshold: string; // seuil d'alerte en CARTONS
  is_active: boolean;
}

function getErrorMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return undefined;
}

interface ScreenNavigation {
  goBack: () => void;
  navigate: (screen: string, params?: Record<string, unknown>) => void;
}

interface ProductCatalogScreenProps {
  navigation: ScreenNavigation;
}

// Fallback units si l'API n'est pas disponible
const FALLBACK_UNITS = ['unit', 'pcs', 'kg', 'g', 'l', 'ml', 'box', 'pack'];

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
  packaging_type_id: null,
  units_per_package: '1',
  cost_price: '',
  package_price: '',
  detail_enabled: false,
  sell_price: '',
  alert_threshold: '5',
  is_active: true,
};

export default function ProductCatalogScreen({ navigation }: ProductCatalogScreenProps) {
  const { shopId } = useCurrentUser();
  const { can } = usePermissions();
  const canCreateProduct = can('products', 'create');
  const canEditProduct = can('products', 'edit');
  const canDeleteProduct = can('products', 'delete');
  const [activeTab, setActiveTab] = useState<'articles' | 'catalogue'>('articles');
  const [products, setProducts] = useState<Product[]>([]);
  // Mirror the current product count in a ref so loadData can read it without
  // listing `products` as a dependency (which would recreate loadData on every
  // data change and trigger a re-fetch loop).
  const productsCountRef = useRef(0);
  useEffect(() => {
    productsCountRef.current = products.length;
  }, [products]);
  const [filters, setFilters] = useState<Filters>({ families: [], brands: [], article_types: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtres actifs
  const [selectedFamily, setSelectedFamily] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  // Filtres maquette "Produits & prix" (onglet Articles)
  const [selectedCategory, setSelectedCategory] = useState<string>(''); // chip catégorie ('' = Tous)
  const [onlyLowStock, setOnlyLowStock] = useState(false); // carte "Alertes seuil"

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
    preview_rows: Array<{
      name?: string;
      family?: string;
      article_type?: string;
      brand?: string;
      sell_price?: number;
      [key: string]: unknown;
    }>;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importStep, setImportStep] = useState<'select' | 'preview' | 'success'>('select');

  // Types de conditionnement (unités) — pour le sélecteur d'unité (pièce)
  const [packagingTypes, setPackagingTypes] = useState<
    Array<{ id: string; name: string; symbol: string }>
  >([]);
  // Liste des types de conditionnement (Carton, Boîte, Douzaine, …) pour le sélecteur
  // CONDITIONNEMENT obligatoire du formulaire d'article.
  const [packagingList, setPackagingList] = useState<{ id: string; name: string }[]>([]);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSymbol, setNewUnitSymbol] = useState('');

  // Charger les types de conditionnement (fallback local)
  const loadPackagingTypes = () => {
    setPackagingTypes(FALLBACK_UNITS.map((u, i) => ({ id: String(i), name: u, symbol: u })));
  };

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      const where: Record<string, unknown> = { is_active: 1 };
      if (selectedFamily) where.family = selectedFamily;
      if (selectedBrand) where.brand = selectedBrand;
      if (selectedType) where.article_type = selectedType;

      let localProducts;
      if (searchQuery) {
        localProducts = await productRepo.search(shopId, searchQuery);
      } else {
        localProducts = await productRepo.getAll(shopId, { where, orderBy: 'name ASC' });
      }

      // Enrich with stock data
      const enriched: Product[] = await Promise.all(
        localProducts.map(async (p): Promise<Product> => {
          const totalStock = await stockBatchRepo.getTotalStock(shopId, p.id);
          return {
            id: p.id,
            sku: p.sku,
            barcode: p.barcode ?? undefined,
            name: p.name,
            description: p.description ?? undefined,
            family: p.family ?? undefined,
            article_type: p.article_type ?? undefined,
            brand: p.brand ?? undefined,
            reference: p.reference ?? undefined,
            unit: p.unit,
            cost_price: p.cost_price,
            sell_price: p.sell_price,
            is_active: p.is_active === 1,
            alert_threshold: p.alert_threshold,
            current_stock: totalStock,
            is_low_stock: totalStock <= p.alert_threshold,
            packaging_type_id: p.packaging_type_id,
            units_per_package: p.units_per_package,
            package_price: p.package_price,
          };
        })
      );
      setProducts(enriched);

      // Compute filters locally from ALL products (not just filtered ones)
      const allProducts = await productRepo.getAll(shopId, {
        where: { is_active: 1 },
        orderBy: 'name ASC',
      });
      const families = [...new Set(allProducts.map(p => p.family).filter(Boolean))] as string[];
      const brands = [...new Set(allProducts.map(p => p.brand).filter(Boolean))] as string[];
      const article_types = [
        ...new Set(allProducts.map(p => p.article_type).filter(Boolean)),
      ] as string[];
      setFilters({ families, brands, article_types });
    } catch (error: unknown) {
      if (productsCountRef.current === 0) {
        Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de charger les produits');
      }
    } finally {
      setIsLoading(false);
    }
  }, [shopId, searchQuery, selectedFamily, selectedBrand, selectedType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadPackagingTypes();
  }, []);

  // Charger TOUS les types de conditionnement de la boutique (Carton, Boîte, Douzaine, …)
  // pour le sélecteur CONDITIONNEMENT obligatoire du formulaire d'article.
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      try {
        const pkgList = await packagingTypeRepo.getAll(shopId, { orderBy: 'name ASC' });
        if (!cancelled) setPackagingList(pkgList.map(p => ({ id: p.id, name: p.name })));
      } catch {
        // silencieux : le sélecteur reste masqué si aucun type n'est disponible
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  // AUTO-ADAPT : dès que le prix de gros (carton) ou l'UPP change, si le prix de détail
  // saisi passe sous le plancher ceil(gros/UPP), on le remonte automatiquement au plancher
  // (live). On ne le baisse jamais : le détail peut être supérieur au plancher.
  useEffect(() => {
    if (!formData.detail_enabled) return;
    const pkg = parseInt(formData.package_price, 10);
    const u = parseInt(formData.units_per_package, 10);
    if (isNaN(pkg) || pkg <= 0 || isNaN(u) || u <= 1) return;
    const floor = Math.ceil(pkg / u);
    const cur = parseInt(formData.sell_price, 10);
    if (isNaN(cur) || cur < floor) {
      setFormData(prev => ({ ...prev, sell_price: String(floor) }));
    }
  }, [
    formData.package_price,
    formData.units_per_package,
    formData.detail_enabled,
    formData.sell_price,
  ]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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

  // Ouvrir le modal pour ajouter — conditionnement obligatoire pré-sélectionné (1er type).
  const openAddModal = () => {
    setFormData({ ...DEFAULT_FORM, packaging_type_id: packagingList[0]?.id ?? null });
    setIsEditing(false);
    setShowProductModal(true);
  };

  // Ouvrir le modal pour modifier — le coût stocké est PAR PIÈCE : on le ré-affiche AU CARTON
  // (coût/pièce × UPP) ; le sous-conditionnement (détail) est actif si un prix de détail existe.
  const openEditModal = (product: Product) => {
    const uppReal =
      product.units_per_package && product.units_per_package > 0 ? product.units_per_package : 1;
    const hasDetail = uppReal > 1 && product.sell_price > 0;
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
      packaging_type_id: product.packaging_type_id ?? packagingList[0]?.id ?? null,
      units_per_package: String(uppReal),
      cost_price: String(product.cost_price * uppReal),
      package_price: product.package_price ? String(product.package_price) : '',
      detail_enabled: hasDetail,
      sell_price: product.sell_price > 0 ? String(product.sell_price) : '',
      alert_threshold: String(product.alert_threshold),
      is_active: product.is_active,
    });
    setIsEditing(true);
    setShowProductModal(true);
  };

  // Sauvegarder le produit (offline-first)
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
    if (!shopId) {
      Alert.alert('Erreur', 'Boutique introuvable');
      return;
    }

    // ===== Modèle carton-primary (mêmes règles que « Modifier l'article ») =====
    // - Prix de revient saisi AU CARTON → stocké PAR PIÈCE (round(coût_carton / UPP)).
    // - package_price = prix de vente au CARTON (gros), obligatoire.
    // - sell_price = prix de DÉTAIL (pièce), clampé au plancher ceil(gros/UPP) si sous-cond,
    //   0 si la vente au détail est désactivée (article vendu uniquement au carton).
    const costCarton = parseInt(formData.cost_price, 10);
    if (isNaN(costCarton) || costCarton < 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de revient (au carton) valide');
      return;
    }
    const unitsPerPackage = parseInt(formData.units_per_package, 10);
    if (isNaN(unitsPerPackage) || unitsPerPackage < 1) {
      Alert.alert('Erreur', 'Veuillez entrer un nombre de pièces par conditionnement (≥ 1)');
      return;
    }
    const packagePrice = parseInt(formData.package_price, 10);
    if (isNaN(packagePrice) || packagePrice <= 0) {
      Alert.alert('Erreur', 'Veuillez entrer un prix de vente au carton (gros) valide');
      return;
    }
    if (packagingList.length > 0 && !formData.packaging_type_id) {
      Alert.alert('Erreur', 'Veuillez choisir un type de conditionnement');
      return;
    }
    const threshold = parseInt(formData.alert_threshold, 10);
    if (isNaN(threshold) || threshold < 0) {
      Alert.alert('Erreur', "Veuillez entrer un seuil d'alerte (en cartons) valide");
      return;
    }

    // Vente au détail seulement possible avec un sous-conditionnement (UPP > 1).
    const detailOn = formData.detail_enabled && unitsPerPackage > 1;
    let sellPiece = 0;
    if (detailOn) {
      const floor = Math.ceil(packagePrice / unitsPerPackage);
      const raw = parseInt(formData.sell_price, 10);
      sellPiece = isNaN(raw) || raw < floor ? floor : raw; // clamp au plancher
    }
    // Coût saisi AU CARTON → stocké PAR PIÈCE.
    const costPerPiece = Math.round(costCarton / unitsPerPackage);

    setIsSaving(true);
    try {
      if (isEditing && formData.id) {
        await updateProductOffline(formData.id, {
          shopId: shopId,
          name: formData.name.trim(),
          sku: formData.sku.trim(),
          barcode: formData.barcode?.trim() || undefined,
          description: formData.description?.trim() || undefined,
          family: formData.family.trim(),
          articleType: formData.article_type?.trim() || undefined,
          brand: formData.brand?.trim() || undefined,
          reference: formData.reference?.trim() || undefined,
          unit: formData.unit,
          packagingTypeId: formData.packaging_type_id,
          unitsPerPackage,
          packagePrice,
          costPrice: costPerPiece,
          sellPrice: sellPiece,
          alertThreshold: threshold,
        });
        Alert.alert('Succes', 'Article modifie avec succes');
      } else {
        await createProductOffline({
          shopId: shopId,
          name: formData.name.trim(),
          sku: formData.sku.trim(),
          barcode: formData.barcode?.trim() || undefined,
          description: formData.description?.trim() || undefined,
          family: formData.family.trim(),
          articleType: formData.article_type?.trim() || undefined,
          brand: formData.brand?.trim() || undefined,
          reference: formData.reference?.trim() || undefined,
          unit: formData.unit,
          packagingTypeId: formData.packaging_type_id,
          unitsPerPackage,
          packagePrice,
          costPrice: costPerPiece,
          sellPrice: sellPiece,
          alertThreshold: threshold,
        });
        Alert.alert('Succes', 'Article ajoute avec succes');
      }

      setShowProductModal(false);
      setFormData(DEFAULT_FORM);
      loadData();
    } catch (error: unknown) {
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de sauvegarder');
    } finally {
      setIsSaving(false);
    }
  };

  // Supprimer un produit (offline-first)
  const deleteProduct = (product: Product) => {
    Alert.alert('Supprimer', `Voulez-vous vraiment supprimer "${product.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProductOffline(product.id);
            Alert.alert('Succes', 'Article supprime');
            loadData();
          } catch (error: unknown) {
            Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  // Menu d'actions (modifier / supprimer) — accessible par appui long sur un article.
  // Conserve le gating des permissions de la maquette précédente.
  const openProductActions = (product: Product) => {
    if (!canEditProduct && !canDeleteProduct) return;
    const buttons: Array<{ text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }> =
      [];
    if (canEditProduct) {
      buttons.push({ text: 'Modifier', onPress: () => openEditModal(product) });
    }
    if (canDeleteProduct) {
      buttons.push({
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => deleteProduct(product),
      });
    }
    buttons.push({ text: 'Annuler', style: 'cancel' });
    Alert.alert(product.name, undefined, buttons);
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

  // Save hierarchy edit using local batch update (offline-first)
  const saveHierarchyEdit = async () => {
    if (!hierarchyEditType || !hierarchyEditNewValue.trim() || !shopId) {
      Alert.alert('Erreur', 'Veuillez entrer une valeur');
      return;
    }

    if (hierarchyEditNewValue.trim() === hierarchyEditOldValue) {
      setShowHierarchyEditModal(false);
      return;
    }

    setIsHierarchySaving(true);
    try {
      // Get all products to find matching ones
      const allProducts = await productRepo.getAll(shopId, { orderBy: 'name ASC' });
      let matchingProducts = allProducts;

      // Filter based on context
      if (hierarchyEditContext.family) {
        matchingProducts = matchingProducts.filter(p => p.family === hierarchyEditContext.family);
      }
      if (hierarchyEditContext.article_type) {
        matchingProducts = matchingProducts.filter(
          p => p.article_type === hierarchyEditContext.article_type
        );
      }
      if (hierarchyEditContext.brand) {
        matchingProducts = matchingProducts.filter(p => p.brand === hierarchyEditContext.brand);
      }

      // Filter by old value
      matchingProducts = matchingProducts.filter(p => {
        if (hierarchyEditType === 'family') return p.family === hierarchyEditOldValue;
        if (hierarchyEditType === 'article_type') return p.article_type === hierarchyEditOldValue;
        if (hierarchyEditType === 'brand') return p.brand === hierarchyEditOldValue;
        if (hierarchyEditType === 'reference') return p.reference === hierarchyEditOldValue;
        return false;
      });

      // Update each matching product
      const newValue = hierarchyEditNewValue.trim();
      const updateData: Partial<OfflineProductInput> = {};
      if (hierarchyEditType === 'family') updateData.family = newValue;
      else if (hierarchyEditType === 'article_type') updateData.articleType = newValue;
      else if (hierarchyEditType === 'brand') updateData.brand = newValue;
      else updateData.reference = newValue;
      for (const p of matchingProducts) {
        await updateProductOffline(p.id, updateData);
      }

      Alert.alert('Succes', `${matchingProducts.length} produit(s) mis a jour`);
      setShowHierarchyEditModal(false);
      loadData();
    } catch (error: unknown) {
      console.error('Erreur lors de la mise a jour:', error);
      Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de mettre a jour');
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
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setIsImporting(false);
        return;
      }

      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const content = await response.text();

      const preview = await importApi.previewCatalog<{
        valid_count: number;
        invalid_count: number;
        errors: Array<{ row: number; field: string; message: string }>;
        preview_rows: Array<{
          name?: string;
          family?: string;
          article_type?: string;
          brand?: string;
          sell_price?: number;
          [key: string]: unknown;
        }>;
      }>(content, asset.name);

      setImportFile({ name: asset.name, content });
      setImportPreview(preview);
      setImportStep('preview');
    } catch (error: unknown) {
      Alert.alert(
        'Erreur',
        getErrorMessage(error) ??
          'Impossible de lire le fichier. Verifiez votre connexion internet.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!importFile) return;
    try {
      setIsImporting(true);
      await importApi.confirmCatalog(importFile.content, importFile.name);
      setImportStep('success');
      Alert.alert('Import reussi', 'Le catalogue a ete mis a jour avec succes.');
      closeImportModal();
      loadData();
    } catch (error: unknown) {
      Alert.alert(
        'Erreur',
        getErrorMessage(error) ??
          "Impossible d'importer le catalogue. Verifiez votre connexion internet."
      );
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

  // Rendu de l'onglet Articles — maquette "Produits & prix"
  const renderArticlesTab = () => {
    // Valorisation globale (réutilise les données déjà chargées)
    const totalStockValue = products.reduce((sum, p) => sum + p.current_stock * p.cost_price, 0);
    const lowStockCount = products.filter(p => p.is_low_stock).length;

    // Catégories (basées sur la famille) pour les chips
    const categories = [...new Set(products.map(p => p.family).filter(Boolean))] as string[];

    // Application des filtres maquette (chip catégorie + alertes seuil)
    const visibleProducts = products.filter(p => {
      if (onlyLowStock && !p.is_low_stock) return false;
      if (selectedCategory && (p.family || 'Autres') !== selectedCategory) return false;
      return true;
    });

    // Regroupement par catégorie (famille)
    const grouped = new Map<string, Product[]>();
    for (const p of visibleProducts) {
      const key = p.family || 'Autres';
      const arr = grouped.get(key);
      if (arr) arr.push(p);
      else grouped.set(key, [p]);
    }
    const sections = Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, data]) => ({ title, data }));

    const renderProduct = ({ item }: { item: Product }) => {
      const stockColor = item.is_low_stock ? Colors.warning.main : Colors.success.main;
      // Modèle carton-primary : on affiche le prix de DÉTAIL (pièce) si le sous-conditionnement
      // est actif (UPP > 1 ET sell_price > 0), sinon le prix de GROS (carton = package_price).
      const hasDetail = (item.units_per_package ?? 0) > 1 && item.sell_price > 0;
      const grosPrice = item.package_price ?? 0;
      const displayPrice = hasDetail
        ? item.sell_price
        : grosPrice > 0
          ? grosPrice
          : item.sell_price;
      const displayUnit = hasDetail ? '/ pièce' : grosPrice > 0 ? '/ carton' : '';
      return (
        <TouchableOpacity
          style={styles.itemCard}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ProductDetails', { id: item.id })}
          onLongPress={
            canEditProduct || canDeleteProduct ? () => openProductActions(item) : undefined
          }
        >
          <View style={styles.itemIcon}>
            <Package size={20} color={Colors.action} />
          </View>
          <View style={styles.itemBody}>
            <View style={styles.itemNameRow}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              {item.is_multi_price && (
                <View style={styles.multiBadge}>
                  <Text style={styles.multiBadgeText}>MULTI</Text>
                </View>
              )}
            </View>
            <View style={styles.itemMetaRow}>
              <View style={[styles.stockChip, { backgroundColor: stockColor + '1A' }]}>
                <Text style={[styles.stockChipText, { color: stockColor }]}>
                  {item.current_stock} {item.unit}
                </Text>
              </View>
              <Text style={styles.itemThreshold}>Seuil {item.alert_threshold}</Text>
            </View>
          </View>
          <View style={styles.itemPrices}>
            <Text style={styles.itemSellPrice}>
              {formatMoney(displayPrice)}
              {displayUnit ? <Text style={styles.itemPriceUnit}> {displayUnit}</Text> : null}
            </Text>
            <Text style={styles.itemCostPrice}>PR {formatMoney(item.cost_price)}</Text>
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <>
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderProduct}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryHeaderTitle}>{section.title.toUpperCase()}</Text>
              <View style={styles.categoryHeaderCount}>
                <Text style={styles.categoryHeaderCountText}>{section.data.length}</Text>
              </View>
            </View>
          )}
          ListHeaderComponent={
            <View>
              {/* HERO valorisation + carte alertes */}
              <View style={styles.heroRow}>
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>Valeur du stock</Text>
                  <Text style={styles.heroAmount}>{formatMoney(totalStockValue)}</Text>
                  <Text style={styles.heroSub}>
                    {products.length} référence{products.length > 1 ? 's' : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.alertCard, onlyLowStock && styles.alertCardActive]}
                  onPress={() => setOnlyLowStock(v => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.alertCount}>{lowStockCount}</Text>
                  <View style={styles.alertLabelRow}>
                    <AlertTriangle size={12} color={Colors.warning.main} />
                    <Text style={styles.alertLabel}>Alertes seuil</Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Recherche */}
              <View style={styles.searchBarV2}>
                <Search size={20} color={Colors.muted.foreground} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un article…"
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

              {/* Chips de catégories */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsRow}
              >
                <TouchableOpacity
                  style={[styles.chip, !selectedCategory && styles.chipActive]}
                  onPress={() => setSelectedCategory('')}
                >
                  <Text style={[styles.chipText, !selectedCategory && styles.chipTextActive]}>
                    Tous
                  </Text>
                </TouchableOpacity>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                    onPress={() => setSelectedCategory(prev => (prev === cat ? '' : cat))}
                  >
                    <Text
                      style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Actions secondaires (import + filtres avancés) */}
              <View style={styles.toolbarRow}>
                {isLoading && <ActivityIndicator size="small" color={Colors.action} />}
                <View style={styles.toolbarSpacer} />
                <TouchableOpacity
                  style={[
                    styles.toolbarButton,
                    activeFiltersCount > 0 && styles.toolbarButtonActive,
                  ]}
                  onPress={() => setShowFiltersModal(true)}
                >
                  <Filter
                    size={16}
                    color={activeFiltersCount > 0 ? Colors.primary.foreground : Colors.action}
                  />
                  <Text
                    style={[
                      styles.toolbarButtonText,
                      activeFiltersCount > 0 && styles.toolbarButtonTextActive,
                    ]}
                  >
                    Filtres{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                  </Text>
                </TouchableOpacity>
                {canCreateProduct && (
                  <TouchableOpacity style={styles.importButton} onPress={openImportModal}>
                    <Upload size={16} color={Colors.action} />
                    <Text style={styles.importButtonText}>Importer</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Package size={48} color={Colors.muted.foreground} />
              <Text style={styles.emptyText}>Aucun article trouvé</Text>
              <Text style={styles.emptySubtext}>
                {searchQuery || activeFiltersCount > 0 || selectedCategory || onlyLowStock
                  ? 'Essayez de modifier vos critères de recherche'
                  : 'Ajoutez des articles à votre catalogue'}
              </Text>
            </View>
          }
        />

        {/* Bouton flottant ajouter */}
        {canCreateProduct && (
          <TouchableOpacity style={styles.fab} onPress={openAddModal}>
            <Plus size={24} color={Colors.primary.foreground} />
          </TouchableOpacity>
        )}
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
                  <Edit size={14} color={Colors.action} />
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
                      <Edit size={10} color={Colors.action} />
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
            {familyProducts.map(product => {
              const reference = product.reference;
              return (
                <View key={product.id} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 1.5 }]} numberOfLines={2}>
                    {product.article_type || product.name}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                    {product.brand || '-'}
                  </Text>
                  {reference ? (
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                      onPress={() =>
                        openHierarchyEditModal('reference', reference, {
                          family,
                          article_type: product.article_type,
                          brand: product.brand,
                        })
                      }
                    >
                      <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                        {product.reference}
                      </Text>
                      <Edit size={10} color={Colors.action} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.tableCell, { flex: 1 }]} numberOfLines={1}>
                      -
                    </Text>
                  )}
                </View>
              );
            })}
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
        <ScreenHeader
          title="Produits & prix"
          subtitle="Catalogue & valorisation"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.action} />
        </View>
      </SafeAreaView>
    );
  }

  // Valeurs dérivées (live) du formulaire d'article (modèle carton-primary). Le prix de revient
  // est saisi AU CARTON ; on le ramène au coût/pièce pour la marge détail. Le plancher de
  // détail = ceil(gros/UPP).
  const formUnits = parseInt(formData.units_per_package, 10);
  const formUnitsValid = !isNaN(formUnits) && formUnits >= 1;
  const formDetailPossible = formUnitsValid && formUnits > 1;
  const formCostCartonNum = parseInt(formData.cost_price, 10);
  const formPackagePriceNum = parseInt(formData.package_price, 10);
  const formSellNum = parseInt(formData.sell_price, 10);
  const formGrosMarginPct =
    !isNaN(formPackagePriceNum) && formPackagePriceNum > 0 && !isNaN(formCostCartonNum)
      ? Math.round(((formPackagePriceNum - formCostCartonNum) / formPackagePriceNum) * 100)
      : 0;
  const formDetailFloor =
    formDetailPossible && !isNaN(formPackagePriceNum) && formPackagePriceNum > 0
      ? Math.ceil(formPackagePriceNum / formUnits)
      : 0;
  const formCostPerPiece =
    formUnitsValid && !isNaN(formCostCartonNum) ? Math.round(formCostCartonNum / formUnits) : 0;
  const formDetailMarginPct =
    !isNaN(formSellNum) && formSellNum > 0
      ? Math.round(((formSellNum - formCostPerPiece) / formSellNum) * 100)
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Produits & prix"
        subtitle="Catalogue & valorisation"
        showBack
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity
            onPress={() => navigation.navigate('CatalogHierarchy')}
            style={styles.hierarchyButton}
          >
            <Package size={20} color={Colors.action} />
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

                {/* ===== CONDITIONNEMENT (obligatoire) ===== */}
                <Text style={styles.editSectionTitle}>CONDITIONNEMENT</Text>

                {/* Type de conditionnement (Carton, Boîte, Douzaine, …) */}
                {packagingList.length > 0 && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Type de conditionnement</Text>
                    <View style={styles.pkgChipRow}>
                      {packagingList.map(pkg => (
                        <TouchableOpacity
                          key={pkg.id}
                          style={[
                            styles.pkgChip,
                            formData.packaging_type_id === pkg.id && styles.pkgChipActive,
                          ]}
                          onPress={() =>
                            setFormData(prev => ({ ...prev, packaging_type_id: pkg.id }))
                          }
                        >
                          <Text
                            style={[
                              styles.pkgChipText,
                              formData.packaging_type_id === pkg.id && styles.pkgChipTextActive,
                            ]}
                          >
                            {pkg.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* Pièces par conditionnement (UPP) + Prix de revient AU CARTON + Unité (pièce) */}
                <View style={styles.formRow}>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Pièces / conditionnement</Text>
                    <View style={styles.inputSuffixWrap}>
                      <TextInput
                        style={styles.inputSuffix}
                        value={formData.units_per_package}
                        onChangeText={text =>
                          setFormData(prev => ({
                            ...prev,
                            units_per_package: text.replace(/[^0-9]/g, ''),
                          }))
                        }
                        placeholder="24"
                        placeholderTextColor={Colors.muted.foreground}
                        keyboardType="numeric"
                      />
                      <TouchableOpacity
                        style={styles.unitSuffixButton}
                        onPress={() => setShowUnitPicker(true)}
                      >
                        <Text style={styles.inputSuffixText}>{formData.unit || 'pièce'}</Text>
                        <ChevronDown size={14} color={Colors.muted.foreground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.formGroup, { flex: 1 }]}>
                    <Text style={styles.formLabel}>Prix de revient (carton)</Text>
                    <View style={styles.inputSuffixWrap}>
                      <TextInput
                        style={styles.inputSuffix}
                        value={formData.cost_price}
                        onChangeText={text =>
                          setFormData(prev => ({
                            ...prev,
                            cost_price: text.replace(/[^0-9]/g, ''),
                          }))
                        }
                        placeholder="0"
                        placeholderTextColor={Colors.muted.foreground}
                        keyboardType="numeric"
                      />
                      <Text style={styles.inputSuffixText}>F</Text>
                    </View>
                  </View>
                </View>

                {/* Prix de vente au carton (gros) */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Prix de vente (carton · gros)</Text>
                  <View style={styles.inputSuffixWrap}>
                    <TextInput
                      style={styles.inputSuffix}
                      value={formData.package_price}
                      onChangeText={text =>
                        setFormData(prev => ({
                          ...prev,
                          package_price: text.replace(/[^0-9]/g, ''),
                        }))
                      }
                      placeholder="0"
                      placeholderTextColor={Colors.muted.foreground}
                      keyboardType="numeric"
                    />
                    <Text style={styles.inputSuffixText}>F</Text>
                  </View>
                  <View style={styles.marginRow}>
                    <TrendingUp size={16} color={Colors.info.text} />
                    <Text style={styles.marginRowLabel}>Marge gros (carton)</Text>
                    <Text style={styles.marginRowValue}>{formGrosMarginPct} %</Text>
                  </View>
                </View>

                {/* ===== SOUS-CONDITIONNEMENT (optionnel) ===== */}
                <Text style={styles.editSectionTitle}>SOUS-CONDITIONNEMENT</Text>

                <View style={styles.toggleRow}>
                  <View style={styles.toggleTextWrap}>
                    <Text style={styles.toggleTitle}>Vendre aussi au détail (pièce)</Text>
                    <Text style={styles.toggleSubtitle}>
                      {formDetailPossible
                        ? 'Active la vente à la pièce en plus du carton'
                        : 'Nécessite plus d’1 pièce par conditionnement'}
                    </Text>
                  </View>
                  <Switch
                    value={formData.detail_enabled && formDetailPossible}
                    onValueChange={value =>
                      setFormData(prev => ({ ...prev, detail_enabled: value }))
                    }
                    disabled={!formDetailPossible}
                    trackColor={{ false: Colors.muted.main, true: Colors.action }}
                    thumbColor={Colors.surface}
                    ios_backgroundColor={Colors.muted.main}
                  />
                </View>

                {formData.detail_enabled && formDetailPossible && (
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Prix de détail (pièce)</Text>
                    <View style={styles.inputSuffixWrap}>
                      <TextInput
                        style={styles.inputSuffix}
                        value={formData.sell_price}
                        onChangeText={text =>
                          setFormData(prev => ({
                            ...prev,
                            sell_price: text.replace(/[^0-9]/g, ''),
                          }))
                        }
                        placeholder="0"
                        placeholderTextColor={Colors.muted.foreground}
                        keyboardType="numeric"
                      />
                      <Text style={styles.inputSuffixText}>F</Text>
                    </View>
                    <Text style={styles.adjustHint}>
                      min {formatMoney(formDetailFloor)} / pièce (= prix de gros ÷ quantité)
                    </Text>
                    <View style={styles.marginRow}>
                      <TrendingUp size={16} color={Colors.info.text} />
                      <Text style={styles.marginRowLabel}>Marge détail (pièce)</Text>
                      <Text style={styles.marginRowValue}>{formDetailMarginPct} %</Text>
                    </View>
                  </View>
                )}

                {/* ===== SEUIL D'ALERTE (en cartons) ===== */}
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Seuil d'alerte (cartons)</Text>
                  <View style={styles.inputSuffixWrap}>
                    <TextInput
                      style={styles.inputSuffix}
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
                    <Text style={styles.inputSuffixText}>cartons</Text>
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
                    <FileSpreadsheet size={64} color={Colors.action} />
                  </View>
                  <Text style={styles.importTitle}>Sélectionnez un fichier</Text>
                  <Text style={styles.importSubtitle}>
                    Formats acceptés: CSV, Excel (.xls, .xlsx)
                  </Text>
                  <Text style={styles.importHint}>
                    Colonnes requises: Code Article, Libellé Article{'\n'}
                    Colonnes optionnelles: Famille, Article, Marque, Référence, Prix achat, Prix
                    vente
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
                      <FileSpreadsheet size={20} color={Colors.action} />
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

      {/* Unit Picker Modal */}
      <Modal
        visible={showUnitPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowUnitPicker(false);
          setShowNewUnitInput(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '60%' }]}>
            <Text style={styles.modalTitle}>Choisir l'unité</Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {packagingTypes.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.unitPickerOption,
                    formData.unit === type.name && styles.unitPickerOptionActive,
                  ]}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, unit: type.name }));
                    setShowUnitPicker(false);
                    setShowNewUnitInput(false);
                  }}
                >
                  <Text
                    style={[
                      styles.unitPickerOptionText,
                      formData.unit === type.name && styles.unitPickerOptionTextActive,
                    ]}
                  >
                    {type.name}
                  </Text>
                  <Text style={styles.unitPickerOptionSymbol}>({type.symbol})</Text>
                  {formData.unit === type.name && <Check size={18} color={Colors.action} />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Bouton créer nouveau type */}
            {!showNewUnitInput ? (
              <TouchableOpacity
                style={styles.addUnitButton}
                onPress={() => setShowNewUnitInput(true)}
              >
                <Plus size={16} color={Colors.action} />
                <Text style={styles.addUnitButtonText}>Ajouter une unité</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.newUnitForm}>
                <TextInput
                  style={[styles.input, { marginBottom: Spacing.sm }]}
                  placeholder="Nom (ex: Sachet)"
                  placeholderTextColor={Colors.muted.foreground}
                  value={newUnitName}
                  onChangeText={setNewUnitName}
                  autoFocus
                />
                <TextInput
                  style={[styles.input, { marginBottom: Spacing.sm }]}
                  placeholder="Symbole (ex: sac)"
                  placeholderTextColor={Colors.muted.foreground}
                  value={newUnitSymbol}
                  onChangeText={setNewUnitSymbol}
                />
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <TouchableOpacity
                    style={[styles.modalCancelButton, { flex: 1 }]}
                    onPress={() => {
                      setShowNewUnitInput(false);
                      setNewUnitName('');
                      setNewUnitSymbol('');
                    }}
                  >
                    <Text style={styles.modalCancelButtonText}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSaveButton, { flex: 1 }]}
                    onPress={() => {
                      if (!newUnitName.trim()) {
                        Alert.alert('Erreur', "Le nom de l'unite est requis");
                        return;
                      }
                      const symbol =
                        newUnitSymbol.trim() || newUnitName.trim().toLowerCase().substring(0, 3);
                      setPackagingTypes(prev => [
                        ...prev,
                        { id: String(prev.length), name: newUnitName.trim(), symbol },
                      ]);
                      setFormData(prev => ({ ...prev, unit: newUnitName.trim() }));
                      setShowNewUnitInput(false);
                      setNewUnitName('');
                      setNewUnitSymbol('');
                      setShowUnitPicker(false);
                    }}
                  >
                    <Text style={styles.modalSaveButtonText}>Créer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalCancelButton, { marginTop: Spacing.md }]}
              onPress={() => {
                setShowUnitPicker(false);
                setShowNewUnitInput(false);
              }}
            >
              <Text style={styles.modalCancelButtonText}>Fermer</Text>
            </TouchableOpacity>
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
    borderBottomColor: Colors.action,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.muted.foreground,
  },
  tabTextActive: {
    color: Colors.action,
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
    borderRadius: 10,
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
    borderRadius: 10,
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
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
    color: Colors.surface,
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
    color: Colors.action,
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
    color: Colors.action,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: 100,
  },
  // ===== Maquette "Produits & prix" (onglet Articles) =====
  heroRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  heroCard: {
    flex: 2,
    backgroundColor: Colors.primary[900],
    borderRadius: 18,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  heroAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.onMarine,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  alertCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  alertCardActive: {
    borderColor: Colors.warning.main,
    backgroundColor: Colors.warning.background,
  },
  alertCount: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.warning.main,
    fontVariant: ['tabular-nums'],
  },
  alertLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.warning.text,
  },
  searchBarV2: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  chipsRow: {
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  chipTextActive: {
    color: Colors.primary.foreground,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  toolbarSpacer: {
    flex: 1,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary[50],
    borderRadius: 8,
  },
  toolbarButtonActive: {
    backgroundColor: Colors.action,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.action,
  },
  toolbarButtonTextActive: {
    color: Colors.primary.foreground,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  categoryHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.5,
  },
  categoryHeaderCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: Colors.muted.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryHeaderCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textColors.secondary,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: {
    flex: 1,
    gap: 4,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  itemName: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  multiBadge: {
    backgroundColor: Colors.action + '1A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  multiBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: Colors.action,
    letterSpacing: 0.5,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  stockChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockChipText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  itemThreshold: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    fontWeight: '500',
  },
  itemPrices: {
    alignItems: 'flex-end',
  },
  itemSellPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    fontVariant: ['tabular-nums'],
  },
  itemPriceUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  itemCostPrice: {
    fontSize: 11.5,
    color: Colors.textColors.tertiary,
    fontWeight: '600',
    marginTop: 1,
  },
  productCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    ...Shadows.sm,
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
    color: Colors.action,
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
    color: Colors.action,
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
  productPriceRange: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.warning.main,
  },
  multiPriceTag: {
    backgroundColor: Colors.warning.main + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-end',
  },
  multiPriceTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.warning.main,
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
    color: Colors.action,
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
    backgroundColor: Colors.action,
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
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    ...Shadows.sm,
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
    color: Colors.action,
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
    backgroundColor: Colors.action,
    borderColor: Colors.action,
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
    backgroundColor: Colors.action,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
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
    backgroundColor: Colors.action,
    borderRadius: 12,
    padding: Spacing.lg,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
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
    color: Colors.action,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
  inputDisabled: {
    backgroundColor: Colors.muted.main,
    color: Colors.muted.foreground,
  },
  // ===== Formulaire carton-primary (conditionnement + sous-conditionnement) =====
  editSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textColors.tertiary,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  pkgChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pkgChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pkgChipActive: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  pkgChipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  pkgChipTextActive: {
    color: '#FFFFFF',
  },
  inputSuffixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
  },
  inputSuffix: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: 15,
    color: Colors.text,
  },
  inputSuffixText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
    marginLeft: Spacing.sm,
  },
  unitSuffixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  marginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    backgroundColor: Colors.info.background,
  },
  marginRowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.info.text,
  },
  marginRowValue: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.info.text,
    fontVariant: ['tabular-nums'],
  },
  adjustHint: {
    fontSize: 12.5,
    color: Colors.textColors.tertiary,
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  unitPickerText: {
    fontSize: 15,
    color: Colors.text,
  },
  unitPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  unitPickerOptionActive: {
    backgroundColor: Colors.primary[50],
  },
  unitPickerOptionText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  unitPickerOptionTextActive: {
    fontWeight: '600',
    color: Colors.action,
  },
  unitPickerOptionSymbol: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  addUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.action,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addUnitButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.action,
  },
  newUnitForm: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: 12,
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
    color: Colors.action,
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
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.action,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: 12,
    minHeight: 48,
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
    color: Colors.action,
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
    color: Colors.text,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
});
