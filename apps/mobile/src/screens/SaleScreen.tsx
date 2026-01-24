import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash,
  CheckCircle,
  Package,
  DollarSign,
  CreditCard,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, SearchableSelect } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { Product, SaleItem } from '../types/stock';
import { formatMoney } from '../utils/money';
import { customersApi, receivablesApi, cashApi, productsApi, inventoryApi } from '../lib/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

type PaymentMethod = 'cash' | 'credit';

export default function SaleScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [totalPrice, setTotalPrice] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clients disponibles (chargés depuis API)
  const [customers, setCustomers] = useState<any[]>([]);

  // Produits disponibles (chargés depuis l'API catalogue)
  const [products, setProducts] = useState<any[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // Charger les produits depuis l'API catalogue
  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const loadedProducts = await productsApi.getAll();
      // Filtrer côté client pour ne garder que les produits actifs
      const activeProducts = loadedProducts.filter((p: any) => p.is_active !== false);
      setProducts(activeProducts);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      Alert.alert('Erreur', 'Impossible de charger les produits du catalogue');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Charger les clients depuis l'API
  const loadCustomers = async () => {
    try {
      const loadedCustomers = await customersApi.getAll({ is_active: true });
      const customersWithDefault = [
        { id: 'cash', name: 'Client comptant', first_name: '' },
        ...loadedCustomers,
      ];
      setCustomers(customersWithDefault);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      setCustomers([{ id: 'cash', name: 'Client comptant', first_name: '' }]);
    }
  };

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadCustomers();
    }, [])
  );

  // Quand on change de client, vérifier si crédit est valide
  useEffect(() => {
    if (selectedCustomer === 'cash' && paymentMethod === 'credit') {
      setPaymentMethod('cash');
    }
  }, [selectedCustomer]);

  const filteredProducts = products
    .filter(
      p =>
        p.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.family?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.article_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(p => (p.current_stock || 0) > 0);

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.productId === product.id);
    const productName = `${product.family} - ${product.article_type} ${product.brand}`;
    const currentStock = product.current_stock || 0;

    if (existingItem) {
      if (existingItem.quantity >= currentStock) {
        Alert.alert('Stock insuffisant', `Stock disponible: ${currentStock} unités`);
        return;
      }
      setCart(
        cart.map(item =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: productName,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const currentStock = product.current_stock || 0;

    setCart(prevCart => {
      const updated = prevCart
        .map(item => {
          if (item.productId === productId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity > currentStock) {
              Alert.alert('Stock insuffisant', `Stock disponible: ${currentStock} unités`);
              return item;
            }
            if (newQuantity <= 0) return null;
            return { ...item, quantity: newQuantity };
          }
          return item;
        })
        .filter(Boolean) as SaleItem[];

      return updated;
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant de valider');
      return;
    }
    setShowPaymentModal(true);
  };

  const confirmSale = async () => {
    // Validations
    if (!selectedCustomer) {
      Alert.alert('Client requis', 'Veuillez sélectionner un client');
      return;
    }
    if (!totalPrice || parseFloat(totalPrice) <= 0) {
      Alert.alert('Prix invalide', 'Veuillez entrer le prix total de la vente');
      return;
    }

    // Vérifier qu'on ne peut pas vendre à crédit à un client comptant
    if (paymentMethod === 'credit' && selectedCustomer === 'cash') {
      Alert.alert(
        'Client requis',
        'Impossible de vendre à crédit à un client comptant.\nVeuillez sélectionner un client enregistré.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const customer = customers.find(c => c.id === selectedCustomer);
      const customerName = customer
        ? customer.first_name
          ? `${customer.first_name} ${customer.name}`
          : customer.name
        : 'Inconnu';
      const amount = parseInt(totalPrice); // FCFA = pas de centimes
      const itemsDescription = cart.map(item => `${item.productName} x${item.quantity}`).join(', ');

      // Logique selon le mode de paiement
      if (paymentMethod === 'credit') {
        // VENTE À CRÉDIT : Créer uniquement la créance (pas d'entrée caisse)
        // Le solde caisse n'est pas impacté
        await receivablesApi.create({
          customer_id: selectedCustomer,
          amount: amount,
          description: `Vente à crédit - ${getTotalItems()} article(s)`,
          notes: itemsDescription,
        });
      } else {
        // VENTE CASH : Créer entrée caisse (impacte le solde)
        await cashApi.createEntry({
          type: 'IN',
          category: 'vente',
          amount: amount,
          note: `Vente espèces - ${getTotalItems()} article(s): ${itemsDescription}`,
          customer_id: selectedCustomer !== 'cash' ? selectedCustomer : undefined,
        });
      }

      // Déduire le stock pour chaque produit vendu
      for (const item of cart) {
        try {
          await inventoryApi.saleOut({
            product_id: item.productId,
            quantity: item.quantity,
          });
        } catch (error: any) {
          console.error(`Erreur déduction stock pour ${item.productName}:`, error);
          // Continue avec les autres produits même en cas d'erreur
        }
      }

      // Message de succès selon le mode de paiement
      if (paymentMethod === 'credit') {
        Alert.alert(
          'Vente à crédit enregistrée',
          `Client: ${customerName}\nMontant: ${formatMoney(amount)}\n\n✓ Créance créée\n✓ Stock mis à jour\n\nLe solde caisse n'est pas impacté.`,
          [{ text: 'OK', onPress: resetForm }]
        );
      } else {
        Alert.alert(
          'Vente enregistrée',
          `Client: ${customerName}\nMontant: ${formatMoney(amount)}\nMode: Espèces\n\n✓ Entrée caisse créée\n✓ Stock mis à jour\n✓ Solde caisse +${formatMoney(amount)}`,
          [{ text: 'OK', onPress: resetForm }]
        );
      }

      // Recharger les produits
      await loadProducts();
    } catch (error: any) {
      console.error("Erreur lors de l'enregistrement de la vente:", error);
      Alert.alert('Erreur', error.message || "Impossible d'enregistrer la vente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCart([]);
    setTotalPrice('');
    setSelectedCustomer('');
    setPaymentMethod('cash');
    setShowPaymentModal(false);
  };

  const getPaymentMethodLabel = () => {
    const labels: Record<PaymentMethod, string> = {
      cash: 'Espèces',
      credit: 'À crédit',
    };
    return labels[paymentMethod];
  };

  // Méthodes de paiement disponibles (crédit désactivé pour client comptant)
  const paymentMethods: Array<{
    key: PaymentMethod;
    label: string;
    icon: any;
    disabled?: boolean;
  }> = [
    { key: 'cash', label: 'Espèces', icon: DollarSign },
    {
      key: 'credit',
      label: 'Crédit',
      icon: CreditCard,
      disabled: selectedCustomer === 'cash' || !selectedCustomer,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Point de vente" />

      <View style={styles.mainContent}>
        {/* Products Section - 2/3 of height */}
        <View style={styles.productsSection}>
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

          {/* Products Grid */}
          <ScrollView contentContainerStyle={styles.productsGrid}>
            {filteredProducts.map(product => {
              const inCart = cart.find(item => item.productId === product.id);
              return (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.productCard, inCart && styles.productCardInCart]}
                  onPress={() => addToCart(product)}
                >
                  <View style={styles.productIconContainer}>
                    <Package size={20} color={Colors.primary[900]} />
                  </View>
                  <Text style={styles.productName} numberOfLines={2}>
                    {product.family}
                  </Text>
                  <Text style={styles.productDetail} numberOfLines={1}>
                    {product.article_type} {product.brand}
                  </Text>
                  <Text style={styles.productStock}>{product.current_stock || 0} unités</Text>
                  {inCart && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>{inCart.quantity}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
            {filteredProducts.length === 0 && (
              <View style={styles.emptyProducts}>
                <Package size={48} color={Colors.muted.foreground} />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Aucun produit trouvé' : 'Aucun produit en stock'}
                </Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Cart Section - 1/3 of height */}
        <View style={styles.cartSection}>
          <View style={styles.cartHeader}>
            <View style={styles.cartHeaderLeft}>
              <ShoppingCart size={20} color={Colors.primary.foreground} />
              <Text style={styles.cartTitle}>Panier</Text>
            </View>
            <View style={styles.cartCount}>
              <Text style={styles.cartCountText}>{getTotalItems()} article(s)</Text>
            </View>
          </View>

          {cart.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartText}>Panier vide - Sélectionnez des produits</Text>
            </View>
          ) : (
            <View style={styles.cartContent}>
              {/* Cart Items - Horizontal scroll */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cartItemsContainer}
              >
                {cart.map(item => (
                  <View key={item.productId} style={styles.cartItem}>
                    <Text style={styles.cartItemName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <View style={styles.cartItemActions}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.productId, -1)}
                      >
                        <Minus size={14} color={Colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.quantity}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.productId, 1)}
                      >
                        <Plus size={14} color={Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeFromCart(item.productId)}
                      >
                        <Trash size={14} color={Colors.danger.main} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>

              {/* Checkout Button */}
              <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
                <CheckCircle size={20} color={Colors.primary.foreground} />
                <Text style={styles.checkoutButtonText}>Valider la vente</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Finaliser la vente</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Cart Summary */}
              <View style={styles.cartSummary}>
                <Text style={styles.summaryTitle}>Récapitulatif</Text>
                {cart.map(item => (
                  <View key={item.productId} style={styles.summaryItem}>
                    <Text style={styles.summaryItemName}>{item.productName}</Text>
                    <Text style={styles.summaryItemQty}>x{item.quantity}</Text>
                  </View>
                ))}
              </View>

              {/* Customer Selection */}
              <View style={styles.formGroup}>
                <SearchableSelect
                  label="Client"
                  value={selectedCustomer}
                  onValueChange={setSelectedCustomer}
                  options={customers}
                  placeholder="Sélectionner un client"
                />
              </View>

              {/* Total Price Input */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Prix total (FCFA)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Entrez le montant total"
                  placeholderTextColor={Colors.muted.foreground}
                  value={totalPrice}
                  onChangeText={setTotalPrice}
                  keyboardType="numeric"
                />
              </View>

              {/* Payment Method */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Mode de paiement</Text>
                <View style={styles.paymentMethods}>
                  {paymentMethods.map(method => {
                    const IconComponent = method.icon;
                    const isDisabled = method.disabled;
                    const isActive = paymentMethod === method.key;

                    return (
                      <TouchableOpacity
                        key={method.key}
                        style={[
                          styles.paymentMethod,
                          isActive && styles.paymentMethodActive,
                          isDisabled && styles.paymentMethodDisabled,
                        ]}
                        onPress={() => !isDisabled && setPaymentMethod(method.key)}
                        disabled={isDisabled}
                      >
                        <IconComponent
                          size={20}
                          color={
                            isDisabled
                              ? Colors.muted.foreground
                              : isActive
                                ? Colors.primary[900]
                                : Colors.text
                          }
                        />
                        <Text
                          style={[
                            styles.paymentMethodText,
                            isActive && styles.paymentMethodTextActive,
                            isDisabled && styles.paymentMethodTextDisabled,
                          ]}
                        >
                          {method.label}
                        </Text>
                        {method.key === 'credit' && isDisabled && (
                          <Text style={styles.paymentMethodHint}>(client requis)</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Credit Warning */}
              {paymentMethod === 'credit' && (
                <View style={styles.creditWarning}>
                  <Text style={styles.creditWarningText}>
                    Une vente à crédit crée une créance client.{'\n'}
                    Le solde caisse n'est pas impacté.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowPaymentModal(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmButton,
                  isSubmitting && styles.modalConfirmButtonDisabled,
                ]}
                onPress={confirmSale}
                disabled={isSubmitting}
              >
                <Text style={styles.modalConfirmButtonText}>
                  {isSubmitting ? 'Enregistrement...' : 'Confirmer'}
                </Text>
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
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  productsSection: {
    flex: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
  productsGrid: {
    padding: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  productCard: {
    width: '23%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: Spacing.sm,
    alignItems: 'center',
    position: 'relative',
  },
  productCardInCart: {
    borderColor: Colors.primary[900],
    backgroundColor: Colors.primary[50],
  },
  productIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  productName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  productDetail: {
    fontSize: 10,
    color: Colors.muted.foreground,
    textAlign: 'center',
    marginBottom: 2,
  },
  productStock: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success.main,
  },
  cartBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.primary[900],
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadgeText: {
    color: Colors.primary.foreground,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyProducts: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.muted.foreground,
  },
  cartSection: {
    flex: 1,
    backgroundColor: Colors.primary[900],
  },
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  cartHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  cartCount: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  cartCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary.foreground,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  cartContent: {
    flex: 1,
    padding: Spacing.md,
  },
  cartItemsContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  cartItem: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: Spacing.md,
    minWidth: 140,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.primary.foreground,
    marginBottom: Spacing.sm,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary.foreground,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    marginLeft: 'auto',
    padding: Spacing.xs,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.success.main,
    padding: Spacing.lg,
    borderRadius: 12,
    marginTop: 'auto',
  },
  checkoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.foreground,
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
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  cartSummary: {
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
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  summaryItemName: {
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  summaryItemQty: {
    fontSize: 13,
    fontWeight: '600',
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
  paymentMethods: {
    gap: Spacing.sm,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  paymentMethodActive: {
    borderColor: Colors.primary[900],
    backgroundColor: Colors.primary[50],
  },
  paymentMethodDisabled: {
    opacity: 0.5,
    backgroundColor: Colors.muted.main,
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  paymentMethodTextActive: {
    color: Colors.primary[900],
  },
  paymentMethodTextDisabled: {
    color: Colors.muted.foreground,
  },
  paymentMethodHint: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginLeft: 'auto',
  },
  creditWarning: {
    backgroundColor: Colors.warning.main + '20',
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  creditWarningText: {
    fontSize: 13,
    color: Colors.warning.main,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
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
