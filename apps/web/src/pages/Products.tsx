import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../lib/api';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  family?: string;
  brand?: string;
  unit?: string;
  cost_price: number;
  sell_price: number;
  current_stock?: number;
  alert_threshold: number;
  is_active: boolean;
  is_low_stock?: boolean;
  is_multi_price?: boolean;
  price_min?: number;
  price_max?: number;
  batches_count?: number;
}

interface Stats {
  total_products: number;
  active_products: number;
  low_stock_count: number;
  total_inventory_value: number;
}

/** Formatte un montant en centimes -> "12 345 F" (présentation, maquette). */
function formatF(cents: number): string {
  const amount = Math.round((cents ?? 0) / 100);
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

/** Formatte un montant en centimes en version compacte KPI -> "14,2 M F". */
function formatCompactF(cents: number): string {
  const amount = Math.round((cents ?? 0) / 100);
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })} M F`;
  }
  if (amount >= 10_000) {
    return `${(amount / 1_000).toLocaleString('fr-FR', {
      maximumFractionDigits: 1,
    })} k F`;
  }
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: '',
    unit: 'piece',
    cost_price: '',
    sell_price: '',
    alert_threshold: '10',
  });

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [productsData, statsData, categoriesData] = await Promise.all([
        productsApi.getAll({
          search: searchTerm || undefined,
          category: selectedCategory || undefined,
        }),
        productsApi.getStats(),
        productsApi.getCategories(),
      ]);
      setProducts(productsData);
      setStats(statsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, selectedCategory]);

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditProduct(product);
      setFormData({
        sku: product.sku,
        name: product.name,
        description: product.description || '',
        category: product.category || '',
        unit: product.unit || 'piece',
        cost_price: String(product.cost_price / 100),
        sell_price: String(product.sell_price / 100),
        alert_threshold: String(product.alert_threshold),
      });
    } else {
      setEditProduct(null);
      setFormData({
        sku: '',
        name: '',
        description: '',
        category: '',
        unit: 'piece',
        cost_price: '',
        sell_price: '',
        alert_threshold: '10',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditProduct(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      sku: formData.sku.trim(),
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      category: formData.category.trim() || undefined,
      unit: formData.unit,
      cost_price: Math.round(parseFloat(formData.cost_price) * 100),
      sell_price: Math.round(parseFloat(formData.sell_price) * 100),
      alert_threshold: parseInt(formData.alert_threshold) || 10,
    };

    try {
      if (editProduct) {
        await productsApi.update(editProduct.id, payload);
      } else {
        await productsApi.create(payload);
      }
      handleCloseModal();
      loadData();
    } catch (error) {
      const apiMessage = (
        error as { response?: { data?: { message?: string } } } | undefined
      )?.response?.data?.message;
      alert(apiMessage || "Erreur lors de l'enregistrement");
    }
  };

  // KPI calculés depuis la liste déjà chargée
  const totalRefs = stats?.total_products ?? products.length;
  const stockValue =
    stats?.total_inventory_value ??
    products.reduce((sum, p) => sum + (p.current_stock ?? 0) * p.cost_price, 0);
  const ruptureCount = products.filter(p => (p.current_stock ?? 0) <= 0).length;
  const alertCount =
    stats?.low_stock_count ??
    products.filter(p => p.is_low_stock && (p.current_stock ?? 0) > 0).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête de page */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-marine-900">Produits</h1>
        <p className="text-sm text-slate-500">Catalogue</p>
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Références totales</p>
          <p className="text-3xl font-bold text-marine-900 mt-2">
            {new Intl.NumberFormat('fr-FR').format(totalRefs)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Valeur du stock</p>
          <p className="text-3xl font-bold text-marine-900 mt-2">{formatCompactF(stockValue)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Ruptures</p>
          <p
            className={`text-3xl font-bold mt-2 ${
              ruptureCount > 0 ? 'text-danger-600' : 'text-marine-900'
            }`}
          >
            {ruptureCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Alertes stock</p>
          <p
            className={`text-3xl font-bold mt-2 ${
              alertCount > 0 ? 'text-warning-600' : 'text-marine-900'
            }`}
          >
            {alertCount}
          </p>
        </div>
      </div>

      {/* Catalogue & inventaire */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-marine-900">Catalogue &amp; inventaire</h2>
          <div className="flex items-center gap-3">
            {/* Recherche (logique conservée) */}
            <div className="relative hidden lg:block">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
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
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Rechercher..."
                className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-action-500 focus:border-action-500 transition-colors"
              />
            </div>
            {/* Filtrer par catégorie (logique conservée) */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 focus:ring-2 focus:ring-action-500 transition-colors"
            >
              <option value="">Filtrer</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-action-500 hover:bg-action-600 rounded-lg shadow-sm transition-colors whitespace-nowrap"
            >
              <span className="text-base leading-none">+</span>
              <span>Réception (lot)</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500">
              {searchTerm ? 'Aucun produit trouvé' : 'Aucun produit enregistré'}
            </p>
            {!searchTerm && (
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                Créer le premier produit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Lots
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    P. Achat
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    P. Vente
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Valeur
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(product => {
                  const stock = product.current_stock ?? 0;
                  const isRupture = stock <= 0;
                  const isLow = !isRupture && product.is_low_stock;
                  const lineValue = stock * product.cost_price;
                  return (
                    <tr
                      key={product.id}
                      onClick={() => navigate(`/products/${product.id}/batches`)}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {/* PRODUIT */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                              />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-marine-900 truncate">{product.name}</p>
                              {product.is_multi_price && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-100 text-sky-700">
                                  Multi
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 uppercase">{product.sku}</p>
                          </div>
                        </div>
                      </td>
                      {/* CATÉGORIE */}
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {product.category || product.family || '—'}
                      </td>
                      {/* STOCK */}
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`text-sm font-semibold ${
                            isRupture
                              ? 'text-danger-600'
                              : isLow
                                ? 'text-warning-600'
                                : 'text-marine-900'
                          }`}
                        >
                          {stock}
                        </span>
                      </td>
                      {/* LOTS */}
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {product.batches_count != null ? `${product.batches_count} lots` : '—'}
                      </td>
                      {/* P. ACHAT */}
                      <td className="px-6 py-4 text-sm text-slate-600 text-right">
                        {formatF(product.cost_price)}
                      </td>
                      {/* P. VENTE */}
                      <td className="px-6 py-4 text-right">
                        {product.is_multi_price ? (
                          <span className="text-sm font-medium text-marine-900">
                            {formatF(product.price_min || 0)} – {formatF(product.price_max || 0)}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-marine-900">
                            {formatF(product.sell_price)}
                          </span>
                        )}
                      </td>
                      {/* VALEUR */}
                      <td className="px-6 py-4 text-right text-sm font-semibold text-marine-900">
                        {formatF(lineValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-action-500 to-action-600 text-white rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">
                    {editProduct ? 'Modifier le produit' : 'Nouveau produit'}
                  </h2>
                  <p className="text-sm text-white/80 mt-1">
                    {editProduct
                      ? 'Mettre a jour les informations'
                      : 'Ajouter un nouveau produit au catalogue'}
                  </p>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    SKU <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Nom <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="input resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Categorie</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="input"
                    list="categories-list"
                  />
                  <datalist id="categories-list">
                    {categories.map(cat => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">Unite</label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                    className="input"
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kilogramme</option>
                    <option value="litre">Litre</option>
                    <option value="metre">Metre</option>
                    <option value="lot">Lot</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Prix Achat (FCFA) <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.cost_price}
                    onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Prix Vente (FCFA) <span className="text-danger-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={formData.sell_price}
                    onChange={e => setFormData({ ...formData, sell_price: e.target.value })}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    Seuil alerte
                  </label>
                  <input
                    type="number"
                    value={formData.alert_threshold}
                    onChange={e => setFormData({ ...formData, alert_threshold: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={handleCloseModal} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editProduct ? 'Mettre a jour' : 'Creer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
