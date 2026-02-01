import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { productsApi } from '../lib/api';
import { formatCurrency } from '@swalo/core/utils';

interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, shop, logout } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
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
        productsApi.getAll({ search: searchTerm, category: selectedCategory }),
        productsApi.getStats(),
        productsApi.getCategories(),
      ]);
      setProducts(productsData);
      setStats(statsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchTerm, selectedCategory]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await productsApi.create({
        sku: formData.sku,
        name: formData.name,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        cost_price: Math.round(parseFloat(formData.cost_price) * 100),
        sell_price: Math.round(parseFloat(formData.sell_price) * 100),
        alert_threshold: parseInt(formData.alert_threshold),
      });
      setShowModal(false);
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
      loadData();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Erreur lors de la création du produit');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f7fafc' }}>
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '1.5rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              {shop?.name || 'SWALO'}
            </h1>
            <p style={{ opacity: 0.9 }}>{user?.display_name}</p>
          </div>
          <button
            onClick={logout}
            style={{
              padding: '0.5rem 1.5rem',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1rem' }}>
        {/* Statistics */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Total Produits
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2d3748' }}>
                {stats.total_products}
              </p>
            </div>
            <div
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Produits Actifs
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#38a169' }}>
                {stats.active_products}
              </p>
            </div>
            <div
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Stock Faible
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#e53e3e' }}>
                {stats.low_stock_count}
              </p>
            </div>
            <div
              style={{
                background: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              <p style={{ color: '#718096', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Valeur Inventaire
              </p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#667eea' }}>
                {formatCurrency(stats.total_inventory_value, 'XOF', 'fr-FR')}
              </p>
            </div>
          </div>
        )}

        {/* Actions & Filters */}
        <div
          style={{
            background: 'white',
            padding: '1.5rem',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Rechercher un produit..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
              }}
            />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                outline: 'none',
                minWidth: '150px',
              }}
            >
              <option value="">Toutes catégories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
            >
              + Nouveau Produit
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      color: '#4a5568',
                      fontWeight: '600',
                    }}
                  >
                    SKU
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      color: '#4a5568',
                      fontWeight: '600',
                    }}
                  >
                    Nom
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'left',
                      color: '#4a5568',
                      fontWeight: '600',
                    }}
                  >
                    Catégorie
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      color: '#4a5568',
                      fontWeight: '600',
                    }}
                  >
                    Prix Achat
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'right',
                      color: '#4a5568',
                      fontWeight: '600',
                    }}
                  >
                    Prix Vente
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#4a5568',
                      fontWeight: '600',
                    }}
                  >
                    Stock
                  </th>
                  <th
                    style={{
                      padding: '1rem',
                      textAlign: 'center',
                      color: '#4a5568',
                      fontWeight: '600',
                    }}
                  >
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}
                    >
                      Chargement...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}
                    >
                      Aucun produit trouvé
                    </td>
                  </tr>
                ) : (
                  products.map(product => (
                    <tr
                      key={product.id}
                      style={{
                        borderBottom: '1px solid #e2e8f0',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/products/${product.id}/batches`)}
                    >
                      <td style={{ padding: '1rem', fontFamily: 'monospace', color: '#2d3748' }}>
                        {product.sku}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '500', color: '#2d3748' }}>{product.name}</div>
                        {product.description && (
                          <div style={{ fontSize: '0.875rem', color: '#718096' }}>
                            {product.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '1rem', color: '#4a5568' }}>
                        {product.category || '-'}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'right', color: '#4a5568' }}>
                        {formatCurrency(product.cost_price, 'XOF', 'fr-FR')}
                      </td>
                      <td
                        style={{
                          padding: '1rem',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: '#2d3748',
                        }}
                      >
                        {product.is_multi_price ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                            <span>{formatCurrency(product.price_min || 0, 'XOF', 'fr-FR')} - {formatCurrency(product.price_max || 0, 'XOF', 'fr-FR')}</span>
                            <span
                              style={{
                                padding: '0.125rem 0.5rem',
                                borderRadius: '12px',
                                fontSize: '0.7rem',
                                fontWeight: '600',
                                background: '#ebf4ff',
                                color: '#3182ce',
                                border: '1px solid #bee3f8',
                              }}
                            >
                              Multi-prix
                            </span>
                          </div>
                        ) : (
                          formatCurrency(product.sell_price, 'XOF', 'fr-FR')
                        )}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            background: product.is_low_stock ? '#fed7d7' : '#c6f6d5',
                            color: product.is_low_stock ? '#c53030' : '#22543d',
                          }}
                        >
                          {product.current_stock ?? 0}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            background: product.is_active ? '#c6f6d5' : '#e2e8f0',
                            color: product.is_active ? '#22543d' : '#4a5568',
                          }}
                        >
                          {product.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '2rem',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                marginBottom: '1.5rem',
                color: '#2d3748',
              }}
            >
              Nouveau Produit
            </h2>
            <form onSubmit={handleCreateProduct}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      color: '#4a5568',
                      fontWeight: '500',
                    }}
                  >
                    SKU *
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={e => setFormData({ ...formData, sku: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      color: '#4a5568',
                      fontWeight: '500',
                    }}
                  >
                    Nom *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      color: '#4a5568',
                      fontWeight: '500',
                    }}
                  >
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      color: '#4a5568',
                      fontWeight: '500',
                    }}
                  >
                    Catégorie
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        color: '#4a5568',
                        fontWeight: '500',
                      }}
                    >
                      Prix Achat (XOF) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.cost_price}
                      onChange={e => setFormData({ ...formData, cost_price: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        marginBottom: '0.5rem',
                        color: '#4a5568',
                        fontWeight: '500',
                      }}
                    >
                      Prix Vente (XOF) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.sell_price}
                      onChange={e => setFormData({ ...formData, sell_price: e.target.value })}
                      required
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      color: '#4a5568',
                      fontWeight: '500',
                    }}
                  >
                    Seuil d'alerte
                  </label>
                  <input
                    type="number"
                    value={formData.alert_threshold}
                    onChange={e => setFormData({ ...formData, alert_threshold: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
