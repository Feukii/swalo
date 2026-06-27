import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi, productBatchesApi, inventoryApi, packagingTypesApi } from '../lib/api';
import { usePermissions } from '../hooks/usePermissions';

interface PackagingType {
  id: string;
  name: string;
  symbol?: string;
  is_default?: boolean;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  category?: string;
  family?: string;
  brand?: string;
  unit?: string;
  cost_price: number;
  sell_price: number;
  current_stock?: number;
  alert_threshold: number;
  is_low_stock?: boolean;
  is_multi_price?: boolean;
  packaging_type_id?: string;
  units_per_package?: number;
  /** Prix du conditionnement, en centimes. */
  package_price?: number;
  packaging_type?: { name: string };
}

interface StockBatch {
  id: string;
  cost_price: number;
  sell_price: number;
  quantity: number;
  remaining_quantity: number;
  price_valid_from?: string;
  created_at: string;
}

interface BatchStats {
  total_batches: number;
  batches_with_stock: number;
  total_quantity: number;
  total_value: number;
}

/** Formatte un montant en centimes -> "12 345 F". */
function formatF(cents: number): string {
  const amount = Math.round((cents ?? 0) / 100);
  return `${new Intl.NumberFormat('fr-FR').format(amount)} F`;
}

function formatLongDate(dateString?: string): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const OUT_REASONS = [
  'Vente comptoir',
  'Perte',
  'Inventaire',
  'Retour fournisseur',
] as const;

