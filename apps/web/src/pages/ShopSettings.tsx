import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../lib/api';

export default function ShopSettings() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [newShopCode, setNewShopCode] = useState('');
  const navigate = useNavigate();
  const { shop, role } = useAuthStore();

  // Vérifier que l'utilisateur est propriétaire
  if (role !== 'BOSS') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-600"
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
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Accès Refusé</h2>
          <p className="text-gray-600 mb-6">
            Seul le propriétaire de la boutique peut accéder aux paramètres.
          </p>
          <button
            onClick={() => navigate('/pos')}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition-colors"
          >
            Retour au POS
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (pin.length !== 4) {
      setError('Le code PIN doit contenir 4 chiffres');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.updateShopCode(pin);
      setNewShopCode(response.shop.code);
      setSuccess(true);
      setPin('');
    } catch (err: any) {
      const message =
        err.response?.data?.message || 'Erreur lors de la modification du code boutique';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copié dans le presse-papier !');
  };

  const handleReset = () => {
    setSuccess(false);
    setNewShopCode('');
    setPin('');
    setError('');
  };

  if (success && newShopCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 via-green-700 to-green-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            {/* En-tête succès */}
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
              <h1 className="text-3xl font-bold text-green-600 mb-2">Code Modifié !</h1>
              <p className="text-gray-600 text-sm">Votre nouveau code boutique a été généré</p>
            </div>

            {/* Nouveau code */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-6">
              <h2 className="text-lg font-bold text-blue-900 mb-4 text-center">
                🔑 Nouveau Code Boutique
              </h2>
              <div className="flex items-center justify-between bg-white rounded-xl p-4 border-2 border-blue-300">
                <div className="flex-1">
                  <p className="text-4xl font-bold font-mono tracking-widest text-blue-600 text-center">
                    {newShopCode}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(newShopCode)}
                  className="ml-4 p-3 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors"
                  title="Copier"
                >
                  <svg
                    className="w-5 h-5 text-blue-600"
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

            {/* Avertissement */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0"
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
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Important :</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Conservez ce code en lieu sûr</li>
                    <li>Tous vos employés devront utiliser ce nouveau code</li>
                    <li>L'ancien code ne fonctionne plus</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-xl transition-colors"
              >
                Modifier à nouveau
              </button>
              <button
                onClick={() => navigate('/pos')}
                className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* En-tête */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-purple-600 to-purple-800 rounded-2xl flex items-center justify-center shadow-lg">
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
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent mb-2">
              Paramètres Boutique
            </h1>
            <p className="text-gray-600 text-sm">Modifier le code d'accès</p>
          </div>

          {/* Info boutique actuelle */}
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6">
            <div className="space-y-2">
              <div>
                <label className="text-xs font-semibold text-gray-500">Boutique</label>
                <p className="text-lg font-bold text-gray-900">{shop?.name}</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">Code actuel</label>
                <p className="text-2xl font-mono font-bold text-purple-600">{shop?.code}</p>
              </div>
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-blue-800">
                  Un nouveau code à 6 chiffres sera généré automatiquement. Confirmez avec votre
                  PIN.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Votre Code PIN (confirmation)
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                placeholder="••••"
                maxLength={4}
                autoFocus
                disabled={isLoading}
                className="w-full px-4 py-3 text-center text-lg font-mono tracking-widest bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-purple-600 focus:ring-2 focus:ring-purple-200 outline-none transition-all disabled:opacity-50"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-700 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || pin.length !== 4}
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Génération en cours...
                </div>
              ) : (
                'GÉNÉRER NOUVEAU CODE'
              )}
            </button>
          </form>

          {/* Retour */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/pos')}
              className="text-purple-600 text-sm font-medium hover:text-purple-700 hover:underline transition-colors"
            >
              ← Retour au POS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
