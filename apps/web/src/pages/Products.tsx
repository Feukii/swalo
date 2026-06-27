import { useState, useEffect, useMemo } from 'react';
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

/** Formatte un montant en FCFA -> "12 345 F" (présentation, maquette). */
function formatF(value: number): string {
  const amount = Math.round(value ?? 0);
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

const CATEGORY_FALLBACK = 'Sans catégorie';

export default function Products() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

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

  // KPIs (présentation). Repli sur la liste si /stats absent.
  const totalRefs = stats?.total_products ?? products.length;
  const stockValue =
    stats?.total_inventory_value ??
    products.reduce((sum, p) => sum + (p.current_stock ?? 0) * p.cost_price, 0);
  const ruptureCount = products.filter(p => (p.current_stock ?? 0) <= 0).length;
  const alertCount =
    stats?.low_stock_count ??
    products.filter(p => p.is_low_stock && (p.current_stock ?? 0) > 0).length;

  // Groupage du catalogue par catégorie (présentation maquette).
  const groupedProducts = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const product of products) {
      const key = product.category || product.family || CATEGORY_FALLBACK;
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(product);
      } else {
        map.set(key, [product]);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], 'fr'));
  }, [products]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête de page */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary-900">Produits &amp; prix</h1>
        <p className="text-sm text-slate-500">Catalogue, prix de revient &amp; valorisation</p>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Références</p>
          <p className="text-3xl font-bold text-primary-900 mt-2">
            {new Intl.NumberFormat('fr-FR').format(totalRefs)}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Valeur du stock</p>
          <p className="text-3xl font-bold text-primary-900 mt-2">{formatF(stockValue)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Alertes seuil</p>
          <p
            className={`text-3xl font-bold mt-2 ${
              alertCount > 0 ? 'text-warning-600' : 'text-primary-900'
            }`}
          >
            {alertCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5">
          <p className="text-xs font-medium text-slate-500">Ruptures</p>
          <p
            className={`text-3xl font-bold mt-2 ${
              ruptureCount > 0 ? 'text-danger-600' : 'text-primary-900'
            }`}
          >
            {ruptureCount}
          </p>
        </div>
      </div>

      {/* Catalogue d'articles */}
      <div className="bg-white rounded-2xl shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-primary-900 whitespace-nowrap">
            Catalogue d&apos;articles
          </h2>
          <div className="flex flex-1 items-center gap-3 lg:justify-end flex-wrap">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
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
                placeholder="Rechercher un article..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-action-500 focus:border-action-500 transition-colors"
              />
            </div>
            {/* Chips catégories */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === ''
                    ? 'bg-primary-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-500">
              {searchTerm || selectedCategory ? 'Aucun article trouvé' : 'Aucun article enregistré'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Article
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Catégorie
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Seuil
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Prix revient
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    P. vente
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Valeur stock
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {groupedProducts.map(([categoryName, items]) => (
                  <CategoryGroup
                    key={categoryName}
                    categoryName={categoryName}
                    items={items}
                    onSelect={id => navigate(`/products/${id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Rend une en-tête de catégorie + ses lignes d'articles. */
function CategoryGroup({
  categoryName,
  items,
  onSelect,
}: {
  categoryName: string;
  items: Product[];
  onSelect: (id: string) => void;
}) {
  const unit = (p: Product) => p.unit || 'u.';
  return (
    <>
      {/* En-tête catégorie */}
      <tr className="bg-slate-50/70">
        <td colSpan={7} className="px-6 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {categoryName}
            </span>
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-semibold">
              {items.length}
            </span>
          </div>
        </td>
      </tr>
      {/* Lignes articles */}
      {items.map(product => {
        const stock = product.current_stock ?? 0;
        const isRupture = stock <= 0;
        const isLow = !isRupture && product.is_low_stock;
        const lineValue = stock * product.cost_price;
        return (
          <tr
            key={product.id}
            onClick={() => onSelect(product.id)}
            className="hover:bg-slate-50 transition-colors cursor-pointer"
          >
            {/* ARTICLE */}
            <td className="px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                    <p className="font-medium text-primary-900 truncate">{product.name}</p>
                    {product.is_multi_price && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-100 text-sky-700">
                        Multi
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    <span className="uppercase">{product.sku}</span>
                    {product.batches_count != null && (
                      <span className="text-slate-400"> · {product.batches_count} lots</span>
                    )}
                  </p>
                </div>
              </div>
            </td>
            {/* CATÉGORIE */}
            <td className="px-6 py-4 text-sm text-slate-600">
              {product.category || product.family || '—'}
            </td>
            {/* STOCK */}
            <td className="px-6 py-4 text-right">
              {isRupture ? (
                <span className="text-sm font-semibold text-danger-600">Rupture</span>
              ) : (
                <span
                  className={`text-sm font-semibold ${isLow ? 'text-warning-600' : 'text-primary-900'}`}
                >
                  {stock} {unit(product)}
                </span>
              )}
            </td>
            {/* SEUIL */}
            <td
              className={`px-6 py-4 text-right text-sm ${
                isRupture || isLow ? 'text-warning-600 font-medium' : 'text-slate-400'
              }`}
            >
              {product.alert_threshold}
            </td>
            {/* PRIX REVIENT */}
            <td className="px-6 py-4 text-sm text-slate-600 text-right">
              {formatF(product.cost_price)}
            </td>
            {/* P. VENTE */}
            <td className="px-6 py-4 text-right">
              {product.is_multi_price ? (
                <span className="text-sm font-medium text-primary-900">
                  {formatF(product.price_min || 0)} – {formatF(product.price_max || 0)}
                </span>
              ) : (
                <span className="text-sm font-medium text-primary-900">
                  {formatF(product.sell_price)}
                </span>
              )}
            </td>
            {/* VALEUR STOCK */}
            <td className="px-6 py-4 text-right text-sm font-semibold text-primary-900">
              {formatF(lineValue)}
            </td>
          </tr>
        );
      })}
    </>
  );
}
