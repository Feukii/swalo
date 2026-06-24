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
  IconProps,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, SearchableSelect } from '../components/ui';
import { Colors, Spacing } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useResponsive } from '../hooks/useResponsive';
import { productRepo, customerRepo, stockBatchRepo, LocalProduct } from '../db/repositories';
import { checkCreditLimit } from '../utils/creditCheck';
import {
  createSaleOffline,
  createCashEntryOffline,
  createReceivableOffline,
} from '../db/offlineWrite';

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice?: number; // Prix unitaire choisi (pour multi-prix)
  batchId?: string; // Lot choisi (pour multi-prix)
}

interface PriceOption {
  sell_price: number;
  total_quantity: number;
  batch_count: number;
  batches: { id: string; remaining_quantity: number }[];
}

// Produit enrichi avec le stock total calculé et les champs multi-prix optionnels
interface SaleProduct extends LocalProduct {
  current_stock: number;
  is_multi_price?: boolean;
  price_min?: number;
  price_max?: number;
}

// Client utilisable dans l'écran de vente (client comptant par défaut + clients locaux)
interface SaleCustomer {
  id: string;
  name: string;
  first_name?: string | null;
  phone?: string | null;
  credit_limit?: number;
}
import { showInvoiceActions, InvoiceData } from '../utils/pdfGenerator';

type PaymentMethod = 'cash' | 'credit';

