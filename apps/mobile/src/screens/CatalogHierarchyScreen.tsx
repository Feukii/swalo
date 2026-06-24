import React, { useState, useCallback } from 'react';
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
import {
  Package,
  Plus,
  Edit,
  Trash,
  ChevronDown,
  ChevronRight,
  X,
} from '../components/icons/SimpleIcons';
import { ScreenHeader } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatCurrency } from '../utils/currency';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { productRepo, stockBatchRepo, LocalProduct } from '../db/repositories';
import {
  createProductOffline,
  updateProductOffline,
  deleteProductOffline,
} from '../db/offlineWrite';

interface Product {
  id: string;
  sku: string;
  name: string;
  family?: string;
  article_type?: string;
  brand?: string;
  reference?: string;
  current_stock: number;
  sell_price: number;
}

interface CatalogNode {
  family: string;
  articles: {
    [articleType: string]: {
      brands: {
        [brand: string]: {
          references: Product[];
        };
      };
    };
  };
}

function getErrorMessage(e: unknown): string | undefined {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return undefined;
}

interface ScreenNavigation {
  goBack: () => void;
}

interface CatalogHierarchyScreenProps {
  navigation: ScreenNavigation;
}

type ModalType = 'family' | 'article' | 'brand' | 'reference' | null;

interface FormData {
  id?: string;
  family?: string;
  article_type?: string;
  brand?: string;
  reference?: string;
  name?: string;
}

