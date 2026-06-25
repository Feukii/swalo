import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../lib/api';

interface CategoryInfo {
  name: string;
  count: number;
  products: { id: string; name: string; sku: string; current_stock?: number; sell_price: number }[];
}

export default function CatalogHierarchy() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [categoriesData, productsData] = await Promise.all([
        productsApi.getCategories(),
        productsApi.getAll(),
      ]);

      // Group products by category
      const catMap = new Map<string, CategoryInfo>();
      const uncategorized: CategoryInfo = { name: 'Sans categorie', count: 0, products: [] };

      for (const cat of categoriesData) {
        catMap.set(cat, { name: cat, count: 0, products: [] });
      }

      for (const product of productsData) {
        const catName = product.category || '';
        const target = catName ? catMap.get(catName) : uncategorized;
        if (target) {
          target.count++;
          target.products.push({
            id: product.id,
            name: product.name,
            sku: product.sku,
            current_stock: product.current_stock,
            sell_price: product.sell_price,
          });
        } else if (!catName) {
          uncategorized.count++;
          uncategorized.products.push({
            id: product.id,
            name: product.name,
            sku: product.sku,
            current_stock: product.current_stock,
            sell_price: product.sell_price,
          });
        }
      }

      const result = Array.from(catMap.values()).sort((a, b) => b.count - a.count);
      if (uncategorized.count > 0) result.push(uncategorized);
      setCategories(result);
    } catch (error) {
      console.error('Erreur chargement categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = (name: string) => {
    setExpandedCategory(prev => (prev === name ? null : name));
  };

  const totalProducts = categories.reduce((sum, c) => sum + c.count, 0);

  const filteredCategories = searchTerm
    ? categories.filter(
        c =>
          c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          c.products.some(
            p =>
              p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              p.sku.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
    : categories;

  const formatFCFA = (amount: number) => amount.toLocaleString('fr-FR') + ' FCFA';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-sky-400 via-action-500 to-action-600 text-white">
          <p className="text-sm text-white/80">Total produits</p>
          <p className="text-3xl font-bold mt-1">{totalProducts}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Categories</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{categories.length}</p>
        </div>
        <div className="card">
          <p className="text-slate-500 text-sm">Moyenne par categorie</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {categories.length > 0 ? Math.round(totalProducts / categories.length) : 0}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
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
            placeholder="Rechercher une categorie ou un produit..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Categories List */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Arborescence catalogue</h2>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500">Aucune categorie trouvee</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCategories.map(cat => (
              <div key={cat.name} className="border border-slate-200 rounded-xl overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(cat.name)}
                  className="w-full flex items-center justify-between p-4 hover:bg-action-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${expandedCategory === cat.name ? 'rotate-90' : ''}`}
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
                    <span className="font-medium text-slate-900">{cat.name}</span>
                  </div>
                  <span className="badge-primary">
                    {cat.count} produit{cat.count > 1 ? 's' : ''}
                  </span>
                </button>

                {/* Expanded Products */}
                {expandedCategory === cat.name && (
                  <div className="border-t border-slate-200 bg-slate-50">
                    {cat.products.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500">
                        Aucun produit dans cette categorie
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {cat.products.map(p => (
                          <div
                            key={p.id}
                            onClick={() => navigate(`/products/${p.id}/batches`)}
                            className="flex items-center justify-between p-3 px-6 hover:bg-action-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="w-2 h-2 rounded-full bg-action-400"></span>
                              <div>
                                <p className="text-sm font-medium text-slate-900">{p.name}</p>
                                <p className="text-xs text-slate-500">{p.sku}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span
                                className={`text-sm font-medium ${(p.current_stock ?? 0) <= 0 ? 'text-danger-600' : 'text-slate-600'}`}
                              >
                                {p.current_stock ?? 0} en stock
                              </span>
                              <span className="text-sm font-semibold text-slate-900">
                                {formatFCFA(p.sell_price)}
                              </span>
                              <svg
                                className="w-4 h-4 text-slate-300"
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
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
