import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../lib/api';

interface ShopResult {
  shop: {
    id: string;
    code: string;
    name: string;
    currency: string;
  };
  owner: {
    id: string;
    name: string;
    phone: string | null;
    pin_code: string;
  };
}

export default function CreateShop() {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('XOF');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ShopResult | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await authApi.createShop({
        shop_name: shopName,
        owner_name: ownerName,
        phone: phone || undefined,
        currency,
      });

      setResult(data);
    } catch (err: any) {
      const message = err.response?.data?.message || 'Erreur lors de la création de la boutique';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copié dans le presse-papier !');
  };

  const handleCreateAnother = () => {
    setResult(null);
    setShopName('');
    setOwnerName('');
    setPhone('');
    setCurrency('XOF');
    setError('');
  };

  if (result) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-3xl shadow-elevated p-8" id="printable-section">
            {/* En-tête */}
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-success-600 mb-2">
                Boutique créée avec succès !
              </h1>
              <p className="text-slate-600 text-sm">Conservez précieusement ces codes d'accès</p>
            </div>

            {/* Informations boutique */}
            <div className="space-y-6 mb-8">
              <div className="bg-slate-50 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-slate-900 mb-4">📋 Informations Boutique</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1">
                      Nom de la boutique
                    </label>
                    <p className="text-xl font-bold text-slate-900">{result.shop.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1">
                      Devise
                    </label>
                    <p className="text-lg text-slate-900">{result.shop.currency}</p>
                  </div>
                </div>
              </div>

              <div className="bg-action-50 border-2 border-action-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-action-700 mb-4">🔑 Code d'Accès Boutique</h2>
                <div className="flex items-center justify-between bg-white rounded-xl p-4 border-2 border-action-300">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1">
                      Code Boutique
                    </label>
                    <p className="text-4xl font-bold font-mono tracking-widest text-action-600">
                      {result.shop.code}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(result.shop.code)}
                    className="p-3 bg-action-100 hover:bg-action-200 rounded-xl transition-colors print:hidden"
                    title="Copier"
                  >
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bg-warning-50 border-2 border-warning-200 rounded-2xl p-6">
                <h2 className="text-lg font-bold text-warning-900 mb-4">👤 Propriétaire</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-600 block mb-1">Nom</label>
                    <p className="text-lg text-slate-900">{result.owner.name}</p>
                  </div>
                  {result.owner.phone && (
                    <div>
                      <label className="text-sm font-semibold text-slate-600 block mb-1">
                        Téléphone
                      </label>
                      <p className="text-lg text-slate-900">{result.owner.phone}</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-white rounded-xl p-4 border-2 border-warning-300 mt-4">
                    <div>
                      <label className="text-sm font-semibold text-slate-600 block mb-1">
                        Code PIN Propriétaire
                      </label>
                      <p className="text-4xl font-bold font-mono tracking-widest text-warning-600">
                        {result.owner.pin_code}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopy(result.owner.pin_code)}
                      className="p-3 bg-warning-100 hover:bg-warning-200 rounded-xl transition-colors print:hidden"
                      title="Copier"
                    >
                      <svg
                        className="w-5 h-5 text-warning-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-slate-50 rounded-2xl p-6 mb-6">
              <h3 className="font-bold text-slate-900 mb-3">📝 Instructions pour le propriétaire</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
                <li>
                  Utilisez le <strong>Code Boutique</strong> et le <strong>Code PIN</strong> pour
                  vous connecter
                </li>
                <li>Ne partagez jamais votre Code PIN avec quelqu'un d'autre</li>
                <li>Vous pouvez créer des codes PIN pour vos employés depuis l'app</li>
                <li>Conservez ces codes en lieu sûr (photo, note sécurisée)</li>
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex-1 py-3 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors"
              >
                🖨️ Imprimer
              </button>
              <button
                onClick={handleCreateAnother}
                className="flex-1 py-3 bg-action-500 hover:bg-action-600 text-white font-bold rounded-xl transition-colors"
              >
                ➕ Nouvelle Boutique
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex-1 py-3 bg-success-600 hover:bg-success-700 text-white font-bold rounded-xl transition-colors"
              >
                ✓ Terminer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-elevated p-8">
          {/* En-tête */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-sky-400 to-action-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg
                className="w-10 h-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-400 to-action-600 bg-clip-text text-transparent mb-2">
              Nouvelle Boutique
            </h1>
            <p className="text-slate-600 text-sm">Administration Swalo</p>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nom de la boutique *
              </label>
              <input
                type="text"
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                placeholder="Ex: Boutique Tech Center"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-action-500 focus:ring-2 focus:ring-action-200 outline-none transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nom du propriétaire *
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                placeholder="Ex: Jean Dupont"
                required
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-action-500 focus:ring-2 focus:ring-action-200 outline-none transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Téléphone (optionnel)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Ex: +237 6XX XX XX XX"
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-action-500 focus:ring-2 focus:ring-action-200 outline-none transition-all disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Devise</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-action-500 focus:ring-2 focus:ring-action-200 outline-none transition-all disabled:opacity-50"
              >
                <option value="XOF">XOF (Franc CFA)</option>
                <option value="XAF">XAF (Franc CFA)</option>
                <option value="EUR">EUR (Euro)</option>
                <option value="USD">USD (Dollar)</option>
              </select>
            </div>

            {error && (
              <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl">
                <p className="text-danger-700 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !shopName || !ownerName}
              className="w-full py-3 bg-gradient-to-r from-sky-400 to-action-600 hover:from-sky-500 hover:to-action-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Création en cours...
                </div>
              ) : (
                'CRÉER LA BOUTIQUE'
              )}
            </button>
          </form>

          {/* Retour */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-action-600 text-sm font-medium hover:text-action-700 hover:underline transition-colors"
            >
              ← Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