export default function CatalogHierarchyScreen({ navigation }: CatalogHierarchyScreenProps) {
  const { shopId } = useCurrentUser();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(new Set());
  const [expandedBrands, setExpandedBrands] = useState<Set<string>>(new Set());

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [formData, setFormData] = useState<FormData>({});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setIsLoading(true);
    try {
      console.log('Loading catalog hierarchy from local DB...');
      const localProducts = await productRepo.getAll(shopId, { orderBy: 'name ASC' });

      // Enrich with stock data computed from stock batches
      const enriched: Product[] = await Promise.all(
        localProducts.map(async (p: LocalProduct) => {
          const totalStock = await stockBatchRepo.getTotalStock(shopId, p.id);
          return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            family: p.family ?? undefined,
            article_type: p.article_type ?? undefined,
            brand: p.brand ?? undefined,
            reference: p.reference ?? undefined,
            current_stock: totalStock,
            sell_price: p.sell_price,
          };
        })
      );

      setProducts(enriched);
      console.log('Catalog loaded from local DB:', enriched.length, 'products');
    } catch (error: unknown) {
      console.error('Error loading catalog:', error);
      Alert.alert('Erreur', 'Impossible de charger le catalogue');
    } finally {
      setIsLoading(false);
    }
  }, [shopId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Construire la hiérarchie
  const buildHierarchy = (): CatalogNode[] => {
    const hierarchy: { [family: string]: CatalogNode } = {};

    products.forEach(product => {
      const family = product.family || 'Autres';
      const articleType = product.article_type || 'Non classé';
      const brand = product.brand || 'Sans marque';

      if (!hierarchy[family]) {
        hierarchy[family] = { family, articles: {} };
      }

      if (!hierarchy[family].articles[articleType]) {
        hierarchy[family].articles[articleType] = { brands: {} };
      }

      if (!hierarchy[family].articles[articleType].brands[brand]) {
        hierarchy[family].articles[articleType].brands[brand] = { references: [] };
      }

      hierarchy[family].articles[articleType].brands[brand].references.push(product);
    });

    return Object.values(hierarchy);
  };

  const toggleFamily = (family: string) => {
    const newSet = new Set(expandedFamilies);
    if (newSet.has(family)) {
      newSet.delete(family);
    } else {
      newSet.add(family);
    }
    setExpandedFamilies(newSet);
  };

  const toggleArticle = (key: string) => {
    const newSet = new Set(expandedArticles);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedArticles(newSet);
  };

  const toggleBrand = (key: string) => {
    const newSet = new Set(expandedBrands);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedBrands(newSet);
  };

  // Ouvrir modal pour ajouter/modifier
  const openAddModal = (type: ModalType, context?: FormData) => {
    setModalType(type);
    setFormData(context || {});
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (type: ModalType, data: FormData) => {
    setModalType(type);
    setFormData(data);
    setIsEditing(true);
    setShowModal(true);
  };

  // Sauvegarder famille/article/marque/référence
  const handleSave = async () => {
    if (isSaving || !shopId) return;

    // Validation
    const value =
      modalType === 'family'
        ? formData.family
        : modalType === 'article'
          ? formData.article_type
          : modalType === 'brand'
            ? formData.brand
            : formData.reference;

    if (!value || value.trim() === '') {
      Alert.alert('Erreur', 'Veuillez remplir le champ');
      return;
    }

    setIsSaving(true);

    try {
      if (isEditing) {
        // MODE EDITION : Renommer dans tous les produits concernes
        const oldValue =
          modalType === 'family'
            ? formData.family
            : modalType === 'article'
              ? formData.article_type
              : modalType === 'brand'
                ? formData.brand
                : formData.reference;

        // Impossible de renommer si le nouveau nom existe deja
        const existingProducts = products.filter(p => {
          if (modalType === 'family') return p.family === value && p.family !== oldValue;
          if (modalType === 'article')
            return (
              p.article_type === value &&
              p.article_type !== oldValue &&
              p.family === formData.family
            );
          if (modalType === 'brand')
            return (
              p.brand === value &&
              p.brand !== oldValue &&
              p.family === formData.family &&
              p.article_type === formData.article_type
            );
          return false;
        });

        if (existingProducts.length > 0) {
          Alert.alert('Erreur', 'Ce nom existe deja');
          setIsSaving(false);
          return;
        }

        if (modalType === 'reference') {
          // For reference, update single product
          if (!formData.id) {
            Alert.alert('Erreur', 'Produit introuvable');
            setIsSaving(false);
            return;
          }
          await updateProductOffline(formData.id, { reference: value });
          Alert.alert('Succes', 'Reference mise a jour');
        } else {
          // For family, article, brand: batch update locally
          const level =
            modalType === 'family' ? 'family' : modalType === 'article' ? 'article_type' : 'brand';

          // Find all matching products to update
          const allProducts = await productRepo.getAll(shopId, { orderBy: 'name ASC' });
          const matchingProducts = allProducts.filter((p: LocalProduct) => {
            const fieldValue =
              level === 'family' ? p.family : level === 'article_type' ? p.article_type : p.brand;
            if (fieldValue !== oldValue) return false;
            // Apply hierarchy filters
            if (modalType === 'article' && formData.family && p.family !== formData.family)
              return false;
            if (modalType === 'brand') {
              if (formData.family && p.family !== formData.family) return false;
              if (formData.article_type && p.article_type !== formData.article_type) return false;
            }
            return true;
          });

          // Update each matching product offline
          for (const p of matchingProducts) {
            const updateData: Partial<{ family: string; articleType: string; brand: string }> = {};
            if (level === 'family') updateData.family = value;
            else if (level === 'article_type') updateData.articleType = value;
            else updateData.brand = value;
            await updateProductOffline(p.id, updateData);
          }

          Alert.alert('Succes', `${matchingProducts.length} produit(s) mis a jour`);
        }
      } else {
        // MODE AJOUT : Creer un produit placeholder
        if (modalType === 'reference') {
          // Pour une reference, on doit creer un vrai produit, pas un placeholder
          Alert.alert(
            'Creer un produit',
            'Pour ajouter une reference, veuillez utiliser l\'ecran "Articles" pour creer un produit complet.',
            [{ text: 'OK' }]
          );
          setIsSaving(false);
          setShowModal(false);
          return;
        }

        const placeholderData: Parameters<typeof createProductOffline>[0] = {
          shopId,
          sku: `AUTO-${Date.now()}`,
          name: `[Placeholder] ${value}`,
          unit: 'unit',
          costPrice: 0,
          sellPrice: 0,
          alertThreshold: 0,
        };

        // Ajouter les champs de contexte
        if (modalType === 'family') {
          placeholderData.family = value;
          placeholderData.articleType = 'A definir';
          placeholderData.brand = 'A definir';
          placeholderData.reference = 'A definir';
        } else if (modalType === 'article') {
          placeholderData.family = formData.family;
          placeholderData.articleType = value;
          placeholderData.brand = 'A definir';
          placeholderData.reference = 'A definir';
        } else if (modalType === 'brand') {
          placeholderData.family = formData.family;
          placeholderData.articleType = formData.article_type;
          placeholderData.brand = value;
          placeholderData.reference = 'A definir';
        }

        await createProductOffline(placeholderData);
        Alert.alert(
          'Succes',
          `${modalType === 'family' ? 'Famille' : modalType === 'article' ? 'Article' : 'Marque'} ajoute(e)`
        );
      }

      setShowModal(false);
      loadData(); // Recharger les donnees
    } catch (error: unknown) {
      console.error('Erreur lors de la sauvegarde:', error);
      const errorMessage = getErrorMessage(error) ?? 'Impossible de sauvegarder';
      Alert.alert('Erreur', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Supprimer avec verification de stock
  const handleDelete = async (product: Product) => {
    if (product.current_stock > 0) {
      Alert.alert(
        'Suppression impossible',
        `Ce produit a un stock de ${product.current_stock} unites. Vous ne pouvez pas le supprimer tant qu'il a du stock.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert('Supprimer', `Voulez-vous vraiment supprimer "${product.name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteProductOffline(product.id);
            Alert.alert('Succes', 'Produit supprime');
            loadData();
          } catch (error: unknown) {
            Alert.alert('Erreur', getErrorMessage(error) ?? 'Impossible de supprimer');
          }
        },
      },
    ]);
  };

  const renderModal = () => {
    return (
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Modifier' : 'Ajouter'}{' '}
                {modalType === 'family'
                  ? 'Famille'
                  : modalType === 'article'
                    ? 'Article'
                    : modalType === 'brand'
                      ? 'Marque'
                      : 'Référence'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Text style={styles.formLabel}>
                {modalType === 'family'
                  ? 'Nom de la famille'
                  : modalType === 'article'
                    ? "Type d'article"
                    : modalType === 'brand'
                      ? 'Nom de la marque'
                      : 'Référence / Série'}
              </Text>
              <TextInput
                style={styles.input}
                value={
                  modalType === 'family'
                    ? formData.family
                    : modalType === 'article'
                      ? formData.article_type
                      : modalType === 'brand'
                        ? formData.brand
                        : formData.reference
                }
                onChangeText={text => {
                  if (modalType === 'family') setFormData({ ...formData, family: text });
                  else if (modalType === 'article')
                    setFormData({ ...formData, article_type: text });
                  else if (modalType === 'brand') setFormData({ ...formData, brand: text });
                  else setFormData({ ...formData, reference: text });
                }}
                placeholder={`Ex: ${modalType === 'family' ? 'GLASSES' : modalType === 'article' ? 'Glass 3D' : modalType === 'brand' ? 'Samsung' : 'A10E'}`}
                placeholderTextColor={Colors.muted.foreground}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveButton, isSaving && styles.modalSaveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.modalSaveButtonText}>
                  {isSaving ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const hierarchy = buildHierarchy();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Catalogue Hiérarchique" showBack onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[900]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Catalogue Hiérarchique"
        showBack
        onBack={() => navigation.goBack()}
        rightElement={
          <TouchableOpacity onPress={() => openAddModal('family')}>
            <Plus size={24} color={Colors.primary[900]} />
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.scrollView}>
        {hierarchy.map(familyNode => (
          <View key={familyNode.family} style={styles.familyContainer}>
            {/* Famille */}
            <TouchableOpacity
              style={styles.familyHeader}
              onPress={() => toggleFamily(familyNode.family)}
            >
              <View style={styles.familyLeft}>
                {expandedFamilies.has(familyNode.family) ? (
                  <ChevronDown size={20} color={Colors.primary[900]} />
                ) : (
                  <ChevronRight size={20} color={Colors.primary[900]} />
                )}
                <Text style={styles.familyTitle}>{familyNode.family}</Text>
              </View>
              <View style={styles.familyActions}>
                <TouchableOpacity
                  onPress={() => openEditModal('family', { family: familyNode.family })}
                  style={styles.iconButton}
                >
                  <Edit size={16} color={Colors.primary[900]} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => openAddModal('article', { family: familyNode.family })}
                  style={styles.addButton}
                >
                  <Plus size={14} color={Colors.success.main} />
                  <Text style={styles.addButtonText}>Type</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>

            {/* Articles sous cette famille */}
            {expandedFamilies.has(familyNode.family) && (
              <View style={styles.articlesContainer}>
                {Object.entries(familyNode.articles).map(([articleType, articleData]) => {
                  const articleKey = `${familyNode.family}-${articleType}`;
                  return (
                    <View key={articleKey} style={styles.articleContainer}>
                      <TouchableOpacity
                        style={styles.articleHeader}
                        onPress={() => toggleArticle(articleKey)}
                      >
                        <View style={styles.articleLeft}>
                          {expandedArticles.has(articleKey) ? (
                            <ChevronDown size={18} color={Colors.text} />
                          ) : (
                            <ChevronRight size={18} color={Colors.text} />
                          )}
                          <Package size={16} color={Colors.muted.foreground} />
                          <Text style={styles.articleTitle}>{articleType}</Text>
                        </View>
                        <View style={styles.articleActions}>
                          <TouchableOpacity
                            onPress={() =>
                              openEditModal('article', {
                                family: familyNode.family,
                                article_type: articleType,
                              })
                            }
                            style={styles.iconButton}
                          >
                            <Edit size={14} color={Colors.text} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              openAddModal('brand', {
                                family: familyNode.family,
                                article_type: articleType,
                              })
                            }
                            style={styles.addButton}
                          >
                            <Plus size={12} color={Colors.success.main} />
                            <Text style={styles.addButtonText}>Marque</Text>
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>

                      {/* Marques sous cet article */}
                      {expandedArticles.has(articleKey) && (
                        <View style={styles.brandsContainer}>
                          {Object.entries(articleData.brands).map(([brand, brandData]) => {
                            const brandKey = `${articleKey}-${brand}`;
                            return (
                              <View key={brandKey} style={styles.brandContainer}>
                                <TouchableOpacity
                                  style={styles.brandHeader}
                                  onPress={() => toggleBrand(brandKey)}
                                >
                                  <View style={styles.brandLeft}>
                                    {expandedBrands.has(brandKey) ? (
                                      <ChevronDown size={16} color={Colors.text} />
                                    ) : (
                                      <ChevronRight size={16} color={Colors.text} />
                                    )}
                                    <Text style={styles.brandTitle}>{brand}</Text>
                                  </View>
                                  <View style={styles.brandActions}>
                                    <TouchableOpacity
                                      onPress={() =>
                                        openEditModal('brand', {
                                          family: familyNode.family,
                                          article_type: articleType,
                                          brand,
                                        })
                                      }
                                      style={styles.iconButton}
                                    >
                                      <Edit size={12} color={Colors.text} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                      onPress={() =>
                                        openAddModal('reference', {
                                          family: familyNode.family,
                                          article_type: articleType,
                                          brand,
                                        })
                                      }
                                      style={styles.addButtonSmall}
                                    >
                                      <Plus size={10} color={Colors.success.main} />
                                      <Text style={styles.addButtonTextSmall}>Réf</Text>
                                    </TouchableOpacity>
                                  </View>
                                </TouchableOpacity>

                                {/* Références sous cette marque */}
                                {expandedBrands.has(brandKey) && (
                                  <View style={styles.referencesContainer}>
                                    {brandData.references.map(product => (
                                      <View key={product.id} style={styles.referenceRow}>
                                        <View style={styles.referenceInfo}>
                                          <Text style={styles.referenceName}>
                                            {product.reference || product.name}
                                          </Text>
                                          <View style={styles.referenceDetails}>
                                            <Text style={styles.referenceStock}>
                                              Stock: {product.current_stock}
                                            </Text>
                                            <Text style={styles.referencePrice}>
                                              {formatCurrency(product.sell_price)}
                                            </Text>
                                          </View>
                                        </View>
                                        <View style={styles.referenceActions}>
                                          <TouchableOpacity
                                            onPress={() =>
                                              openEditModal('reference', {
                                                id: product.id,
                                                family: familyNode.family,
                                                article_type: articleType,
                                                brand,
                                                reference: product.reference || product.name,
                                              })
                                            }
                                            style={styles.iconButton}
                                          >
                                            <Edit size={12} color={Colors.text} />
                                          </TouchableOpacity>
                                          <TouchableOpacity
                                            onPress={() => handleDelete(product)}
                                            style={styles.iconButton}
                                          >
                                            <Trash
                                              size={12}
                                              color={
                                                product.current_stock > 0
                                                  ? Colors.muted.foreground
                                                  : Colors.danger.main
                                              }
                                            />
                                          </TouchableOpacity>
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}

        {hierarchy.length === 0 && (
          <View style={styles.emptyState}>
            <Package size={48} color={Colors.muted.foreground} />
            <Text style={styles.emptyText}>Aucun produit dans le catalogue</Text>
            <Text style={styles.emptyHint}>Appuyez sur le bouton + pour ajouter une famille</Text>
          </View>
        )}
      </ScrollView>

      {/* FAB - Floating Action Button pour ajouter une famille */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => openAddModal('family')}
        activeOpacity={0.8}
      >
        <Plus size={28} color={Colors.primary.foreground} />
      </TouchableOpacity>

      {renderModal()}
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
  scrollView: {
    flex: 1,
    padding: Spacing.md,
  },
  familyContainer: {
    marginBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  familyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    backgroundColor: Colors.primary[50],
  },
  familyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  familyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  familyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  articlesContainer: {
    paddingLeft: Spacing.md,
  },
  articleContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  articleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  articleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  articleActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  brandsContainer: {
    paddingLeft: Spacing.lg,
  },
  brandContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  brandTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  brandActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  referencesContainer: {
    paddingLeft: Spacing.lg,
    backgroundColor: Colors.background,
  },
  referenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  referenceInfo: {
    flex: 1,
  },
  referenceName: {
    fontSize: 12,
    color: Colors.text,
  },
  referenceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  referenceStock: {
    fontSize: 11,
    color: Colors.muted.foreground,
  },
  referencePrice: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.primary[900],
    marginLeft: Spacing.md,
  },
  referenceActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success.main + '15',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 2,
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success.main,
  },
  addButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success.main + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  addButtonTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success.main,
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
  emptyHint: {
    fontSize: 14,
    color: Colors.muted.foreground,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary[900],
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
    fontSize: 15,
    color: Colors.text,
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
  modalSaveButtonDisabled: {
    backgroundColor: Colors.muted.main,
  },
  modalSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
});
