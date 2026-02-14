import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  cost_price: number;
  sell_price: number;
  current_stock?: number;
  alert_threshold: number;
  is_active: boolean;
  is_low_stock?: boolean;
  is_multi_price?: boolean;
}

interface Stats {
  total_products: number;
  active_products: number;
  low_stock_count: number;
  total_inventory_value: number;
}

type StockFilter = 'all' | 'low' | 'out' | 'ok';

export default function StockManagement() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');

  useEffect(() => {
    loadData();
  }, [searchTerm]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsData, statsData] = await Promise.all([
        productsApi.getAll({ search: searchTerm || undefined }),
        productsApi.getStats(),
      ]);
      setProducts(productsData);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur chargement stock:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const stock = p.current_stock ?? 0;
    switch (stockFilter) {
      case 'low': return stock > 0 && stock <= p.alert_threshold;
      case 'out': return stock <= 0;
      case 'ok': return stock > p.alert_threshold;
      default: return true;
    }
  });

  const lowStockProducts = products.filter(p => (p.current_stock ?? 0) > 0 && (p.current_stock ?? 0) <= p.alert_threshold);
  const outOfStockProducts = products.filter(p => (p.current_stock ?? 0) <= 0);

  const getStockColor = (product: Product) => {
    const stock = product.current_stock ?? 0;
    if (stock <= 0) return 'text-danger-600 bg-danger-50';
    if (stock <= product.alert_threshold) return 'text-warning-600 bg-warning-50';
    return 'text-success-600 bg-success-50';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card bg-gradient-to-br from-primary-500 to-primary-600 text-white">
            <p className="text-sm text-white/80">Valeur totale stock</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(stats.total_inventory_value)}</p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-sm">Produits actifs</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{stats.active_products}</p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-sm">Stock faible</p>
            <p className={`text-3xl font-bold mt-1 ${lowStockProducts.length > 0 ? 'text-warning-600' : 'text-success-600'}`}>
              {lowStockProducts.length}
            </p>
          </div>
          <div className="card">
            <p className="text-gray-500 text-sm">Rupture de stock</p>
            <p className={`text-3xl font-bold mt-1 ${outOfStockProducts.length > 0 ? 'text-danger-600' : 'text-success-600'}`}>
              {outOfStockProducts.length}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1 w-full">
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Rechercher un produit..."
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {([
              { value: 'all', label: 'Tous', count: products.length },
              { value: 'low', label: 'Stock faible', count: lowStockProducts.length },
              { value: 'out', label: 'Rupture', count: outOfStockProducts.length },
              { value: 'ok', label: 'En stock', count: products.length - lowStockProducts.length - outOfStockProducts.length },
            ] as const).map(f => (
              <button
                key={f.value}
                onClick={() => setStockFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  stockFilter === f.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Etat du stock</h2>

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="w-12 h-12 spinner"></div></div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun produit dans cette categorie</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categorie</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Seuil</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Prix achat</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valeur stock</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.map(product => {
                  const stock = product.current_stock ?? 0;
                  const stockValue = stock * product.cost_price;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-gray-900">{product.sku}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{product.name}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{product.category || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${getStockColor(product)}`}>
                          {stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-500">{product.alert_threshold}</td>
                      <td className="px-6 py-4 text-right text-sm text-gray-600">{formatCurrency(product.cost_price)}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">{formatCurrency(stockValue)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => navigate(`/products/${product.id}/batches`)}
                          className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                        >
                          Voir lots
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
