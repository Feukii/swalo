import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

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
}

interface Stats {
  total_products: number;
  active_products: number;
  low_stock_count: number;
  total_inventory_value: number;
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
    } catch (error: any) {
      alert(error.response?.data?.message || "Erreur lors de l'enregistrement");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-sky-400 via-action-500 to-action-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm">Total Produits</p>
                <p className="text-3xl font-bold mt-1">{stats.total_products}</p>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                P
              </div>
            </div>
          </div>
          <div className="card">
            <p className="text-slate-500 text-sm">Actifs</p>
            <p className="text-3xl font-bold text-success-600 mt-1">{stats.active_products}</p>
          </div>
          <div className="card">
            <p className="text-slate-500 text-sm">Stock Faible</p>
            <p
              className={`text-3xl font-bold mt-1 ${stats.low_stock_count > 0 ? 'text-danger-600' : 'text-success-600'}`}
            >
              {stats.low_stock_count}
            </p>
          </div>
          <div className="card">
            <p className="text-slate-500 text-sm">Valeur Inventaire</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(stats.total_inventory_value)}
            </p>
          </div>
        </div>
      )}

      {/* Search & Actions */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div className="flex-1 w-full md:w-auto flex gap-3">
            <div className="relative flex-1">
              <svg
                className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
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
                placeholder="Rechercher un produit..."
                className="input pl-10"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="input w-auto"
            >
              <option value="">Toutes categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="btn-primary flex items-center gap-2 whitespace-nowrap"
          >
            <span>+</span>
            <span>Nouveau produit</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Catalogue produits</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">
              {searchTerm ? 'Aucun produit trouve' : 'Aucun produit enregistre'}
            </p>
            {!searchTerm && (
              <button onClick={() => handleOpenModal()} className="btn-primary mt-4">
                Creer le premier produit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Categorie
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Prix Achat
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Prix Vente
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-900">{product.sku}</td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{product.name}</p>
                      {product.description && (
                        <p className="text-sm text-slate-500 truncate max-w-xs">
                          {product.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{product.category || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 text-right">
                      {formatCurrency(product.cost_price)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {product.is_multi_price ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(product.price_min || 0)} -{' '}
                            {formatCurrency(product.price_max || 0)}
                          </span>
                          <span className="badge bg-warning-100 text-warning-800 text-xs">
                            Multi-prix
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-slate-900">
                          {formatCurrency(product.sell_price)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`badge ${product.is_low_stock ? 'badge-danger' : 'badge-success'}`}
                      >
                        {product.current_stock ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`badge ${product.is_active ? 'badge-success' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {product.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => navigate(`/products/${product.id}/batches`)}
                          className="text-action-600 hover:text-action-700 font-medium text-sm"
                        >
                          Lots
                        </button>
                        <button
                          onClick={() => handleOpenModal(product)}
                          className="text-action-600 hover:text-action-700 font-medium text-sm"
                        >
                          Modifier
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
