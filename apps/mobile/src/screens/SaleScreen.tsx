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
  Switch,
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
  FileText,
  Calendar,
  Smartphone,
  Send,
  Mail,
  IconProps,
} from '../components/icons/SimpleIcons';
import { ScreenHeader, SearchableSelect, DatePickerField } from '../components/ui';
import { Colors, Spacing, Shadows, BorderRadius } from '../constants/theme-v2';
import { formatMoney } from '../utils/money';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { usePermissions } from '../hooks/usePermissions';
import { useResponsive } from '../hooks/useResponsive';
import {
  productRepo,
  customerRepo,
  stockBatchRepo,
  packagingTypeRepo,
  LocalProduct,
  LocalPackagingType,
} from '../db/repositories';
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

// Info de conditionnement dérivée des données réelles (jamais inventée).
// `qty` n'est renseignée que si un nombre est réellement présent dans le
// nom/symbole du type d'emballage (ex. "Carton 24"). Sinon on n'affiche
// que le libellé du conditionnement.
interface PackagingInfo {
  name: string;
  symbol: string | null;
  qty: number | null;
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
  const { can } = usePermissions();
  const canCreateSale = can('sales', 'create');
  const { isTablet, columns } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');
  // Filtre catégorie (vue uniquement) — chips de la maquette
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [cart, setCart] = useState<CartItem[]>([]);
  // Le panier s'affiche d'abord en barre compacte (maquette swalo_vente) ;
  // un tap déploie le bottom-sheet "Encaisser" (maquette swalo_vente2).
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [totalPrice, setTotalPrice] = useState('');
  const [overridePrice, setOverridePrice] = useState(false);
  const [pricingNotes, setPricingNotes] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Date d'échéance (ISO) — OBLIGATOIRE pour une vente à crédit (notifications serveur).
  const [dueDate, setDueDate] = useState<string>('');

  // Génération de facture PDF à la validation (toggle de la maquette, ON par défaut).
  const [generateInvoice, setGenerateInvoice] = useState(true);

  // Canaux de relance choisis pour une vente à crédit (maquette "Canaux de relance").
  const [reminderChannels, setReminderChannels] = useState<{
    sms: boolean;
    wa: boolean;
    email: boolean;
  }>({ sms: true, wa: true, email: false });

  // Clients disponibles (chargés depuis local DB + API)
  const [customers, setCustomers] = useState<SaleCustomer[]>([]);