export default function ProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManageStock = can('inventory', 'create') || can('products', 'create');

  const [product, setProduct] = useState<Product | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [stats, setStats] = useState<BatchStats>({
    total_batches: 0,
    batches_with_stock: 0,
    total_quantity: 0,
    total_value: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [modal, setModal] = useState<'in' | 'out' | 'pkg' | null>(null);

  const loadData = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    try {
      const [productData, batchData] = await Promise.all([
        productsApi.getOne(productId),
        productBatchesApi.getProductBatches(productId),
      ]);
      setProduct(productData);
      setBatches(batchData.batches || []);
      if (batchData.stats) setStats(batchData.stats);
    } catch (error) {
      console.error('Erreur lors du chargement du produit:', error);
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading || !product) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-12 h-12 spinner"></div>
      </div>
    );
  }

  const unit = product.unit || 'u.';
  const stock = product.current_stock ?? 0;
  const stockValue = stock * product.cost_price;
  const isLow = product.is_low_stock || stock <= product.alert_threshold;
  const margin =
    product.cost_price > 0
      ? Math.round(((product.sell_price - product.cost_price) / product.cost_price) * 100)
      : 0;
  const breadcrumbParts = [product.family, product.category].filter(Boolean) as string[];
  const breadcrumb = breadcrumbParts.join(' › ') || 'Sans catégorie';
  const headerSubtitle = [...breadcrumbParts, product.sku].filter(Boolean).join(' · ');
  const hasPackaging = !!(product.units_per_package && product.package_price);
  const packagingName = product.packaging_type?.name || 'Conditionnement';
  const perUnitFromPackage =
    hasPackaging && product.units_per_package
      ? Math.round((product.package_price ?? 0) / product.units_per_package)
      : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-primary-900">{product.name}</h1>
        <p className="text-sm text-slate-500">{headerSubtitle}</p>
      </div>

      {/* Retour au catalogue */}
      <button
        onClick={() => navigate('/products')}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-card hover:bg-slate-50 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour au catalogue
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Carte gauche : résumé */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-700 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-primary-900 truncate">{product.name}</p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                    stock <= 0
                      ? 'bg-danger-50 text-danger-700'
                      : isLow
                        ? 'bg-warning-50 text-warning-700'
                        : 'bg-success-50 text-success-700'
                  }`}
                >
                  {stock <= 0 ? 'Rupture' : isLow ? 'Stock bas' : 'En stock'}
                </span>
              </div>
              <p className="text-xs text-sky-600 font-medium mt-0.5">{breadcrumb}</p>
            </div>
          </div>

          {/* Stock / Valeur */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Stock actuel</p>
              <p className="text-xl font-bold text-primary-900 mt-0.5">
                {stock} <span className="text-sm font-medium text-slate-400">{unit}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Valeur du stock</p>
              <p className="text-xl font-bold text-primary-900 mt-0.5">{formatF(stockValue)}</p>
            </div>
          </div>

          {/* Prix de revient / P. vente · marge */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <div>
              <p className="text-xs text-slate-500">Prix de revient (PMP)</p>
              <p className="text-lg font-bold text-primary-900 mt-0.5">
                {formatF(product.cost_price)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">P. vente · marge</p>
              <p className="text-lg font-bold text-primary-900 mt-0.5">
                {formatF(product.sell_price)}{' '}
                <span
                  className={`text-sm font-semibold ${margin >= 0 ? 'text-success-600' : 'text-danger-600'}`}
                >
                  · {margin} %
                </span>
              </p>
            </div>
          </div>

          {/* Seuil d'alerte */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-warning-50">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-warning-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <span className="text-sm font-medium text-warning-800">Seuil d&apos;alerte</span>
            </div>
            <span className="text-sm font-bold text-warning-800">
              {product.alert_threshold} {unit}
            </span>
          </div>

          {/* Actions Entrée / Sortie */}
          {canManageStock && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setModal('in')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-success-700 bg-success-50 hover:bg-success-100 transition-colors"
              >
                <span className="text-base leading-none">+</span> Entrée
              </button>
              <button
                onClick={() => setModal('out')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-danger-700 bg-danger-50 hover:bg-danger-100 transition-colors"
              >
                <span className="text-base leading-none">−</span> Sortie
              </button>
            </div>
          )}
        </div>

        {/* Carte droite : Prix de revient & lots */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-primary-900">Prix de revient &amp; lots</h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Chaque réception fixe un prix de revient à une date de prise en compte. Le coût d&apos;un
                même article évolue dans le temps ; la valorisation suit les lots.
              </p>
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap mt-1">
              {stats.total_batches} lots · sortie FIFO
            </span>
          </div>

          {batches.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-danger-50 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-danger-400"
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
              <p className="font-semibold text-primary-900">Aucun lot en stock</p>
              <p className="text-sm text-slate-400 mt-1">
                Enregistrez une réception pour fixer un prix de revient daté.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Date de prise en compte
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Qté
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Prix de revient
                    </th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Valeur lot
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map(batch => {
                    const lotValue = batch.remaining_quantity * batch.cost_price;
                    return (
                      <tr key={batch.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                batch.remaining_quantity > 0 ? 'bg-sky-500' : 'bg-slate-300'
                              }`}
                            />
                            <span className="text-sm text-primary-900">
                              {formatLongDate(batch.price_valid_from || batch.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-slate-600">
                          {batch.remaining_quantity} {unit}
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-semibold text-primary-900">
                          {formatF(batch.cost_price)}
                        </td>
                        <td className="px-3 py-3 text-right text-sm text-slate-600">
                          {formatF(lotValue)}
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

      {/* Prix par conditionnement */}
      {hasPackaging ? (
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-primary-900">Prix par conditionnement</h2>
              <p className="text-sm text-slate-500 mt-1">Vente au détail et en gros pour cet article.</p>
            </div>
            {canManageStock && (
              <button
                onClick={() => setModal('pkg')}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-card hover:bg-slate-50 transition-colors"
              >
                Modifier
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tuile conditionnement */}
            <div className="rounded-xl bg-primary-50 p-4">
              <p className="text-sm font-semibold text-primary-900">
                {packagingName} · {product.units_per_package} {unit} →{' '}
                {formatF(product.package_price ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                soit {formatF(perUnitFromPackage)} / {unit}
              </p>
            </div>

            {/* Tuile unité */}
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-primary-900">
                {formatF(product.sell_price)} à l&apos;unité
              </p>
              <p className="text-xs text-slate-500 mt-1">Prix de vente détail</p>
            </div>
          </div>
        </div>
      ) : (
        canManageStock && (
          <button
            onClick={() => setModal('pkg')}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg shadow-card hover:bg-slate-50 transition-colors"
          >
            <span className="text-base leading-none">+</span> Ajouter un conditionnement
          </button>
        )
      )}

      {modal === 'in' && (
        <StockInModal
          unit={unit}
          defaultCost={product.cost_price}
          defaultSell={product.sell_price}
          productId={product.id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            loadData();
          }}
        />
      )}
      {modal === 'out' && (
        <StockOutModal
          unit={unit}
          maxQty={stock}
          productId={product.id}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            loadData();
          }}
        />
      )}
      {modal === 'pkg' && (
        <PackagingModal
          unit={unit}
          productId={product.id}
          currentPackagingTypeId={product.packaging_type_id}
          currentUnitsPerPackage={product.units_per_package}
          currentPackagePrice={product.package_price}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

/** Modale d'édition du conditionnement (vente en gros). */
function PackagingModal({
  unit,
  productId,
  currentPackagingTypeId,
  currentUnitsPerPackage,
  currentPackagePrice,
  onClose,
  onDone,
}: {
  unit: string;
  productId: string;
  currentPackagingTypeId?: string;
  currentUnitsPerPackage?: number;
  currentPackagePrice?: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const [packagingTypes, setPackagingTypes] = useState<PackagingType[]>([]);
  const [packagingTypeId, setPackagingTypeId] = useState(currentPackagingTypeId || '');
  const [unitsPerPackage, setUnitsPerPackage] = useState(
    currentUnitsPerPackage ? String(currentUnitsPerPackage) : ''
  );
  const [packagePrice, setPackagePrice] = useState(
    currentPackagePrice ? String(Math.round(currentPackagePrice / 100)) : ''
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    packagingTypesApi
      .getAll()
      .then((data: PackagingType[]) => setPackagingTypes(data || []))
      .catch(() => setPackagingTypes([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const units = parseInt(unitsPerPackage, 10);
    const price = Math.round(parseFloat(packagePrice) * 100);
    if (!packagingTypeId) {
      alert('Sélectionnez un type de conditionnement');
      return;
    }
    if (!units || units <= 0) {
      alert('Nombre de pièces invalide');
      return;
    }
    setSubmitting(true);
    try {
      await productsApi.update(productId, {
        packaging_type_id: packagingTypeId,
        units_per_package: units,
        package_price: Number.isNaN(price) ? 0 : price,
      });
      onDone();
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } } | undefined)
        ?.response?.data?.message;
      alert(apiMessage || 'Erreur lors de l’enregistrement du conditionnement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell
      title="Conditionnement"
      subtitle="Vente en gros · prix par lot"
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Type de conditionnement <span className="text-danger-500">*</span>
          </label>
          <select
            value={packagingTypeId}
            onChange={e => setPackagingTypeId(e.target.value)}
            className="input"
            required
          >
            <option value="">— Sélectionner —</option>
            {packagingTypes.map(pt => (
              <option key={pt.id} value={pt.id}>
                {pt.name}
                {pt.symbol ? ` (${pt.symbol})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Pièces par conditionnement ({unit}) <span className="text-danger-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={unitsPerPackage}
            onChange={e => setUnitsPerPackage(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Prix du conditionnement (F)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={packagePrice}
            onChange={e => setPackagePrice(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary flex-1 disabled:opacity-60"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Modale d'entrée de stock (réception). */
function StockInModal({
  unit,
  defaultCost,
  defaultSell,
  productId,
  onClose,
  onDone,
}: {
  unit: string;
  defaultCost: number;
  defaultSell: number;
  productId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState(String(Math.round(defaultCost / 100)));
  const [date, setDate] = useState(today);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    const cost = Math.round(parseFloat(costPrice) * 100);
    if (!qty || qty <= 0) {
      alert('Quantité invalide');
      return;
    }
    setSubmitting(true);
    try {
      await inventoryApi.createBatch({
        product_id: productId,
        quantity: qty,
        cost_price: Number.isNaN(cost) ? 0 : cost,
        sell_price: defaultSell,
        received_at: date,
      });
      onDone();
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } } | undefined)
        ?.response?.data?.message;
      alert(apiMessage || "Erreur lors de l'entrée de stock");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Entrée de stock" subtitle="Réception · fixe un prix de revient daté" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Quantité ({unit}) <span className="text-danger-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="input"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Prix de revient unitaire (FCFA)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={costPrice}
            onChange={e => setCostPrice(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Date de prise en compte
          </label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-success-500 hover:bg-success-600 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Enregistrement…' : "Valider l'entrée"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Modale de sortie de stock (avec motif). */
function StockOutModal({
  unit,
  maxQty,
  productId,
  onClose,
  onDone,
}: {
  unit: string;
  maxQty: number;
  productId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<(typeof OUT_REASONS)[number]>(OUT_REASONS[0]);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!qty || qty <= 0) {
      alert('Quantité invalide');
      return;
    }
    setSubmitting(true);
    try {
      await inventoryApi.createMovement({
        product_id: productId,
        type: reason === 'Vente comptoir' ? 'SALE' : 'ADJUSTMENT',
        qty: -Math.abs(qty),
        reason,
      });
      onDone();
    } catch (error) {
      const apiMessage = (error as { response?: { data?: { message?: string } } } | undefined)
        ?.response?.data?.message;
      alert(apiMessage || 'Erreur lors de la sortie de stock');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell title="Sortie de stock" subtitle={`Stock disponible : ${maxQty} ${unit}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Quantité ({unit}) <span className="text-danger-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            className="input"
            required
            autoFocus
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">
            Motif <span className="text-danger-500">*</span>
          </label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value as (typeof OUT_REASONS)[number])}
            className="input"
          >
            {OUT_REASONS.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-danger-500 hover:bg-danger-600 disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Enregistrement…' : 'Valider la sortie'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Habillage commun des modales (overlay + en-tête). */
function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-medium animate-scale-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-primary-900">{title}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
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
        {children}
      </div>
    </div>
  );
}
