import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@swalo/core/utils';
import {
  transfersApi,
  enterpriseApi,
  productsApi,
  type Transfer,
  type TransferStatus,
  type CreateTransferItemPayload,
} from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from '../hooks/usePermissions';

// ----- Types locaux -----
interface ShopLite {
  id: string;
  code: string;
  name: string;
  shop_type?: string;
}

interface ProductLite {
  id: string;
  sku: string;
  name: string;
  cost_price: number;
  sell_price: number;
  current_stock?: number;
}

// Ligne du formulaire de création (avant envoi)
interface DraftLine {
  product_id: string;
  product_sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
}

type TransferFilter = 'all' | 'pending' | 'completed';

const FILTER_TABS: { key: TransferFilter; label: string }[] = [
  { key: 'all', label: 'Tous' },
  { key: 'pending', label: 'En attente' },
  { key: 'completed', label: 'Terminés' },
];

const PENDING_STATUSES: TransferStatus[] = ['DRAFT', 'CONFIRMED', 'SHIPPED'];

const STATUS_CONFIG: Record<TransferStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Brouillon', className: 'bg-warning-100 text-warning-700' },
  CONFIRMED: { label: 'Confirmé', className: 'bg-action-100 text-action-700' },
  SHIPPED: { label: 'Expédié', className: 'bg-sky-100 text-sky-700' },
  RECEIVED: { label: 'Reçu', className: 'bg-success-100 text-success-700' },
  CANCELLED: { label: 'Annulé', className: 'bg-danger-100 text-danger-700' },
};

type StatusAction = 'confirm' | 'ship' | 'receive' | 'cancel';

const ACTION_LABELS: Record<StatusAction, string> = {
  confirm: 'confirmer',
  ship: 'marquer comme expédié',
  receive: 'confirmer la réception de',
  cancel: 'annuler',
};