  // Types de conditionnement (emballages) chargés depuis la DB locale.
  const [packagingTypes, setPackagingTypes] = useState<LocalPackagingType[]>([]);

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
          // packaging_type_id existe en colonne DB (SELECT *) même s'il n'est
          // pas dans l'interface LocalProduct — on le récupère explicitement.
          const packagingTypeId =
            (p as LocalProduct & { packaging_type_id?: string | null }).packaging_type_id ?? null;
          return { ...p, current_stock: totalStock, packaging_type_id: packagingTypeId };
        })
      );
      setProducts(enriched);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    }
  }, [shopId]);

  // Offline-first: Load packaging types from local SQLite
  const loadPackagingTypes = useCallback(async () => {
    if (!shopId) return;
    try {
      const types = await packagingTypeRepo.getAll(shopId, { orderBy: 'name ASC' });
      setPackagingTypes(types);
    } catch (error) {
      console.error('Erreur chargement conditionnements:', error);
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
    loadPackagingTypes();
  }, [loadProducts, loadCustomers, loadPackagingTypes]);

  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadCustomers();
      loadPackagingTypes();
    }, [loadProducts, loadCustomers, loadPackagingTypes])
  );

  // Quand on change de client, vérifier si crédit est valide
  useEffect(() => {
    if (selectedCustomer === 'cash' && paymentMethod === 'credit') {
      setPaymentMethod('cash');
    }
  }, [selectedCustomer, paymentMethod]);

  // L'échéance n'a de sens qu'en crédit : on l'efface dès qu'on repasse en espèces.
  useEffect(() => {
    if (paymentMethod !== 'credit' && dueDate) {
      setDueDate('');
    }
  }, [paymentMethod, dueDate]);

  const filteredProducts = products
    .filter(
      p =>
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    const productName =
      product.name || `${product.family} - ${product.article_type} ${product.brand}`;
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

        // Carton-primary : on ouvre le sélecteur de conditionnement dès qu'il y a
        // plusieurs prix OU que l'article est conditionné (carton vendable au prix
        // de gros), afin de proposer le carton (gros) ET la pièce (détail).
        const hasCarton =
          !!product.units_per_package && product.units_per_package > 1 && !!product.package_price;
        if (priceGroups.size > 1 || hasCarton) {
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

  // Sélection d'un carton complet (ex. Carton de 24) : vend le carton au prix de
  // GROS (`package_price`) en déduisant `qty` (units_per_package) pièces du stock.
  // Le prix/pièce de la ligne en découle (package_price / qty), pas l'inverse :
  // c'est bien le prix de gros du carton qui pilote le total.
  const handlePackSelection = (product: SaleProduct, qty: number, packPrice: number) => {
    if (qty > product.current_stock) {
      Alert.alert('Stock insuffisant', `Stock disponible: ${product.current_stock} unités`);
      return;
    }
    const productName = product.name || `${product.family} ${product.article_type}`;
    const perPiece = Math.round(packPrice / qty);
    setCart(prev => [
      ...prev,
      {
        productId: product.id,
        productName: `${productName} (carton ×${qty})`,
        quantity: qty,
        unitPrice: perPiece,
        batchId: undefined,
      },
    ]);
    setShowPriceModal(false);
    setPriceModalProduct(null);
    setPriceOptions([]);
  };

  const handlePriceSelection = (priceOption: PriceOption) => {
    if (!priceModalProduct) return;
    const productName =
      priceModalProduct.name ||
      `${priceModalProduct.family} - ${priceModalProduct.article_type} ${priceModalProduct.brand}`;
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

  // Stock maximum vendable pour une ligne de panier. Pour un lot multi-prix
  // choisi, on plafonne au stock du groupe de prix (cf. addToCartDirect) ;
  // sinon au stock total du produit.
  const getMaxStockForItem = (productId: string, batchId?: string): number => {
    const product = products.find(p => p.id === productId);
    const currentStock = product?.current_stock || 0;
    if (batchId) {
      const group = priceOptions.find(p => p.batches.some(b => b.id === batchId));
      return group?.total_quantity ?? currentStock;
    }
    return currentStock;
  };

  const updateQuantity = (productId: string, delta: number, batchId?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const maxStock = getMaxStockForItem(productId, batchId);

    setCart(prevCart => {
      const updated = prevCart
        .map(item => {
          if (item.productId === productId && item.batchId === batchId) {
            const newQuantity = item.quantity + delta;
            if (newQuantity > maxStock) {
              Alert.alert('Stock insuffisant', `Stock disponible: ${maxStock} unités`);
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

  // Saisie clavier de la quantité exacte. La valeur est nettoyée en entier ≥ 1,
  // plafonnée au stock disponible (même règle que les boutons +/-). Une saisie
  // vide ou invalide (0, non numérique) retombe sur 1.
  const setExactQuantity = (productId: string, value: string, batchId?: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const maxStock = getMaxStockForItem(productId, batchId);

    // On ne garde que les chiffres pour éviter signes/décimales sur number-pad.
    const digits = value.replace(/[^0-9]/g, '');
    const parsed = parseInt(digits, 10);
    let nextQuantity = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;

    if (nextQuantity > maxStock) {
      nextQuantity = Math.max(maxStock, 1);
      Alert.alert('Stock insuffisant', `Stock disponible: ${maxStock} unités`);
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.productId === productId && item.batchId === batchId
          ? { ...item, quantity: nextQuantity }
          : item
      )
    );
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
    if (!canCreateSale) {
      Alert.alert('Accès non autorisé', "Vous n'êtes pas autorisé à enregistrer une vente.");
      return;
    }
    if (cart.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant de valider');
      return;
    }
    setShowPaymentModal(true);
  };

  const confirmSale = async () => {
    // Garde de capacité (défense en profondeur — le bouton est déjà désactivé).
    if (!canCreateSale) {
      Alert.alert('Accès non autorisé', "Vous n'êtes pas autorisé à enregistrer une vente.");
      return;
    }
    // Client par défaut = comptant (la vente cash n'exige pas de client choisi).
    const customerId = selectedCustomer || 'cash';
    // Validations
    if (cart.length === 0) {
      Alert.alert('Panier vide', 'Ajoutez des produits avant de valider');
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
    if (paymentMethod === 'credit' && customerId === 'cash') {
      Alert.alert(
        'Client requis',
        'Impossible de vendre à crédit à un client comptant.\nVeuillez sélectionner un client enregistré.'
      );
      return;
    }

    // Date d'échéance obligatoire pour une vente à crédit (requise par l'API + notifications)
    if (paymentMethod === 'credit' && !dueDate) {
      Alert.alert(
        "Date d'échéance requise",
        "Veuillez choisir une date d'échéance pour la vente à crédit."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const customer = customers.find(c => c.id === customerId);
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
          customerId,
          customer?.credit_limit || 0,
          amount
        );
        if (creditError) {
          Alert.alert('Plafond de credit atteint', creditError);
          setIsSubmitting(false);
          return;
        }

        // On joint les canaux de relance choisis aux notes de la créance.
        const channelsSummary = reminderChannelsSummary();
        const receivableNotes = channelsSummary
          ? `${itemsDescription}\nRelances: ${channelsSummary}`
          : itemsDescription;

        await createReceivableOffline({
          shopId,
          customerId,
          amount: amount,
          description: `Vente à crédit - ${getTotalItems()} article(s)`,
          notes: receivableNotes,
          dueDate,
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
          customerId: customerId !== 'cash' ? customerId : undefined,
        });
      }

      // Create sale record with local stock deduction
      await createSaleOffline({
        shopId,
        cashierId: userId,
        customerId: customerId !== 'cash' ? customerId : null,
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
        dueDate: paymentMethod === 'credit' ? dueDate : undefined,
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
            customerId !== 'cash' && customer
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

      // Génération de facture pilotée par le toggle "Générer une facture".
      // Si activé, on ouvre directement les actions de facture (partage/PDF) ;
      // sinon on propose tout de même un bouton "Facture" dans le récapitulatif.
      const invoiceButtons = generateInvoice
        ? [{ text: 'OK', onPress: resetForm }]
        : [
            {
              text: 'Facture',
              onPress: () => {
                showInvoiceActions(buildInvoiceData());
                resetForm();
              },
            },
            { text: 'OK', onPress: resetForm },
          ];

      if (generateInvoice) {
        // Le toggle est ON : on génère la facture immédiatement.
        showInvoiceActions(buildInvoiceData());
      }

      if (paymentMethod === 'credit') {
        Alert.alert(
          'Vente a credit enregistree',
          `Client: ${customerName}\nMontant: ${formatMoney(amount)}\n\n✓ Creance creee\n✓ Stock mis a jour\n\nLe solde caisse n'est pas impacte.`,
          invoiceButtons
        );
      } else {
        Alert.alert(
          'Vente enregistree',
          `Client: ${customerName}\nMontant: ${formatMoney(amount)}\nMode: Especes\n\n✓ Entree caisse creee\n✓ Stock mis a jour\n✓ Solde caisse +${formatMoney(amount)}`,
          invoiceButtons
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
    setShowCartSheet(false);
    setTotalPrice('');
    setOverridePrice(false);
    setPricingNotes('');
    setSelectedCustomer('');
    setPaymentMethod('cash');
    setDueDate('');
    setGenerateInvoice(true);
    setReminderChannels({ sms: true, wa: true, email: false });
    setShowPaymentModal(false);
  };

  // Vider entièrement le panier (bouton corbeille de la barre compacte).
  const clearCart = () => {
    if (cart.length === 0) return;
    Alert.alert('Vider le panier', 'Retirer tous les articles du panier ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Vider',
        style: 'destructive',
        onPress: () => {
          setCart([]);
          setShowCartSheet(false);
        },
      },
    ]);
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
    product.name ||
    [product.article_type, product.brand].filter(Boolean).join(' ') ||
    product.family;

  // Index rapide des conditionnements par id (recalculé quand la liste change).
  const packagingById = useMemo(() => {
    const map = new Map<string, LocalPackagingType>();
    packagingTypes.forEach(pt => map.set(pt.id, pt));
    return map;
  }, [packagingTypes]);

  // Conditionnement "non trivial" d'un produit : on ignore les unités de base
  // (Pièce/Unité) qui ne représentent pas un vrai conditionnement groupé.
  const TRIVIAL_PACKAGING = ['pièce', 'piece', 'unité', 'unite', 'u'];
  const packagingFor = (product: SaleProduct): PackagingInfo | null => {
    if (!product.packaging_type_id) return null;
    const pt = packagingById.get(product.packaging_type_id);
    if (!pt) return null;
    const nameKey = pt.name.trim().toLowerCase();
    if (TRIVIAL_PACKAGING.includes(nameKey)) return null;
    // Quantité par conditionnement : champ produit `units_per_package` en priorité
    // (source de vérité), sinon nombre réellement présent dans le nom/symbole.
    let qty = product.units_per_package ?? null;
    if (!qty) {
      const qtyMatch = `${pt.name} ${pt.symbol ?? ''}`.match(/\d+/);
      qty = qtyMatch ? parseInt(qtyMatch[0], 10) : null;
    }
    return { name: pt.name, symbol: pt.symbol, qty };
  };

  // Libellé d'un badge de conditionnement (ex. "Carton ×24" ou "Carton").
  const packagingBadgeLabel = (pkg: PackagingInfo): string =>
    pkg.qty ? `${pkg.name} ×${pkg.qty}` : pkg.name;

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

  // --- Date d'échéance (vente à crédit) ---
  // Renvoie une date ISO décalée de `days` jours à partir d'aujourd'hui (heure midi pour éviter les soucis de fuseau).
  const isoInDays = (days: number): string => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  // Libellé court d'une date ISO (JJ/MM/AAAA) pour l'affichage.
  const formatDueDate = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('fr-FR');
  };

  // Conversion entre la date ISO complète (état `dueDate`) et la clé jour
  // (YYYY-MM-DD) attendue par le sélecteur de date.
  const dueDateKey = (iso: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Sélection depuis le date picker (YYYY-MM-DD) -> ISO complet à midi (fuseau-safe).
  const handleDueDateSelect = (isoDay: string) => {
    if (!isoDay) {
      setDueDate('');
      return;
    }
    const [y, m, day] = isoDay.split('-').map(Number);
    const d = new Date(y, m - 1, day, 12, 0, 0, 0);
    setDueDate(d.toISOString());
  };

  // Date minimale sélectionnable : aujourd'hui (une échéance est forcément future).
  const today = new Date();

  // Raccourcis d'échéance proposés au vendeur.
  const dueDatePresets: Array<{ label: string; days: number }> = [
    { label: '7 jours', days: 7 },
    { label: '15 jours', days: 15 },
    { label: '30 jours', days: 30 },
  ];

  // Bascule un canal de relance (SMS / WhatsApp / email).
  const toggleReminderChannel = (channel: 'sms' | 'wa' | 'email') => {
    setReminderChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
  };

  // Résumé texte des canaux de relance actifs (joint aux notes de la créance).
  const reminderChannelsSummary = (): string => {
    const active: string[] = [];
    if (reminderChannels.sms) active.push('SMS');
    if (reminderChannels.wa) active.push('WhatsApp');
    if (reminderChannels.email) active.push('Email');
    return active.join(', ');
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
            const packaging = packagingFor(product);
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
                  {packaging && (
                    <View style={styles.packagingBadge}>
                      <Text style={styles.packagingBadgeText} numberOfLines={1}>
                        {packagingBadgeLabel(packaging)}
                      </Text>
                    </View>
                  )}
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

      {/* Barre compacte du panier (maquette swalo_vente) — corbeille + total.
          Visible dès qu'il y a des articles et que le sheet est replié. */}
      {cart.length > 0 && !showCartSheet && (
        <View style={styles.cartBar}>
          <TouchableOpacity
            style={styles.cartBarTrash}
            onPress={clearCart}
            activeOpacity={0.85}
            accessibilityLabel="Vider le panier"
          >
            <Trash size={20} color={Colors.danger.main} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cartBarMain}
            onPress={() => setShowCartSheet(true)}
            activeOpacity={0.9}
          >
            <View style={styles.cartBarCount}>
              <Text style={styles.cartBarCountText}>{getTotalItems()}</Text>
            </View>
            <Text style={styles.cartBarLabel}>Encaisser</Text>
            <Text style={styles.cartBarTotal}>{formatMoney(computedTotal)}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom-sheet "Encaisser" — déployé au tap sur la barre compacte */}
      <Modal
        visible={showCartSheet && cart.length > 0}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCartSheet(false)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setShowCartSheet(false)}
        >
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <TouchableOpacity
              style={styles.sheetHandleTouch}
              onPress={() => setShowCartSheet(false)}
              activeOpacity={0.8}
            >
              <View style={styles.sheetHandle} />
            </TouchableOpacity>

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
                    <TextInput
                      style={styles.stepperValue}
                      value={String(item.quantity)}
                      onChangeText={text => setExactQuantity(item.productId, text, item.batchId)}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      maxLength={6}
                      returnKeyType="done"
                      accessibilityLabel={`Quantité de ${item.productName}`}
                    />
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

            {/* Ajouter un client (ouvre le sélecteur + options de prix) */}
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

            {/* Générer une facture (toggle, ON par défaut) */}
            <View style={styles.invoiceRow}>
              <View style={styles.invoiceIcon}>
                <FileText size={18} color={Colors.action} />
              </View>
              <View style={styles.invoiceTextWrap}>
                <Text style={styles.invoiceTitle}>Générer une facture</Text>
                <Text style={styles.invoiceSubtitle}>PDF numéroté · prêt à envoyer</Text>
              </View>
              <Switch
                value={generateInvoice}
                onValueChange={setGenerateInvoice}
                trackColor={{ false: Colors.muted.main, true: Colors.action }}
                thumbColor={Colors.surface}
                ios_backgroundColor={Colors.muted.main}
              />
            </View>

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

            {/* Bloc crédit inline (carte crème/orange) — visible en mode Crédit */}
            {paymentMethod === 'credit' && (
              <View style={styles.creditCard}>
                <View style={styles.creditCardHeading}>
                  <Calendar size={16} color={Colors.warning.text} />
                  <Text style={styles.creditCardHeadingText}>Date d'échéance *</Text>
                </View>

                {/* Raccourcis d'échéance */}
                <View style={styles.dueDatePresets}>
                  {dueDatePresets.map(preset => {
                    const iso = isoInDays(preset.days);
                    const active = dueDateKey(dueDate) === dueDateKey(iso);
                    return (
                      <TouchableOpacity
                        key={preset.days}
                        style={[styles.dueDateChip, active && styles.dueDateChipActive]}
                        onPress={() => setDueDate(iso)}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[styles.dueDateChipText, active && styles.dueDateChipTextActive]}
                        >
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Sélecteur de date (calendrier) */}
                <DatePickerField
                  value={dueDateKey(dueDate)}
                  onChange={handleDueDateSelect}
                  placeholder="Choisir une date d'échéance"
                  minDate={today}
                />

                {dueDate ? (
                  <Text style={styles.dueDateSelected}>Échéance : {formatDueDate(dueDate)}</Text>
                ) : (
                  <Text style={styles.echeanceEmpty}>Aucune échéance choisie</Text>
                )}

                {/* Canaux de relance */}
                <Text style={styles.channelsLabel}>Canaux de relance</Text>
                <View style={styles.channelsRow}>
                  <TouchableOpacity
                    style={[styles.channelPill, reminderChannels.sms && styles.channelPillSms]}
                    onPress={() => toggleReminderChannel('sms')}
                    activeOpacity={0.85}
                  >
                    <Smartphone
                      size={14}
                      color={reminderChannels.sms ? Colors.onMarine : Colors.textColors.tertiary}
                    />
                    <Text
                      style={[
                        styles.channelPillText,
                        reminderChannels.sms && styles.channelPillTextActive,
                      ]}
                    >
                      SMS
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.channelPill, reminderChannels.wa && styles.channelPillWa]}
                    onPress={() => toggleReminderChannel('wa')}
                    activeOpacity={0.85}
                  >
                    <Send
                      size={14}
                      color={reminderChannels.wa ? Colors.onMarine : Colors.textColors.tertiary}
                    />
                    <Text
                      style={[
                        styles.channelPillText,
                        reminderChannels.wa && styles.channelPillTextActive,
                      ]}
                    >
                      WA
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.channelPill,
                      reminderChannels.email ? styles.channelPillEmailOn : styles.channelPillOff,
                    ]}
                    onPress={() => toggleReminderChannel('email')}
                    activeOpacity={0.85}
                  >
                    <Mail
                      size={14}
                      color={reminderChannels.email ? Colors.onMarine : Colors.textColors.disabled}
                    />
                    <Text
                      style={[
                        styles.channelPillText,
                        reminderChannels.email
                          ? styles.channelPillTextActive
                          : styles.channelPillTextOff,
                      ]}
                    >
                      @ {reminderChannels.email ? 'on' : 'off'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* CTA final — Cash : encaisse direct ; Crédit : nécessite une échéance */}
            {(() => {
              const creditMode = paymentMethod === 'credit';
              const disabled = !canCreateSale || isSubmitting || (creditMode && !dueDate);
              return (
                <TouchableOpacity
                  style={[
                    styles.encaisserButton,
                    creditMode && styles.validerCreditButton,
                    disabled && styles.encaisserButtonDisabled,
                  ]}
                  onPress={confirmSale}
                  disabled={disabled}
                  activeOpacity={0.9}
                >
                  <Text style={styles.encaisserButtonText}>
                    {!canCreateSale
                      ? 'Accès non autorisé'
                      : isSubmitting
                        ? 'Enregistrement…'
                        : creditMode
                          ? 'Valider à crédit'
                          : 'Encaisser en cash'}
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
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
            <Text style={styles.modalTitle}>Client & prix</Text>

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

              {/* Le mode de paiement, l'échéance et les canaux de relance sont
                  désormais gérés directement dans le bottom-sheet "Encaisser". */}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={() => setShowPaymentModal(false)}
              >
                <Text style={styles.modalConfirmButtonText}>Appliquer</Text>
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
            <Text style={styles.modalTitle}>Conditionnement</Text>
            {priceModalProduct && (
              <Text style={styles.condSubtitle}>
                {productLabel(priceModalProduct)} · choisissez l'unité de vente
              </Text>
            )}

            <ScrollView>
              {/* Carton complet (ex. Carton de 24) — vendu au PRIX DE GROS */}
              {(() => {
                if (!priceModalProduct) return null;
                const pkg = packagingFor(priceModalProduct);
                const packQty = pkg?.qty ?? null;
                const packPrice = priceModalProduct.package_price ?? null;
                if (!pkg || !packQty || !packPrice) return null;
                const perPiece = Math.round(packPrice / packQty);
                return (
                  <TouchableOpacity
                    style={styles.condRow}
                    onPress={() => handlePackSelection(priceModalProduct, packQty, packPrice)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.condIcon}>
                      <Package size={20} color={Colors.success.main} />
                    </View>
                    <View style={styles.condInfo}>
                      <Text style={styles.condTitle}>{pkg.name} · Gros</Text>
                      <Text style={styles.condSub}>
                        {packQty} {priceModalProduct.unit} · soit {formatMoney(perPiece)} /{' '}
                        {priceModalProduct.unit}
                      </Text>
                    </View>
                    <Text style={styles.condPrice}>{formatMoney(packPrice)}</Text>
                  </TouchableOpacity>
                );
              })()}

              {priceOptions.map((option, index) => {
                const unitTitle = 'Pièce · Détail';
                const lotLabel = `${option.batch_count} lot${option.batch_count > 1 ? 's' : ''}`;
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.condRow}
                    onPress={() => handlePriceSelection(option)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.condIcon}>
                      <Package size={20} color={Colors.action} />
                    </View>
                    <View style={styles.condInfo}>
                      <Text style={styles.condTitle}>{unitTitle}</Text>
                      <Text style={styles.condSub}>
                        {option.total_quantity} en stock · {lotLabel}
                      </Text>
                    </View>
                    <Text style={styles.condPrice}>{formatMoney(option.sell_price)}</Text>
                  </TouchableOpacity>
                );
              })}
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
    // Laisse la place à la barre compacte du panier ancrée en bas.
    paddingBottom: 96,
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
  // Badge de conditionnement (teal/vert) — distinct du badge MULTI-PRIX bleu.
  packagingBadge: {
    backgroundColor: Colors.success.background,
    borderWidth: 1,
    borderColor: Colors.success.main,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  packagingBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: Colors.success.text,
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
  // --- Barre compacte du panier (état replié) ---
  cartBar: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cartBarTrash: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.danger.background,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  cartBarMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.action,
    paddingHorizontal: Spacing.lg,
    ...Shadows.sm,
  },
  cartBarCount: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBarCountText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  cartBarLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.onMarine,
  },
  cartBarTotal: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.onMarine,
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
  sheetHandleTouch: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.borderStrong,
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
    minWidth: 36,
    height: 30,
    paddingVertical: 0,
    paddingHorizontal: 2,
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
  encaisserButtonDisabled: {
    backgroundColor: Colors.muted.main,
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
  dueDateSubLabel: {
    fontSize: 12,
    color: Colors.muted.foreground,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  dueDatePresets: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dueDateChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  dueDateChipActive: {
    borderColor: Colors.action,
    backgroundColor: Colors.primary[50],
  },
  dueDateChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
  },
  dueDateChipTextActive: {
    color: Colors.action,
  },
  dueDateSelected: {
    marginTop: Spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.action,
  },
  dueDateHint: {
    marginTop: Spacing.sm,
    fontSize: 12,
    color: Colors.muted.foreground,
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
  // --- Toggle "Générer une facture" (sheet Encaisser) ---
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  invoiceIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  invoiceTextWrap: {
    flex: 1,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  invoiceSubtitle: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: 1,
  },
  // --- Bloc crédit inline (carte crème/orange) ---
  creditCard: {
    backgroundColor: Colors.warning.background,
    borderWidth: 1,
    borderColor: Colors.warning.main,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  creditCardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  creditCardHeadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.warning.text,
  },
  echeanceEmpty: {
    marginTop: Spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.warning.main,
  },
  channelsLabel: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.warning.text,
  },
  channelsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  channelPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  channelPillSms: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  channelPillWa: {
    backgroundColor: Colors.success.main,
    borderColor: Colors.success.main,
  },
  channelPillEmailOn: {
    backgroundColor: Colors.action,
    borderColor: Colors.action,
  },
  channelPillOff: {
    backgroundColor: Colors.muted.main,
    borderColor: Colors.border,
  },
  channelPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textColors.tertiary,
  },
  channelPillTextActive: {
    color: Colors.onMarine,
  },
  channelPillTextOff: {
    color: Colors.textColors.disabled,
  },
  validerCreditButton: {
    backgroundColor: Colors.action,
  },
  // --- Sheet Conditionnement ---
  condSubtitle: {
    fontSize: 13,
    color: Colors.textColors.tertiary,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  condRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.surface,
  },
  condIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
  },
  condInfo: {
    flex: 1,
  },
  condTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  condSub: {
    fontSize: 12,
    color: Colors.textColors.tertiary,
    marginTop: 2,
  },
  condPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary[900],
  },
});
