import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  productsApi,
  productBatchesApi,
  customersApi,
  salesApi,
  cashApi,
  receivablesApi,
} from '../lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  family?: string;
  brand?: string;
  reference?: string;
  cost_price: number;
  sell_price: number;
  alert_threshold: number;
  is_active: boolean;
  current_stock?: number;
  is_multi_price?: boolean;
  price_min?: number;
  price_max?: number;
}

interface Customer {
  id: string;
  name: string;
  first_name?: string;
  phone?: string;
  credit_limit?: number;
}

interface PriceOption {
  sell_price: number;
  available_qty: number;
}

interface CartItem {
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  batchId?: string;
}

type PaymentMethod = 'cash' | 'credit';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formate un montant entier FCFA avec separateurs de milliers. */
const formatFCFA = (amount: number): string => amount.toLocaleString('fr-FR') + ' FCFA';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Sale() {
  // --- Data state ---
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // --- UI filters ---
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // --- Cart ---
  const [cart, setCart] = useState<CartItem[]>([]);

  // --- Customer & payment ---
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // --- Multi-price modal ---
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [priceModalProduct, setPriceModalProduct] = useState<Product | null>(null);
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([]);
  const [priceOptionsLoading, setPriceOptionsLoading] = useState(false);

  // --- Loading / feedback ---
  const [productsLoading, setProductsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // =========================================================================
  // Data loading
  // =========================================================================

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await productsApi.getAll({
        search: search || undefined,
        category: selectedCategory || undefined,
      });
      setProducts(data);
    } catch (err) {
      console.error('Erreur chargement produits:', err);
    } finally {
      setProductsLoading(false);
    }
  }, [search, selectedCategory]);

  const loadCategories = useCallback(async () => {
    try {
      const data = await productsApi.getCategories();
      setCategories(data);
    } catch (err) {
      console.error('Erreur chargement categories:', err);
    }
  }, []);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await customersApi.getAll();
      setCustomers(data);
    } catch (err) {
      console.error('Erreur chargement clients:', err);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadCustomers();
  }, [loadCategories, loadCustomers]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Reset payment method when customer changes
  useEffect(() => {
    if (!selectedCustomerId && paymentMethod === 'credit') {
      setPaymentMethod('cash');
    }
  }, [selectedCustomerId, paymentMethod]);

  // =========================================================================
  // Computed values
  // =========================================================================

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0),
    [cart]
  );

  const totalItems = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);

  /** Map productId -> total qty in cart (across batches). */
  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.productId, (map.get(item.productId) || 0) + item.qty);
    }
    return map;
  }, [cart]);

  // =========================================================================
  // Cart operations
  // =========================================================================

  const addToCart = async (product: Product) => {
    // Check if multi-price
    if (product.is_multi_price) {
      setPriceModalProduct(product);
      setPriceOptionsLoading(true);
      setPriceModalOpen(true);
      try {
        const prices = await productBatchesApi.getAvailablePrices(product.id);
        setPriceOptions(
          Array.isArray(prices)
            ? prices.map((p: any) => ({
                sell_price: p.sell_price ?? p.price ?? 0,
                available_qty: p.available_qty ?? p.quantity ?? p.total_quantity ?? 0,
              }))
            : []
        );
      } catch (err) {
        console.error('Erreur chargement prix:', err);
        setPriceOptions([]);
      } finally {
        setPriceOptionsLoading(false);
      }
      return;
    }

    // Single price -- add directly
    addItemToCart(product, product.sell_price);
  };

  const addItemToCart = (product: Product, unitPrice: number, batchId?: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id && item.batchId === batchId);

      if (existing) {
        // Check stock
        const currentStock = product.current_stock ?? 0;
        const totalInCart = cartQtyByProduct.get(product.id) || 0;
        if (totalInCart >= currentStock) {
          setErrorMessage(`Stock insuffisant pour ${product.name} (${currentStock} disponibles)`);
          setTimeout(() => setErrorMessage(''), 3000);
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id && item.batchId === batchId
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }

      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          qty: 1,
          unitPrice,
          batchId,
        },
      ];
    });
  };

  const handlePriceSelection = (option: PriceOption) => {
    if (!priceModalProduct) return;
    addItemToCart(priceModalProduct, option.sell_price);
    closePriceModal();
  };

  const closePriceModal = () => {
    setPriceModalOpen(false);
    setPriceModalProduct(null);
    setPriceOptions([]);
  };

  const updateQty = (index: number, delta: number) => {
    setCart(prev => {
      const item = prev[index];
      if (!item) return prev;

      const newQty = item.qty + delta;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }

      // Check stock limit
      const product = products.find(p => p.id === item.productId);
      const currentStock = product?.current_stock ?? 0;
      const otherQty = prev
        .filter((_, i) => i !== index)
        .filter(c => c.productId === item.productId)
        .reduce((s, c) => s + c.qty, 0);
      if (newQty + otherQty > currentStock) {
        setErrorMessage(`Stock insuffisant pour ${item.productName} (${currentStock} disponibles)`);
        setTimeout(() => setErrorMessage(''), 3000);
        return prev;
      }

      return prev.map((c, i) => (i === index ? { ...c, qty: newQty } : c));
    });
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // =========================================================================
  // Checkout
  // =========================================================================

  const handleCheckout = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    if (cart.length === 0) {
      setErrorMessage('Le panier est vide.');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      setErrorMessage('Veuillez selectionner un client pour une vente a credit.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the sale
      const salePayload = {
        customer_id: selectedCustomerId || undefined,
        items: cart.map(item => ({
          product_id: item.productId,
          qty: item.qty,
          unit_price: item.unitPrice,
        })),
        status: 'COMPLETED' as const,
        notes: paymentMethod === 'credit' ? 'Vente a credit' : 'Vente au comptant',
      };

      const createdSale = await salesApi.create(salePayload);

      // 2. Create cash entry or receivable
      if (paymentMethod === 'cash') {
        await cashApi.createEntry({
          type: 'IN',
          category: 'ventes',
          amount: cartTotal,
          note: `Vente #${createdSale?.id?.slice(0, 8) || ''} - ${totalItems} article(s)`,
        });
      } else {
        // Credit sale
        await receivablesApi.create({
          customer_id: selectedCustomerId,
          amount: cartTotal,
          description: `Vente a credit #${createdSale?.id?.slice(0, 8) || ''} - ${totalItems} article(s)`,
        });
      }

      // 3. Success
      const customerLabel = selectedCustomerId
        ? (() => {
            const c = customers.find(cu => cu.id === selectedCustomerId);
            return c ? (c.first_name ? `${c.first_name} ${c.name}` : c.name) : '';
          })()
        : 'Client comptant';

      setSuccessMessage(
        paymentMethod === 'cash'
          ? `Vente enregistree - ${formatFCFA(cartTotal)} (especes) - ${customerLabel}`
          : `Vente a credit enregistree - ${formatFCFA(cartTotal)} - ${customerLabel}`
      );

      // 4. Reset cart & reload products
      setCart([]);
      setSelectedCustomerId('');
      setPaymentMethod('cash');
      await loadProducts();

      // Auto-dismiss success after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      console.error('Erreur lors de la vente:', err);
      setErrorMessage(
        err?.response?.data?.message || "Erreur lors de l'enregistrement de la vente."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col animate-fade-in">
      {/* Feedback banners */}
      {successMessage && (
        <div className="mx-4 mt-2 p-3 bg-success-50 border border-success-200 text-success-800 rounded-lg text-sm flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage('')}
            className="ml-4 text-success-600 hover:text-success-800 font-bold"
          >
            &times;
          </button>
        </div>
      )}
      {errorMessage && (
        <div className="mx-4 mt-2 p-3 bg-danger-50 border border-danger-200 text-danger-800 rounded-lg text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage('')}
            className="ml-4 text-danger-600 hover:text-danger-800 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden mt-2">
        {/* ================================================================
            LEFT SIDE - Product grid (2/3)
            ================================================================ */}
        <div className="w-2/3 flex flex-col border-r border-slate-200">
          {/* Search bar + category filter */}
          <div className="p-4 border-b border-slate-200 bg-white space-y-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Rechercher un produit (nom, SKU, marque...)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-10"
              />
            </div>

            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === ''
                      ? 'bg-action-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Toutes
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(selectedCategory === cat ? '' : cat)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-action-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products grid */}
          <div className="flex-1 overflow-y-auto p-4 bg-canvas">
            {productsLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 spinner" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <svg
                  className="w-16 h-16 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                <p className="text-lg font-medium">Aucun produit trouve</p>
                <p className="text-sm mt-1">
                  {search
                    ? 'Essayez avec un autre terme de recherche.'
                    : 'Aucun produit actif dans cette boutique.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {products.map(product => {
                  const inCartQty = cartQtyByProduct.get(product.id) || 0;
                  const stock = product.current_stock ?? 0;
                  const isOutOfStock = stock <= 0;

                  return (
                    <button
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      disabled={isOutOfStock}
                      className={`relative flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-150 ${
                        isOutOfStock
                          ? 'bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed'
                          : inCartQty > 0
                            ? 'bg-action-50 border-action-300 shadow-sm hover:shadow-md'
                            : 'bg-white border-slate-200 hover:border-action-300 hover:shadow-sm'
                      }`}
                    >
                      {/* Cart qty badge */}
                      {inCartQty > 0 && (
                        <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-action-500 text-white text-xs font-bold flex items-center justify-center shadow">
                          {inCartQty}
                        </span>
                      )}

                      {/* Multi-price badge */}
                      {product.is_multi_price && (
                        <span className="badge bg-warning-100 text-warning-800 mb-1 text-[10px]">
                          Multi-prix
                        </span>
                      )}

                      <p className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight">
                        {product.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{product.sku}</p>

                      <div className="mt-auto pt-2 w-full">
                        {product.is_multi_price ? (
                          <p className="text-xs font-medium text-warning-700">
                            {formatFCFA(product.price_min ?? product.sell_price)} -{' '}
                            {formatFCFA(product.price_max ?? product.sell_price)}
                          </p>
                        ) : (
                          <p className="text-sm font-bold text-action-700">
                            {formatFCFA(product.sell_price)}
                          </p>
                        )}
                        <p
                          className={`text-xs mt-0.5 font-medium ${
                            stock <= (product.alert_threshold || 0)
                              ? 'text-danger-600'
                              : 'text-success-600'
                          }`}
                        >
                          {stock} en stock
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ================================================================
            RIGHT SIDE - Cart panel (1/3)
            ================================================================ */}
        <div className="w-1/3 flex flex-col bg-white">
          {/* Cart header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-action-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-slate-900">Panier</h2>
            </div>
            {cart.length > 0 && (
              <span className="badge-primary">
                {totalItems} article{totalItems > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <svg
                  className="w-12 h-12 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"
                  />
                </svg>
                <p className="text-sm font-medium">Panier vide</p>
                <p className="text-xs mt-1">Cliquez sur un produit pour l'ajouter</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={`${item.productId}_${item.batchId ?? 'default'}_${index}`}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 animate-slide-in"
                >
                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.productName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatFCFA(item.unitPrice)} x {item.qty} ={' '}
                      <span className="font-semibold text-slate-700">
                        {formatFCFA(item.unitPrice * item.qty)}
                      </span>
                    </p>
                  </div>

                  {/* Qty controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(index, -1)}
                      className="w-7 h-7 rounded-md bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 12H4"
                        />
                      </svg>
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-slate-900">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(index, 1)}
                      className="w-7 h-7 rounded-md bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </button>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(index)}
                    className="w-7 h-7 rounded-md text-danger-500 hover:bg-danger-50 flex items-center justify-center transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart footer: customer, payment, total, validate */}
          <div className="border-t border-slate-200 p-4 space-y-4 bg-white">
            {/* Customer select */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Client</label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="input text-sm"
              >
                <option value="">Client comptant</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name ? `${c.first_name} ${c.name}` : c.name}
                    {c.phone ? ` (${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Mode de paiement
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                    paymentMethod === 'cash'
                      ? 'border-action-500 bg-action-50 text-action-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Especes
                </button>
                <button
                  onClick={() => selectedCustomerId && setPaymentMethod('credit')}
                  disabled={!selectedCustomerId}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-colors ${
                    paymentMethod === 'credit'
                      ? 'border-action-500 bg-action-50 text-action-700'
                      : !selectedCustomerId
                        ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Credit
                </button>
              </div>
              {paymentMethod === 'credit' && (
                <p className="text-xs text-warning-600 mt-1">
                  Une vente a credit cree une creance. Le solde caisse n'est pas impacte.
                </p>
              )}
            </div>

            {/* Total */}
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-xs text-slate-500 mb-1">Total</p>
              <p className="text-3xl font-bold text-slate-900">{formatFCFA(cartTotal)}</p>
            </div>

            {/* Validate button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || submitting}
              className={`w-full py-3 rounded-xl text-base font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                cart.length === 0 || submitting
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-success-600 text-white hover:bg-success-700 shadow-sm hover:shadow-md'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 spinner border-white border-t-transparent" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Valider la vente</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================
          Multi-price modal
          ================================================================ */}
      {priceModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-medium animate-scale-in overflow-hidden">
            {/* Modal header */}
            <div className="px-6 py-4 bg-gradient-to-r from-warning-500 to-warning-600">
              <div className="flex items-center justify-between text-white">
                <div>
                  <h3 className="text-lg font-bold">Choisir le prix</h3>
                  {priceModalProduct && (
                    <p className="text-sm text-white/80 mt-0.5">{priceModalProduct.name}</p>
                  )}
                </div>
                <button
                  onClick={closePriceModal}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-3">
                Ce produit a plusieurs prix actifs. Selectionnez le prix applicable.
              </p>

              {priceOptionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 spinner" />
                </div>
              ) : priceOptions.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Aucun prix disponible.</p>
              ) : (
                priceOptions.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handlePriceSelection(option)}
                    className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-action-300 hover:bg-action-50 transition-all text-left"
                  >
                    <div>
                      <p className="text-lg font-bold text-action-700">
                        {formatFCFA(option.sell_price)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {option.available_qty} unite{option.available_qty > 1 ? 's' : ''} disponible
                        {option.available_qty > 1 ? 's' : ''}
                      </p>
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                ))
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 pb-6">
              <button onClick={closePriceModal} className="btn-secondary w-full">
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