export default function SaleScreen() {
  const { shopId, userId, shop } = useCurrentUser();
  const { isTablet, columns } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [totalPrice, setTotalPrice] = useState('');
  const [overridePrice, setOverridePrice] = useState(false);
  const [pricingNotes, setPricingNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clients disponibles (chargés depuis local DB + API)
  const [customers, setCustomers] = useState<SaleCustomer[]>([]);

  // Produits disponibles (chargés depuis local DB + API)
  const [products, setProducts] = useState<SaleProduct[]>([]);

  // Multi-prix: modal de sélection
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState<SaleProduct | null>(null);
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([]);

  // Offline-first: Load products from local SQLite
  const loadProducts = useCallback(async () => {
    if (!shopId) return;
    try {
      const localProducts = await productRepo.getAll(shopId, {
        where: { is_active: 1 },
        orderBy: 'name ASC',
      });
      const enriched: SaleProduct[] = await Promise.all(
        localProducts.map(async p => {
          const totalStock = await stockBatchRepo.getTotalStock(shopId, p.id);
          return { ...p, current_stock: totalStock };
        })
      );
      setProducts(enriched);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  }, [shopId]);

  // Offline-first: Load customers from local SQLite
  const loadCustomers = useCallback(async () => {
    if (!shopId) return;
    try {
      const defaultCustomer = { id: 'cash', name: 'Client comptant', first_name: '' };
      const localCustomers = await customerRepo.getAll(shopId, {
        where: { is_active: 1 },
        orderBy: 'name ASC',
      });
      setCustomers([defaultCustomer, ...localCustomers]);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      setCustomers([{ id: 'cash', name: 'Client comptant', first_name: '' }]);
    }
  }, [shopId]);

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, [loadProducts, loadCustomers]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadCustomers();
    }, [loadProducts, loadCustomers])
  );

  // Quand on change de client, vérifier si crédit est valide
  useEffect(() => {
    if (selectedCustomer === 'cash' && paymentMethod === 'credit') {
      setPaymentMethod('cash');
    }
  }, [selectedCustomer, paymentMethod]);

  const filteredProducts = products
    .filter(
      p =>
        p.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.family?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.article_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(p => (p.current_stock || 0) > 0);

  const addToCart = async (product: SaleProduct) => {
    const productName = `${product.family} - ${product.article_type} ${product.brand}`;
    const currentStock = product.current_stock || 0;

    // Check multi-price from local stock batches
    if (shopId) {
      try {
        const batches = await stockBatchRepo.getByProduct(shopId, product.id);
        const activeBatches = batches.filter(b => b.remaining_quantity > 0);

        // Group by sell_price to detect multi-price
        const priceGroups = new Map<
          number,
          {
            sell_price: number;
            total_quantity: number;
            batch_count: number;
            batches: { id: string; remaining_quantity: number }[];
          }
        >();
        activeBatches.forEach(b => {
          const existing = priceGroups.get(b.sell_price);
          if (existing) {
            existing.total_quantity += b.remaining_quantity;
            existing.batch_count++;
            existing.batches.push({ id: b.id, remaining_quantity: b.remaining_quantity });
          } else {
            priceGroups.set(b.sell_price, {
              sell_price: b.sell_price,
              total_quantity: b.remaining_quantity,
              batch_count: 1,
              batches: [{ id: b.id, remaining_quantity: b.remaining_quantity }],
            });
          }
        });

        if (priceGroups.size > 1) {
          // Multi-price: show selection modal
          setPriceModalProduct(product);
          setPriceOptions(Array.from(priceGroups.values()));
          setShowPriceModal(true);
          return;
        }
      } catch (e) {
        console.log('Multi-price check skipped:', e);
      }
    }

    // Single price or no batches: add directly
    addToCartDirect(product, productName, currentStock);
  };

  const addToCartDirect = (
    product: SaleProduct,
    productName: string,
    currentStock: number,
    unitPrice?: number,
    batchId?: string
  ) => {
    const existingItem = cart.find(
      item => item.productId === product.id && item.batchId === batchId
    );

    if (existingItem) {
      const maxStock = batchId
        ? priceOptions.find(p => p.batches.some(b => b.id === batchId))?.total_quantity ||
          currentStock
        : currentStock;
      if (existingItem.quantity >= maxStock) {
        Alert.alert('Stock insuffisant', `Stock disponible: ${maxStock} unités`);
        return;
      }
      setCart(
        cart.map(item =>
          item.productId === product.id && item.batchId === batchId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product.id,
          productName: unitPrice ? `${productName} (${formatMoney(unitPrice)})` : productName,
          quantity: 1,
          unitPrice,
          batchId,
        },
      ]);
    }
  };

  const handlePriceSelection = (priceOption: PriceOption) => {
    if (!priceModalProduct) return;
    const productName = `${priceModalProduct.family} - ${priceModalProduct.article_type} ${priceModalProduct.brand}`;
    // Utiliser le premier lot de ce groupe de prix (FIFO dans le groupe)
    const firstBatch = priceOption.batches[0];
    addToCartDirect(
      priceModalProduct,
      productName,
      priceOption.total_quantity,
      priceOption.sell_price,
      firstBatch.id
    );
    setShowPriceModal(false);
    setPriceModalProduct(null);
    setPriceOptions([]);
  };

  const updateQuantity = (productId: string, delta: number, batchId?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const currentStock = product.current_stock || 0;

    setCart(prevCart => {
      const updated = prevCart
        .map(item => {
          if (item.productId === productId && item.batchId === batchId) {
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
        .filter(Boolean) as CartItem[];

      return updated;
    });
  };

  const removeFromCart = (productId: string, batchId?: string) => {
    setCart(cart.filter(item => !(item.productId === productId && item.batchId === batchId)));
  };

  const getTotalItems = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  // Calcul automatique du total du panier
  const computedTotal = cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.productId);
    const unitPrice = item.unitPrice || product?.sell_price || 0;
    return sum + unitPrice * item.quantity;
  }, 0);

  // Total effectif (override ou calculé)
  const effectiveTotal = overridePrice && totalPrice ? parseInt(totalPrice) : computedTotal;

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
    if (effectiveTotal <= 0) {
      Alert.alert('Prix invalide', 'Le total de la vente doit être supérieur à 0');
      return;
    }

    // Si le prix a été modifié, la raison est obligatoire
    if (overridePrice && !pricingNotes.trim()) {
      Alert.alert('Raison requise', 'Veuillez indiquer la raison de la modification du prix');
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
      const amount = effectiveTotal; // FCFA = pas de centimes
      const itemsDescription = cart.map(item => `${item.productName} x${item.quantity}`).join(', ');

      if (!shopId || !userId) {
        Alert.alert('Erreur', 'Session invalide');
        return;
      }

      // Create receivable for credit sales
      if (paymentMethod === 'credit') {
        // Vérifier le plafond de crédit du client
        const creditError = await checkCreditLimit(
          shopId,
          selectedCustomer,
          customer?.credit_limit || 0,
          amount
        );
        if (creditError) {
          Alert.alert('Plafond de credit atteint', creditError);
          setIsSubmitting(false);
          return;
        }

        await createReceivableOffline({
          shopId,
          customerId: selectedCustomer,
          amount: amount,
          description: `Vente à crédit - ${getTotalItems()} article(s)`,
          notes: itemsDescription,
        });
      } else {
        // Cash sale: create cash entry
        await createCashEntryOffline({
          shopId,
          cashierId: userId,
          type: 'IN',
          category: 'vente',
          amount: amount,
          note: `Vente espèces - ${getTotalItems()} article(s): ${itemsDescription}`,
          customerId: selectedCustomer !== 'cash' ? selectedCustomer : undefined,
        });
      }

      // Create sale record with local stock deduction
      await createSaleOffline({
        shopId,
        cashierId: userId,
        customerId: selectedCustomer !== 'cash' ? selectedCustomer : null,
        paymentMethod,
        grandTotal: amount,
        items: cart.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            productName: item.productName,
            sku: product?.sku || '',
            qty: item.quantity,
            unitPrice: item.unitPrice || product?.sell_price || 0,
            batchId: item.batchId,
          };
        }),
        note: itemsDescription,
        expectedTotal: overridePrice ? computedTotal : undefined,
        pricingNotes: overridePrice ? pricingNotes : undefined,
      });

      // Build invoice data from cart for local PDF generation
      const buildInvoiceData = (): InvoiceData => {
        const now = new Date().toISOString();
        const invoiceItems = cart.map(item => {
          const product = products.find(p => p.id === item.productId);
          const unitPrice = item.unitPrice || product?.sell_price || 0;
          const itemTotal = unitPrice * item.quantity;
          return {
            description: item.productName,
            qty: item.quantity,
            unit_price: unitPrice,
            discount: 0,
            tax_rate: 0,
            subtotal: itemTotal,
            tax_total: 0,
            total: itemTotal,
          };
        });
        return {
          number: `${shop?.code || 'SWALO'}-${new Date().getFullYear()}-PROV`,
          issue_date: now,
          status: 'ISSUED',
          shop: {
            name: shop?.name || 'Boutique',
            code: shop?.code || '',
          },
          customer:
            selectedCustomer !== 'cash' && customer
              ? {
                  name: customer.first_name
                    ? `${customer.first_name} ${customer.name}`
                    : customer.name,
                  phone: customer.phone,
                }
              : null,
          items: invoiceItems,
          subtotal: amount,
          discount: 0,
          tax_total: 0,
          grand_total: amount,
          paid_total: paymentMethod === 'cash' ? amount : 0,
          balance_due: paymentMethod === 'credit' ? amount : 0,
        };
      };

      const handleGenerateInvoice = () => {
        const invoiceData = buildInvoiceData();
        showInvoiceActions(invoiceData);
      };

      // Message de succès selon le mode de paiement
      const invoiceButton = {
        text: 'Facture',
        onPress: () => {
          handleGenerateInvoice();
          resetForm();
        },
      };

      if (paymentMethod === 'credit') {
        Alert.alert(
          'Vente a credit enregistree',
          `Client: ${customerName}\nMontant: ${formatMoney(amount)}\n\n✓ Creance creee\n✓ Stock mis a jour\n\nLe solde caisse n'est pas impacte.`,
          [invoiceButton, { text: 'OK', onPress: resetForm }]
        );
      } else {
        Alert.alert(
          'Vente enregistree',
          `Client: ${customerName}\nMontant: ${formatMoney(amount)}\nMode: Especes\n\n✓ Entree caisse creee\n✓ Stock mis a jour\n✓ Solde caisse +${formatMoney(amount)}`,
          [invoiceButton, { text: 'OK', onPress: resetForm }]
        );
      }

      // Recharger les produits
      await loadProducts();
    } catch (error: unknown) {
      console.error("Erreur lors de l'enregistrement de la vente:", error);
      const message = error instanceof Error ? error.message : "Impossible d'enregistrer la vente";
      Alert.alert('Erreur', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setCart([]);
    setTotalPrice('');
    setOverridePrice(false);
    setPricingNotes('');
    setSelectedCustomer('');
    setPaymentMethod('cash');
    setShowPaymentModal(false);
  };

  // Méthodes de paiement disponibles (crédit désactivé pour client comptant)
  const paymentMethods: Array<{
    key: PaymentMethod;
    label: string;
    icon: React.ComponentType<IconProps>;
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

  // Mode tablette (largeur >= 768) : master-detail côte à côte (produits | panier).
  // Sur téléphone, isTablet est faux et tous ces overrides valent undefined,
  // donc le rendu/les styles restent strictement identiques à aujourd'hui.
  // Largeur de carte produit : téléphone '23%' (4 col), tablette ~'18%' (5 col),
  // grande tablette ~'15%' (6 col) — dérivée de `columns` avec un peu de gouttière.
  const tabletCardWidth = `${Math.floor(100 / columns) - 2}%` as const;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Point de vente" />

      <View style={[styles.mainContent, isTablet && styles.mainContentTablet]}>
        {/* Products Section - 2/3 of height (phone) / left pane 60% (tablet) */}
        <View style={[styles.productsSection, isTablet && styles.productsSectionTablet]}>
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
                  style={[
                    styles.productCard,
                    isTablet && { width: tabletCardWidth },
                    inCart && styles.productCardInCart,
                  ]}
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
                  {product.is_multi_price && (
                    <Text style={styles.multiPriceBadge}>
                      {formatMoney(product.price_min)} - {formatMoney(product.price_max)}
                    </Text>
                  )}
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

        {/* Cart Section - 1/3 of height (phone) / right pane 40% (tablet) */}
        <View style={[styles.cartSection, isTablet && styles.cartSectionTablet]}>
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
                  <View key={`${item.productId}-${item.batchId || 'fifo'}`} style={styles.cartItem}>
                    <Text style={styles.cartItemName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <View style={styles.cartItemActions}>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.productId, -1, item.batchId)}
                      >
                        <Minus size={14} color={Colors.text} />
                      </TouchableOpacity>
                      <Text style={styles.quantity}>{item.quantity}</Text>
                      <TouchableOpacity
                        style={styles.quantityButton}
                        onPress={() => updateQuantity(item.productId, 1, item.batchId)}
                      >
                        <Plus size={14} color={Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeFromCart(item.productId, item.batchId)}
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

              {/* Auto-calculated Total */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Total calculé</Text>
                <View style={styles.calculatedTotalContainer}>
                  <Text style={styles.calculatedTotalAmount}>{formatMoney(computedTotal)}</Text>
                </View>
              </View>

              {/* Override Toggle */}
              <TouchableOpacity
                style={styles.overrideToggle}
                onPress={() => {
                  setOverridePrice(!overridePrice);
                  if (!overridePrice) {
                    setTotalPrice(String(computedTotal));
                  } else {
                    setTotalPrice('');
                    setPricingNotes('');
                  }
                }}
              >
                <View
                  style={[styles.overrideCheckbox, overridePrice && styles.overrideCheckboxActive]}
                >
                  {overridePrice && <Text style={styles.overrideCheckmark}>✓</Text>}
                </View>
                <Text style={styles.overrideToggleText}>Modifier le prix</Text>
              </TouchableOpacity>

              {overridePrice && (
                <View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Nouveau prix (FCFA)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Entrez le nouveau montant"
                      placeholderTextColor={Colors.muted.foreground}
                      value={totalPrice}
                      onChangeText={setTotalPrice}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Raison de la modification *</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="Ex: Remise fidélité, prix négocié..."
                      placeholderTextColor={Colors.muted.foreground}
                      value={pricingNotes}
                      onChangeText={setPricingNotes}
                      multiline
                      numberOfLines={2}
                    />
                  </View>
                </View>
              )}

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

      {/* Price Selection Modal (Multi-prix) */}
      <Modal
        visible={showPriceModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowPriceModal(false);
          setPriceModalProduct(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choisir le prix de vente</Text>
            {priceModalProduct && (
              <Text style={styles.priceModalProductName}>
                {priceModalProduct.family} - {priceModalProduct.article_type}{' '}
                {priceModalProduct.brand}
              </Text>
            )}
            <Text style={styles.priceModalHint}>
              Ce produit a plusieurs prix actifs. Sélectionnez le prix applicable.
            </Text>

            <ScrollView>
              {priceOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.priceOption}
                  onPress={() => handlePriceSelection(option)}
                >
                  <View style={styles.priceOptionMain}>
                    <Text style={styles.priceOptionPrice}>{formatMoney(option.sell_price)}</Text>
                    <Text style={styles.priceOptionStock}>
                      {option.total_quantity} unités disponibles
                    </Text>
                  </View>
                  <View style={styles.priceOptionBadge}>
                    <Text style={styles.priceOptionBadgeText}>
                      {option.batch_count} lot{option.batch_count > 1 ? 's' : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => {
                setShowPriceModal(false);
                setPriceModalProduct(null);
              }}
            >
              <Text style={styles.modalCancelButtonText}>Annuler</Text>
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
  mainContent: {
    flex: 1,
    flexDirection: 'column',
  },
  // Tablette : master-detail horizontal (produits à gauche, panier à droite).
  mainContentTablet: {
    flexDirection: 'row',
  },
  productsSection: {
    flex: 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // Tablette : volet gauche ~60%, séparateur vertical au lieu d'horizontal.
  productsSectionTablet: {
    flex: 3,
    borderBottomWidth: 0,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
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
  multiPriceBadge: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.warning.main,
    marginTop: 2,
    textAlign: 'center',
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
  // Tablette : volet droit ~40% pleine hauteur.
  cartSectionTablet: {
    flex: 2,
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
  // Price Selection Modal styles
  priceModalProductName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  priceModalHint: {
    fontSize: 13,
    color: Colors.muted.foreground,
    marginBottom: Spacing.lg,
  },
  priceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  priceOptionMain: {
    flex: 1,
  },
  priceOptionPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary[900],
    marginBottom: 2,
  },
  priceOptionStock: {
    fontSize: 13,
    color: Colors.muted.foreground,
  },
  priceOptionBadge: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
  },
  priceOptionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary[900],
  },
  // Auto-total and override styles
  calculatedTotalContainer: {
    backgroundColor: Colors.primary[50],
    padding: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  calculatedTotalAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary[900],
  },
  overrideToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  overrideCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.muted.foreground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overrideCheckboxActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  overrideCheckmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  overrideToggleText: {
    fontSize: 14,
    color: Colors.text,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
});