export default function Transfers() {
  const { shop, enterprise } = useAuthStore();
  const { can } = usePermissions();
  const canCreate = can('transfers', 'create');
  const canValidate = can('transfers', 'validate');

  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<TransferFilter>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Détail (modal lecture seule)
  const [detailTransfer, setDetailTransfer] = useState<Transfer | null>(null);

  // Création
  const [showCreate, setShowCreate] = useState(false);
  const [shops, setShops] = useState<ShopLite[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [targetShopId, setTargetShopId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productToAdd, setProductToAdd] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadTransfers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await transfersApi.getAll();
      setTransfers(data);
    } catch (error) {
      console.error('Erreur chargement transferts:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Charge boutiques (destinations possibles) + produits de la boutique source
  const loadCreateData = useCallback(async () => {
    try {
      const [shopsData, productsData] = await Promise.all([
        enterprise ? enterpriseApi.getShops(enterprise.id) : Promise.resolve([]),
        productsApi.getAll(),
      ]);
      const allShops = (shopsData as ShopLite[]) ?? [];
      // La source est la boutique courante : on ne propose que les autres.
      setShops(allShops.filter(s => s.id !== shop?.id));
      setProducts((productsData as ProductLite[]) ?? []);
    } catch (error) {
      console.error('Erreur chargement données de création:', error);
    }
  }, [enterprise, shop?.id]);

  const handleOpenCreate = () => {
    setTargetShopId('');
    setNotes('');
    setLines([]);
    setProductToAdd('');
    setShowCreate(true);
    loadCreateData();
  };

  const handleCloseCreate = () => {
    setShowCreate(false);
  };

  const handleAddLine = () => {
    if (!productToAdd) return;
    if (lines.some(l => l.product_id === productToAdd)) return;
    const product = products.find(p => p.id === productToAdd);
    if (!product) return;
    setLines([
      ...lines,
      {
        product_id: product.id,
        product_sku: product.sku,
        product_name: product.name,
        quantity: 1,
        unit_price: product.sell_price,
        cost_price: product.cost_price,
      },
    ]);
    setProductToAdd('');
  };

  const handleUpdateLine = (productId: string, patch: Partial<DraftLine>) => {
    setLines(lines.map(l => (l.product_id === productId ? { ...l, ...patch } : l)));
  };

  const handleRemoveLine = (productId: string) => {
    setLines(lines.filter(l => l.product_id !== productId));
  };

  const createTotal = lines.reduce((sum, l) => sum + l.quantity * l.unit_price, 0);

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop?.id) {
      alert('Boutique source introuvable.');
      return;
    }
    if (!targetShopId) {
      alert('Veuillez choisir une boutique de destination.');
      return;
    }
    if (lines.length === 0) {
      alert('Ajoutez au moins un article.');
      return;
    }
    if (lines.some(l => l.quantity < 1)) {
      alert('Les quantités doivent être supérieures à 0.');
      return;
    }

    const items: CreateTransferItemPayload[] = lines.map(l => ({
      product_sku: l.product_sku,
      product_name: l.product_name,
      quantity: l.quantity,
      unit_price: l.unit_price,
      cost_price: l.cost_price,
    }));

    setIsSaving(true);
    try {
      await transfersApi.create({
        source_shop_id: shop.id,
        target_shop_id: targetShopId,
        items,
        notes: notes.trim() || undefined,
      });
      handleCloseCreate();
      loadTransfers();
    } catch (error) {
      console.error('Erreur création transfert:', error);
      alert("Impossible de créer le transfert. Vérifiez que les deux boutiques appartiennent à la même entreprise.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAction = async (transfer: Transfer, action: StatusAction) => {
    if (!window.confirm(`Voulez-vous ${ACTION_LABELS[action]} ce transfert ?`)) return;
    setActionLoading(transfer.id);
    try {
      await transfersApi[action](transfer.id);
      await loadTransfers();
    } catch (error) {
      console.error('Erreur action transfert:', error);
      alert("L'opération a échoué.");
    } finally {
      setActionLoading(null);
    }
  };

  const getTransferTotal = (transfer: Transfer) =>
    transfer.items.reduce((sum, item) => sum + item.total, 0);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const filteredTransfers = transfers.filter(t => {
    if (filter === 'pending') return PENDING_STATUSES.includes(t.status);
    if (filter === 'completed') return t.status === 'RECEIVED';
    return true;
  });

  const stats = {
    total: transfers.length,
    pending: transfers.filter(t => PENDING_STATUSES.includes(t.status)).length,
    completed: transfers.filter(t => t.status === 'RECEIVED').length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-marine-900">Transferts inter-boutiques</h1>
          <p className="text-sm text-slate-500 mt-1">
            Déplacez du stock entre les boutiques de votre entreprise
          </p>
        </div>
        {canCreate && (
          <button
            onClick={handleOpenCreate}
            className="btn-primary flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>+</span>
            <span>Nouveau transfert</span>
          </button>
        )}
      </div>

      {/* Cartes KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">En attente</p>
          <p className="text-2xl font-bold text-marine-900 mt-2">{stats.pending}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total</p>
          <p className="text-2xl font-bold text-marine-900 mt-2">{stats.total}</p>
        </div>
        <div className="card">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Terminés</p>
          <p className="text-2xl font-bold text-success-600 mt-2">{stats.completed}</p>
        </div>
      </div>

      {/* Liste */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-marine-900">Historique des transferts</h2>
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTER_TABS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === f.key
                  ? 'bg-action-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-12 h-12 spinner"></div>
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-50 flex items-center justify-center">
              <span className="text-3xl">🔁</span>
            </div>
            <p className="text-slate-500">Aucun transfert</p>
            {filter === 'all' && canCreate && (
              <button onClick={handleOpenCreate} className="btn-primary mt-4">
                Créer le premier transfert
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransfers.map(transfer => {
              const statusConfig = STATUS_CONFIG[transfer.status] ?? STATUS_CONFIG.DRAFT;
              const total = getTransferTotal(transfer);
              const unitCount = transfer.items.reduce((sum, item) => sum + item.quantity, 0);
              const busy = actionLoading === transfer.id;

              return (
                <div
                  key={transfer.id}
                  className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0">
                      🔁
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-marine-900 truncate">
                        {transfer.source_shop.name}
                        <span className="text-action-600 font-bold"> → </span>
                        {transfer.target_shop.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatDate(transfer.created_at)} ·{' '}
                        {transfer.items.length} article{transfer.items.length > 1 ? 's' : ''} ·{' '}
                        {unitCount} unité{unitCount > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className={`badge ${statusConfig.className}`}>{statusConfig.label}</span>
                    <span className="text-sm font-bold text-marine-900 tabular-nums">
                      {formatCurrency(total)}
                    </span>
                  </div>

                  {transfer.notes && (
                    <p className="text-xs text-slate-500 italic mt-2 ml-13">{transfer.notes}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
                    <button
                      onClick={() => setDetailTransfer(transfer)}
                      className="text-action-600 hover:text-action-700 font-medium text-sm"
                    >
                      Détails
                    </button>

                    {canValidate && transfer.status === 'DRAFT' && (
                      <>
                        <button
                          onClick={() => handleAction(transfer, 'confirm')}
                          disabled={busy}
                          className="px-3 py-1.5 text-sm rounded-lg bg-action-500 text-white hover:bg-action-600 disabled:opacity-50"
                        >
                          Confirmer
                        </button>
                        <button
                          onClick={() => handleAction(transfer, 'cancel')}
                          disabled={busy}
                          className="px-3 py-1.5 text-sm rounded-lg bg-danger-500 text-white hover:bg-danger-600 disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </>
                    )}

                    {canValidate && transfer.status === 'CONFIRMED' && (
                      <>
                        <button
                          onClick={() => handleAction(transfer, 'ship')}
                          disabled={busy}
                          className="px-3 py-1.5 text-sm rounded-lg bg-action-500 text-white hover:bg-action-600 disabled:opacity-50"
                        >
                          Expédier
                        </button>
                        <button
                          onClick={() => handleAction(transfer, 'cancel')}
                          disabled={busy}
                          className="px-3 py-1.5 text-sm rounded-lg bg-danger-500 text-white hover:bg-danger-600 disabled:opacity-50"
                        >
                          Annuler
                        </button>
                      </>
                    )}

                    {canValidate && transfer.status === 'SHIPPED' && (
                      <button
                        onClick={() => handleAction(transfer, 'receive')}
                        disabled={busy}
                        className="px-3 py-1.5 text-sm rounded-lg bg-success-500 text-white hover:bg-success-600 disabled:opacity-50"
                      >
                        Confirmer réception
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Import catalogue : fonctionnalité de suivi (voir version mobile) */}
      <div className="card border-dashed">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📥</span>
          <div>
            <p className="font-medium text-marine-900">Import catalogue (CSV / Excel)</p>
            <p className="text-sm text-slate-500 mt-1">
              L'import de catalogue avec mappage de colonnes est disponible sur l'application mobile.
              Le portage sur le web est prévu dans une prochaine itération.
            </p>
          </div>
        </div>
      </div>

      {/* Modal Détails */}
      {detailTransfer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-sky-500 to-action-600 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Détail du transfert</h2>
                  <p className="text-sm text-white/80 mt-1">
                    {detailTransfer.source_shop.name} → {detailTransfer.target_shop.name}
                  </p>
                </div>
                <button
                  onClick={() => setDetailTransfer(null)}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                >
                  <span className="text-lg">✕</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Statut</span>
                <span className={`badge ${(STATUS_CONFIG[detailTransfer.status] ?? STATUS_CONFIG.DRAFT).className}`}>
                  {(STATUS_CONFIG[detailTransfer.status] ?? STATUS_CONFIG.DRAFT).label}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Créé le</span>
                <span className="text-marine-900">{formatDate(detailTransfer.created_at)}</span>
              </div>
              {detailTransfer.creator?.display_name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Créé par</span>
                  <span className="text-marine-900">{detailTransfer.creator.display_name}</span>
                </div>
              )}
              {detailTransfer.notes && (
                <div className="text-sm">
                  <span className="text-slate-500">Notes</span>
                  <p className="text-marine-900 italic mt-1">{detailTransfer.notes}</p>
                </div>
              )}

              <div className="overflow-x-auto -mx-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-6 py-2 text-left text-xs font-medium text-slate-400 uppercase">
                        Article
                      </th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-400 uppercase">
                        Qté
                      </th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-400 uppercase">
                        Prix unit.
                      </th>
                      <th className="px-6 py-2 text-right text-xs font-medium text-slate-400 uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailTransfer.items.map(item => (
                      <tr key={item.id}>
                        <td className="px-6 py-3">
                          <p className="text-sm font-medium text-marine-900">{item.product_name}</p>
                          <p className="text-xs text-slate-400 uppercase">{item.product_sku}</p>
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-slate-600 tabular-nums">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-3 text-right text-sm text-slate-600 tabular-nums">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="px-6 py-3 text-right text-sm font-semibold text-marine-900 tabular-nums">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-sm font-medium text-slate-600">Total transfert</span>
                <span className="text-lg font-bold text-marine-900 tabular-nums">
                  {formatCurrency(getTransferTotal(detailTransfer))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Création */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-elevated animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 px-6 py-5 bg-gradient-to-r from-sky-500 to-action-600 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Nouveau transfert</h2>
                  <p className="text-sm text-white/80 mt-1">
                    Depuis {shop?.name ?? 'votre boutique'}
                  </p>
                </div>
                <button
                  onClick={handleCloseCreate}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                >
                  <span className="text-lg">✕</span>
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-6 space-y-4">
              {/* Destination */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Boutique de destination <span className="text-danger-500">*</span>
                </label>
                <select
                  value={targetShopId}
                  onChange={e => setTargetShopId(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Sélectionner une boutique…</option>
                  {shops.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
                {!enterprise && (
                  <p className="text-xs text-warning-600 mt-1">
                    Votre boutique n'est rattachée à aucune entreprise : aucune destination
                    disponible.
                  </p>
                )}
              </div>

              {/* Ajout d'articles */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Articles</label>
                <div className="flex gap-2">
                  <select
                    value={productToAdd}
                    onChange={e => setProductToAdd(e.target.value)}
                    className="input flex-1"
                  >
                    <option value="">Choisir un article…</option>
                    {products
                      .filter(p => !lines.some(l => l.product_id === p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    disabled={!productToAdd}
                    className="btn-secondary whitespace-nowrap disabled:opacity-50"
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              {/* Lignes ajoutées */}
              {lines.length > 0 && (
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100">
                  {lines.map(line => (
                    <div key={line.product_id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-marine-900 truncate">
                          {line.product_name}
                        </p>
                        <p className="text-xs text-slate-400 uppercase">{line.product_sku}</p>
                      </div>
                      <div className="w-20">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={e =>
                            handleUpdateLine(line.product_id, {
                              quantity: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                          className="input text-right"
                          aria-label="Quantité"
                        />
                      </div>
                      <div className="w-28 text-right text-sm font-semibold text-marine-900 tabular-nums">
                        {formatCurrency(line.quantity * line.unit_price)}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(line.product_id)}
                        className="text-danger-500 hover:text-danger-600 text-lg"
                        aria-label="Retirer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-slate-50">
                    <span className="text-sm font-medium text-slate-600">Total</span>
                    <span className="text-base font-bold text-marine-900 tabular-nums">
                      {formatCurrency(createTotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="input resize-none"
                  placeholder="Motif du transfert, remarques…"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseCreate}
                  className="btn-secondary flex-1"
                  disabled={isSaving}
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={isSaving}>
                  {isSaving ? 'Création…' : 'Créer le transfert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
