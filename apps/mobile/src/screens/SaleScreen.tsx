import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Search,
  Plus,
  Minus,
  Trash,
  Package,
  DollarSign,
  CreditCard,
  ChevronRight,
  IconProps,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, SearchableSelect } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
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
  // Filtre catégorie (vue uniquement) — chips de la maquette
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
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
    .filter(p => (p.current_stock || 0) > 0)
    .filter(p => selectedCategory === 'Tous' || p.category === selectedCategory);

  // Catégories disponibles (dérivées des produits) pour les chips de la maquette.
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return ['Tous', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [products]);

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
          number: `${shop?.code || 'Swalo'}-${new Date().getFullYear()}-PROV`,
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

  // Nom d'affichage compact d'un produit (carte grille). On garde la même
  // logique métier pour le nom envoyé au panier (cf. addToCart).
  const productLabel = (product: SaleProduct) =>
    product.family ||
    [product.article_type, product.brand].filter(Boolean).join(' ') ||
    product.name;

  // Total d'une ligne panier (présentation uniquement, mêmes prix que computedTotal).
  const lineTotal = (item: CartItem) => {
    const product = products.find(p => p.id === item.productId);
    const unitPrice = item.unitPrice || product?.sell_price || 0;
    return unitPrice * item.quantity;
  };

  const lineUnitPrice = (item: CartItem) => {
    const product = products.find(p => p.id === item.productId);
    return item.unitPrice || product?.sell_price || 0;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Nouvelle vente" subtitle="Sélectionnez les articles" />

      <View style={styles.body}>
        {/* Barre de recherche */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Search size={20} color={Colors.action} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un produit…"
              placeholderTextColor={Colors.muted.foreground}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Chips de catégorie */}
        <View style={styles.chipsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContent}
          >
            {categories.map(category => {
              const active = selectedCategory === category;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.chipText, active && styles.chipTextActive]}
                    numberOfLines={1}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Grille produits 2 colonnes */}
        <ScrollView
          contentContainerStyle={[
            styles.productsGrid,
            cart.length > 0 && styles.productsGridWithSheet,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {filteredProducts.map(product => {
            const stock = product.current_stock || 0;
            const lowStock = product.alert_threshold > 0 && stock <= product.alert_threshold;
            return (
              <TouchableOpacity
                key={product.id}
                style={[styles.productCard, isTablet && { width: tabletCardWidth }]}
                onPress={() => addToCart(product)}
                activeOpacity={0.85}
              >
                <View style={styles.productCardHeader}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {productLabel(product)}
                  </Text>
                  <View style={styles.addButton}>
                    <Plus size={18} color={Colors.action} />
                  </View>
                </View>
                <Text style={styles.productPrice}>{formatMoney(product.sell_price)}</Text>
                <View style={styles.productMetaRow}>
                  <Text style={[styles.productStock, lowStock && styles.productStockLow]}>
                    {stock} en stock
                  </Text>
                  {product.is_multi_price && (
                    <View style={styles.multiPriceBadge}>
                      <Text style={styles.multiPriceBadgeText}>MULTI-PRIX</Text>
                    </View>
                  )}
                </View>
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

      {/* Bottom-sheet "Encaisser" — visible dès que le panier n'est pas vide */}
      <Modal visible={cart.length > 0} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Encaisser</Text>
              <Text style={styles.sheetTotal}>{formatMoney(computedTotal)}</Text>
            </View>

            <ScrollView
              style={styles.sheetItems}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {cart.map(item => (
                <View key={`${item.productId}-${item.batchId || 'fifo'}`} style={styles.sheetItem}>
                  <View style={styles.sheetItemInfo}>
                    <Text style={styles.sheetItemName} numberOfLines={1}>
                      {item.productName}
                    </Text>
                    <Text style={styles.sheetItemUnit}>{formatMoney(lineUnitPrice(item))}</Text>
                  </View>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() =>
                        item.quantity <= 1
                          ? removeFromCart(item.productId, item.batchId)
                          : updateQuantity(item.productId, -1, item.batchId)
                      }
                    >
                      {item.quantity <= 1 ? (
                        <Trash size={14} color={Colors.danger.main} />
                      ) : (
                        <Minus size={14} color={Colors.text} />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => updateQuantity(item.productId, 1, item.batchId)}
                    >
                      <Plus size={14} color={Colors.action} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.sheetItemTotal}>{formatMoney(lineTotal(item))}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Ajouter un client */}
            <TouchableOpacity style={styles.addCustomerRow} onPress={handleCheckout}>
              <View style={styles.addCustomerIcon}>
                <Plus size={16} color={Colors.action} />
              </View>
              <Text style={styles.addCustomerText}>
                {selectedCustomer && selectedCustomer !== 'cash'
                  ? customers.find(c => c.id === selectedCustomer)?.name || 'Client'
                  : 'Ajouter un client (optionnel)'}
              </Text>
              <ChevronRight size={20} color={Colors.muted.foreground} />
            </TouchableOpacity>

            {/* Toggle paiement Cash / Crédit */}
            <View style={styles.segment}>
              {paymentMethods.map(method => {
                const isActive = paymentMethod === method.key;
                const isDisabled = method.disabled;
                return (
                  <TouchableOpacity
                    key={method.key}
                    style={[styles.segmentItem, isActive && styles.segmentItemActive]}
                    onPress={() => {
                      if (isDisabled) {
                        handleCheckout();
                      } else {
                        setPaymentMethod(method.key);
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isActive && styles.segmentTextActive,
                        isDisabled && styles.segmentTextDisabled,
                      ]}
                    >
                      {method.key === 'cash' ? 'Cash' : 'Crédit'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Grand bouton Encaisser */}
            <TouchableOpacity
              style={styles.encaisserButton}
              onPress={handleCheckout}
              activeOpacity={0.9}
            >
              <Text style={styles.encaisserButtonText}>
                {paymentMethod === 'credit' ? 'Encaisser à crédit' : 'Encaisser en cash'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                                ? Colors.action
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
  body: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // --- Barre de recherche ---
  searchWrapper: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  // --- Chips de catégorie ---
  chipsRow: {
    paddingBottom: Spacing.sm,
  },
  chipsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary[900],
    borderColor: Colors.primary[900],
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textColors.secondary,
  },
  chipTextActive: {
    color: Colors.primary.foreground,
  },
  // --- Grille produits ---
  productsGrid: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  productsGridWithSheet: {
    paddingBottom: 360,
  },
  productCard: {
    width: '48%',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  productCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  productName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.primary[900],
    marginBottom: Spacing.xs,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  productStock: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textColors.tertiary,
  },
  productStockLow: {
    color: Colors.warning.main,
  },
  multiPriceBadge: {
    backgroundColor: Colors.primary[50],
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  multiPriceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: Colors.action,
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
  // --- Bottom-sheet "Encaisser" ---
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11, 42, 69, 0.25)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.sheet,
    borderTopRightRadius: BorderRadius.sheet,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing['2xl'],
    maxHeight: '70%',
    ...Shadows.lg,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetTotal: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.action,
  },
  sheetItems: {
    flexGrow: 0,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  sheetItemInfo: {
    flex: 1,
  },
  sheetItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  sheetItemUnit: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 4,
  },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  sheetItemTotal: {
    minWidth: 64,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  addCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  addCustomerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCustomerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
    marginBottom: Spacing.lg,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  segmentItemActive: {
    backgroundColor: Colors.surface,
    ...Shadows.sm,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
  },
  segmentTextActive: {
    color: Colors.action,
  },
  segmentTextDisabled: {
    color: Colors.textColors.disabled,
  },
  encaisserButton: {
    backgroundColor: Colors.success.main,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  encaisserButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success.foreground,
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
    borderColor: Colors.action,
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
    color: Colors.action,
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
    color: Colors.action,
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
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  overrideCheckmark: {
    color: Colors.surface,
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
